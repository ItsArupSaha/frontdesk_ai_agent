from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from backend.utils.limiter import limiter
from backend.routers import vapi_webhook, onboarding, sms_webhook
from backend.routers import dashboard_api
from backend.routers.dashboard_api import auth_router
from backend.routers import admin as admin_router
from backend.services.scheduler import setup_scheduler
from backend.utils.logging import get_logger
from backend.config import settings

logger = get_logger(__name__)

async def _prewarm_openai() -> None:
    """Send a minimal chat completion on startup to establish the HTTP connection pool.

    The first real OpenAI call after a cold start incurs ~2-3 s of TCP+TLS
    handshake overhead.  Doing a cheap throwaway call here absorbs that cost
    before the first Vapi webhook arrives.
    """
    if not settings.openai_api_key:
        return
    try:
        from langchain_openai import ChatOpenAI
        from langchain_core.messages import HumanMessage as _HM
        llm = ChatOpenAI(model="gpt-4o-mini", api_key=settings.openai_api_key, max_tokens=1)
        await llm.ainvoke([_HM(content="ping")])
        logger.info("OpenAI connection pre-warmed")
    except Exception as exc:
        # Never block startup on a pre-warm failure.
        logger.warning("OpenAI pre-warm failed (non-fatal)", error=str(exc))


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting AI Front-Desk Agent", env=settings.app_env)
    await _prewarm_openai()

    scheduler = setup_scheduler(app)
    scheduler.start()
    logger.info(
        "APScheduler started",
        jobs=["reminders (5 min)", "review_requests (15 min)", "missed_call_recovery (2 min)"],
    )

    yield

    scheduler.shutdown(wait=False)
    logger.info("Shutting down")

app = FastAPI(
    title="AI Front-Desk Agent",
    version="0.1.0",
    lifespan=lifespan
)

# Attach rate limiter to the app state so slowapi can access it.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(vapi_webhook.router, prefix="/webhook")
app.include_router(sms_webhook.router, prefix="/webhook")
app.include_router(onboarding.router)
app.include_router(auth_router)
app.include_router(dashboard_api.router)
app.include_router(admin_router.router)


@app.get("/health")
async def health():
    """Health check endpoint — always returns 200."""
    return {"status": "ok", "env": settings.app_env}


# ---------------------------------------------------------------------------
# Per-route rate limits applied via decorator on the router functions.
# Since slowapi decorators work on the handler function, we add them here
# as middleware-level overrides for the key routes.
#
# Limits:
#   POST /webhook/vapi          → 60/minute per IP
#   POST /api/clients/create    → 10/minute per IP
#   All other API routes        → 120/minute per IP (applied in dashboard_api)
# ---------------------------------------------------------------------------

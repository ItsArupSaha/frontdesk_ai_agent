from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from backend.routers import vapi_webhook, onboarding
from backend.routers import dashboard_api
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(vapi_webhook.router, prefix="/webhook")
app.include_router(onboarding.router)
app.include_router(dashboard_api.router)

@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.app_env}

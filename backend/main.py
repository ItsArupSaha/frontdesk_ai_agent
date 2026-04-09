from fastapi import FastAPI
from contextlib import asynccontextmanager
from backend.routers import vapi_webhook
from backend.utils.logging import get_logger
from backend.config import settings

logger = get_logger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting AI Front-Desk Agent", env=settings.app_env)
    yield
    logger.info("Shutting down")

app = FastAPI(
    title="AI Front-Desk Agent",
    version="0.1.0",
    lifespan=lifespan
)

app.include_router(vapi_webhook.router, prefix="/webhook")

@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.app_env}

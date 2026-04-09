import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    openai_api_key: str
    vapi_api_key: str
    vapi_webhook_secret: str
    supabase_url: str
    supabase_secret_key: str
    app_env: str = "development"
    app_secret_key: str = "change-this-in-production"
    base_url: str = "http://localhost:8000"

    model_config = SettingsConfigDict(env_file=os.path.join(Path(__file__).parent, ".env"), env_file_encoding="utf-8", extra="ignore")

settings = Settings()

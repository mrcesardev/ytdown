import os
from pathlib import Path
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # App
    PROJECT_NAME: str = "YtDown API"
    ENVIRONMENT: str = "production"
    BASE_URL: str = "http://localhost:8000"
    API_SECRET_KEY: str = ""  # Token opcional para validar chamadas do frontend/Vercel
    ALLOWED_ORIGINS: str = "*"

    # Redis & Celery
    REDIS_URL: str = "redis://redis:6379/0"

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # Downloads
    DOWNLOAD_DIR: str = os.getenv("DOWNLOAD_DIR", str(Path(__file__).resolve().parent.parent / "downloads"))
    MAX_FILE_AGE_HOURS: int = 2

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

# Garante que o diretório de downloads existe
os.makedirs(settings.DOWNLOAD_DIR, exist_ok=True)

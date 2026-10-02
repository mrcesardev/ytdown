import os
from pathlib import Path
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # App
    PROJECT_NAME: str = "YtDown API"
    ENVIRONMENT: str = "production"
    BASE_URL: str = os.getenv("BASE_URL", "http://45.178.180.152:8000")
    API_SECRET_KEY: str = os.getenv("API_SECRET_KEY", "ytdown_sec_7d2a1b194b53cae48270df94b45a43d0f0583a8bd8226dfe")
    ALLOWED_ORIGINS: str = os.getenv("ALLOWED_ORIGINS", "*")

    # Redis & Celery
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/0")

    # Supabase
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "https://kbfrolcsqnfazjjakfps.supabase.co")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv(
        "SUPABASE_SERVICE_ROLE_KEY",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtiZnJvbGNzcW5mYXpqamFrZnBzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDg3Nzc0OCwiZXhwIjoyMTA2NDUzNzQ4fQ.nyCjhGuXsDPyVAomAx0kKG3-nVoOxbKeZ72_M5jrIJE"
    )

    # Downloads
    DOWNLOAD_DIR: str = os.getenv("DOWNLOAD_DIR", str(Path(__file__).resolve().parent.parent / "downloads"))
    MAX_FILE_AGE_HOURS: int = 2

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

# Garante que o diretório de downloads existe
os.makedirs(settings.DOWNLOAD_DIR, exist_ok=True)

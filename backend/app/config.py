import os
from pathlib import Path
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # App
    PROJECT_NAME: str = "YtDown API"
    ENVIRONMENT: str = "development"
    BASE_URL: str = "http://localhost:8000"
    API_SECRET_KEY: str = ""
    ALLOWED_ORIGINS: str = "*"

    # Redis & Celery
    REDIS_URL: str = "redis://redis:6379/0"

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_SECRET_KEY: str = ""

    # Downloads
    DOWNLOAD_DIR: str = str(Path(__file__).resolve().parent.parent / "downloads")
    MAX_FILE_AGE_HOURS: int = 2

    # Cookies de autenticação opcionais (para Instagram e YouTube restrito)
    COOKIES_FILE: str = ""

    @property
    def resolved_cookies_file(self) -> str | None:
        if self.COOKIES_FILE and os.path.exists(self.COOKIES_FILE):
            return self.COOKIES_FILE
        local_cookies = Path(__file__).resolve().parent.parent / "cookies.txt"
        if local_cookies.exists() and local_cookies.is_file():
            return str(local_cookies)
        downloads_cookies = Path(self.DOWNLOAD_DIR) / "cookies.txt"
        if downloads_cookies.exists() and downloads_cookies.is_file():
            return str(downloads_cookies)
        return None

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

# Garante que o diretório de downloads existe
os.makedirs(settings.DOWNLOAD_DIR, exist_ok=True)

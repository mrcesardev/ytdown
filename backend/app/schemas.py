from typing import Literal, Optional
from pydantic import BaseModel, HttpUrl

class DownloadRequest(BaseModel):
    id: Optional[str] = None  # UUID pré-gerado pelo frontend no Supabase
    url: str
    format: Literal["mp3", "mp4"] = "mp3"
    quality: Optional[str] = "standard"  # 'standard' (grátis) ou 'high' (com cadastro)
    is_playlist: bool = False
    user_id: Optional[str] = None  # Opcional: nulo para downloads anônimos na página inicial

class DownloadResponse(BaseModel):
    id: str
    task_id: str
    status: str
    message: str

class DownloadStatus(BaseModel):
    id: str
    status: str
    progress: int = 0
    title: Optional[str] = None
    thumbnail: Optional[str] = None
    download_url: Optional[str] = None
    filename: Optional[str] = None
    file_size: Optional[int] = None
    error_message: Optional[str] = None

class HealthResponse(BaseModel):
    status: str
    project: str
    redis_connected: bool
    supabase_configured: bool

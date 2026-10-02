from typing import Literal, Optional, List
from pydantic import BaseModel

class PlaylistEntryInfo(BaseModel):
    index: int
    id: str
    title: str
    duration: Optional[int] = None
    duration_formatted: Optional[str] = None
    thumbnail: Optional[str] = None
    url: str

class MediaInfoRequest(BaseModel):
    url: str

class MediaInfoResponse(BaseModel):
    url: str
    title: str
    thumbnail: Optional[str] = None
    duration: Optional[int] = None
    duration_formatted: Optional[str] = None
    uploader: Optional[str] = None
    is_playlist: bool = False
    entries: Optional[List[PlaylistEntryInfo]] = None
    total_entries: Optional[int] = None

class DownloadRequest(BaseModel):
    id: Optional[str] = None  # UUID pré-gerado pelo frontend no Supabase
    url: str
    format: Literal["mp3", "mp4"] = "mp3"
    quality: Optional[str] = "standard"  # 'standard' (grátis) ou 'high' (com cadastro)
    is_playlist: bool = False
    user_id: Optional[str] = None  # Opcional: nulo para downloads anônimos na página inicial
    selected_urls: Optional[List[str]] = None  # URLs selecionadas da playlist (máximo 5)
    playlist_title: Optional[str] = None

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

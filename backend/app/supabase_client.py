import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from supabase import create_client, Client
from app.config import settings

logger = logging.getLogger(__name__)

supabase_client: Optional[Client] = None

if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
    try:
        supabase_client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY
        )
        logger.info("Supabase client initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
else:
    logger.warning("Supabase credentials not configured. Running without direct DB sync.")


def get_supabase() -> Optional[Client]:
    return supabase_client


def update_download_record(download_id: str, data: Dict[str, Any]) -> bool:
    """Atualiza o registro do download na tabela media_downloads."""
    if not supabase_client:
        logger.debug(f"[Mock DB] Update {download_id}: {data}")
        return False
    try:
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        response = supabase_client.table("media_downloads").update(data).eq("id", download_id).execute()
        return bool(response.data)
    except Exception as e:
        logger.error(f"Error updating Supabase record {download_id}: {e}")
        return False


def create_download_record(
    download_id: str,
    user_id: Optional[str],
    url: str,
    format_type: str,
    quality: str = "standard",
    is_playlist: bool = False
) -> Optional[Dict[str, Any]]:
    """Cria um registro inicial caso não tenha sido criado pelo frontend."""
    if not supabase_client:
        return None
    try:
        payload = {
            "id": download_id,
            "user_id": user_id,
            "original_url": url,
            "format": format_type,
            "quality": quality,
            "is_playlist": is_playlist,
            "status": "pending",
            "progress": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        res = supabase_client.table("media_downloads").insert(payload).execute()
        if res.data:
            return res.data[0]
    except Exception as e:
        logger.error(f"Error creating Supabase record: {e}")
    return None

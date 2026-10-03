import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from supabase import create_client, Client
from app.config import settings

logger = logging.getLogger(__name__)

supabase_client: Optional[Client] = None

clean_url = (settings.SUPABASE_URL or os.getenv("SUPABASE_URL", "")).strip().strip("'\"").rstrip("/")
clean_key = (
    settings.SUPABASE_SECRET_KEY or
    settings.SUPABASE_SERVICE_ROLE_KEY or
    os.getenv("SUPABASE_SECRET_KEY", "") or
    os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
).strip().strip("'\"")

if clean_url and clean_key:
    try:
        supabase_client = create_client(clean_url, clean_key)
        masked_key = f"{clean_key[:10]}...{clean_key[-6:]}" if len(clean_key) > 16 else clean_key
        logger.info(f"Cliente Supabase inicializado com URL '{clean_url}' e chave ({masked_key}, len={len(clean_key)}).")
    except Exception as e:
        logger.error(f"Falha ao inicializar cliente Supabase: {e}")
else:
    logger.warning("Credenciais do Supabase não configuradas ou vazias. Executando sem sincronização direta com DB.")


def get_supabase() -> Optional[Client]:
    return supabase_client


def update_download_record(download_id: str, data: Dict[str, Any]) -> bool:
    """Atualiza o registro do download na tabela media_downloads."""
    if not supabase_client:
        logger.warning(f"[Supabase Not Initialized] Cannot update {download_id}: {data}")
        return False
    try:
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        response = supabase_client.table("media_downloads").update(data).eq("id", download_id).execute()
        logger.info(f"Supabase record {download_id} updated: status={data.get('status')}, progress={data.get('progress')}")
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

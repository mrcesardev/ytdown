import logging
import os
from pathlib import Path
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


LOCAL_DOWNLOADS_CACHE: Dict[str, Dict[str, Any]] = {}


def get_disk_status(download_id: str) -> Optional[Dict[str, Any]]:
    """Lê o arquivo de status persistido no volume compartilhado de downloads."""
    try:
        download_dir = Path(settings.DOWNLOAD_DIR)
        status_file = download_dir / f".status_{download_id}.json"
        if status_file.exists():
            import json
            with open(status_file, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as e:
        logger.debug(f"Erro ao ler status em disco para {download_id}: {e}")
    return None


def save_disk_status(download_id: str, data: Dict[str, Any]):
    """Grava o status do download em arquivo compartilhado no disco (/app/downloads)."""
    try:
        download_dir = Path(settings.DOWNLOAD_DIR)
        download_dir.mkdir(parents=True, exist_ok=True)
        status_file = download_dir / f".status_{download_id}.json"
        temp_file = download_dir / f".status_{download_id}.tmp"

        current_data = {}
        if status_file.exists():
            try:
                import json
                with open(status_file, "r", encoding="utf-8") as f:
                    current_data = json.load(f)
            except Exception:
                current_data = {}

        current_data.update(data)
        current_data["updated_at"] = datetime.now(timezone.utc).isoformat()

        import json
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(current_data, f, ensure_ascii=False)
        temp_file.replace(status_file)
    except Exception as e:
        logger.debug(f"Erro ao salvar status em disco para {download_id}: {e}")


def get_cached_download_record(download_id: str) -> Optional[Dict[str, Any]]:
    """Recupera o registro de status em memória ou em disco."""
    if download_id in LOCAL_DOWNLOADS_CACHE:
        return LOCAL_DOWNLOADS_CACHE[download_id]
    return get_disk_status(download_id)


def get_supabase() -> Optional[Client]:
    return supabase_client


def update_download_record(download_id: str, data: Dict[str, Any]) -> bool:
    """Atualiza o registro do download no cache em memória, no arquivo compartilhado e no Supabase."""
    # 1. Mantém cache em memória atualizado
    if download_id not in LOCAL_DOWNLOADS_CACHE:
        LOCAL_DOWNLOADS_CACHE[download_id] = {}
    LOCAL_DOWNLOADS_CACHE[download_id].update(data)
    LOCAL_DOWNLOADS_CACHE[download_id]["updated_at"] = datetime.now(timezone.utc).isoformat()

    # 2. Persiste no arquivo compartilhado do volume (comunicação instantânea worker <-> api)
    save_disk_status(download_id, data)

    # 3. Sincroniza com Supabase se configurado
    if not supabase_client:
        return True
    try:
        data_to_send = dict(data)
        data_to_send["updated_at"] = datetime.now(timezone.utc).isoformat()
        response = supabase_client.table("media_downloads").update(data_to_send).eq("id", download_id).execute()
        logger.info(f"Supabase record {download_id} updated: status={data.get('status')}, progress={data.get('progress')}")
        return bool(response.data)
    except Exception as e:
        logger.warning(
            f"Aviso ao sincronizar download {download_id} com Supabase ({e}). "
            "O download prossegue normalmente usando cache local e disco como fallback."
        )
        return True


def create_download_record(
    download_id: str,
    user_id: Optional[str],
    url: str,
    format_type: str,
    quality: str = "standard",
    is_playlist: bool = False
) -> Optional[Dict[str, Any]]:
    """Cria um registro inicial no cache local, disco e no Supabase."""
    initial_payload = {
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
    LOCAL_DOWNLOADS_CACHE[download_id] = dict(initial_payload)
    save_disk_status(download_id, initial_payload)

    if not supabase_client:
        return initial_payload
    try:
        res = supabase_client.table("media_downloads").insert(initial_payload).execute()
        if res.data:
            return res.data[0]
    except Exception as e:
        logger.warning(f"Aviso ao criar registro inicial no Supabase ({e}). Usando armazenamento local.")
    return initial_payload


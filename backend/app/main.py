import os
import re
import uuid
import logging
from urllib.parse import quote
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, HTTPException, Header, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from celery.result import AsyncResult

from app.config import settings
from app.schemas import (
    DownloadRequest,
    DownloadResponse,
    DownloadStatus,
    HealthResponse,
    MediaInfoRequest,
    MediaInfoResponse,
)
from app.celery_app import celery_app
from app.tasks import (
    process_media_download,
    execute_download,
    cleanup_old_files,
    extract_media_info,
)
from app.supabase_client import (
    get_supabase,
    create_download_record,
    get_disk_status,
    get_cached_download_record,
)

logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="API de extração e conversão de mídia com yt-dlp e FFmpeg"
)

# Configuração de CORS para permitir requisições do front na Vercel e localhost
origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
if "*" in origins or not origins:
    allow_origins = ["*"]
else:
    allow_origins = origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def verify_secret_key(x_api_key: Optional[str] = Header(None)):
    """Verifica chave de autenticação se API_SECRET_KEY estiver configurada."""
    if settings.API_SECRET_KEY and x_api_key != settings.API_SECRET_KEY:
        raise HTTPException(status_code=401, detail="Acesso não autorizado: chave de API inválida.")
    return True


@app.get("/api/health", response_model=HealthResponse)
def health_check():
    """Verifica a integridade da API, Redis e Supabase."""
    redis_ok = False
    try:
        redis_ok = celery_app.control.ping(timeout=0.5) is not None
    except Exception:
        redis_ok = False

    return HealthResponse(
        status="online",
        project=settings.PROJECT_NAME,
        redis_connected=redis_ok,
        supabase_configured=bool(settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY)
    )


@app.post("/api/info", response_model=MediaInfoResponse)
def get_media_info(request: MediaInfoRequest, authorized: bool = Depends(verify_secret_key)):
    """Extrai informações como título, duração, capa e faixas da playlist."""
    try:
        data = extract_media_info(request.url)
        return MediaInfoResponse(**data)
    except Exception as e:
        logger.error(f"Erro ao obter informações da URL {request.url}: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/downloads", response_model=DownloadResponse)
def enqueue_download(
    request: DownloadRequest,
    background_tasks: BackgroundTasks,
    authorized: bool = Depends(verify_secret_key)
):
    """
    Recebe a solicitação de download.
    Em produção com Redis: enfileira no Celery.
    Em desenvolvimento local sem Redis: processa com BackgroundTasks nativo do FastAPI.
    """
    download_id = request.id or str(uuid.uuid4())

    create_download_record(
        download_id=download_id,
        user_id=request.user_id,
        url=request.url,
        format_type=request.format,
        quality=request.quality or "standard",
        is_playlist=request.is_playlist
    )

    use_celery = False
    try:
        import redis
        r = redis.from_url(settings.REDIS_URL, socket_connect_timeout=0.8, socket_timeout=0.8)
        if r.ping():
            use_celery = True
    except Exception as e:
        logger.warning(f"Broker Celery/Redis indisponível ({e}). Executando via BackgroundTasks local.")
        use_celery = False

    if use_celery:
        logger.info(f"Enfileirando {download_id} no Celery (Worker VPS)")
        task = process_media_download.apply_async(
            args=[
                download_id,
                request.url,
                request.format,
                request.quality or "standard",
                request.is_playlist,
                request.selected_urls,
                request.playlist_title
            ],
            task_id=download_id
        )
        task_id = task.id
    else:
        logger.info(f"Executando {download_id} via BackgroundTasks local (modo desenvolvimento)")
        background_tasks.add_task(
            execute_download,
            download_id,
            request.url,
            request.format,
            request.quality or "standard",
            request.is_playlist,
            request.selected_urls,
            request.playlist_title
        )
        task_id = download_id

    return DownloadResponse(
        id=download_id,
        task_id=task_id,
        status="pending",
        message="Download iniciado com sucesso."
    )


@app.get("/api/downloads/{download_id}", response_model=DownloadStatus)
def get_download_status(download_id: str):
    """Consulta o status da tarefa através de múltiplos níveis de resiliência:
    1. Arquivo final pronto no disco compartilhado (/app/downloads)
    2. Estado salvo em disco (.status_{download_id}.json) sincronizado entre worker e API
    3. Cache em memória da aplicação
    4. Tarefa assíncrona do Celery (Redis)
    5. Banco de dados do Supabase
    """
    download_dir = Path(settings.DOWNLOAD_DIR)

    # 1. Checa se o arquivo final já foi gerado e está pronto no disco
    # (Evita travamentos caso o Supabase ou Celery backend falhem ou estejam desatualizados)
    try:
        completed_files = [
            f for f in download_dir.glob(f"{download_id}_*")
            if f.is_file()
            and not f.name.endswith((".part", ".tmp", ".ytdl", ".json"))
            and not f.name.startswith("temp_")
        ]
        if completed_files:
            final_file = completed_files[0]
            filename = final_file.name
            file_size = final_file.stat().st_size
            download_url = f"{settings.BASE_URL.rstrip('/')}/api/files/{quote(filename)}"
            clean_name = filename[len(f"{download_id}_"):].rsplit(".", 1)[0].replace("_", " ")

            disk_meta = get_disk_status(download_id) or get_cached_download_record(download_id) or {}
            return DownloadStatus(
                id=download_id,
                status="completed",
                progress=100,
                title=disk_meta.get("title") or clean_name,
                thumbnail=disk_meta.get("thumbnail"),
                download_url=download_url,
                filename=filename,
                file_size=file_size
            )
    except Exception as e:
        logger.debug(f"Erro ao verificar arquivos no disco para {download_id}: {e}")

    # 2. Checa o estado salvo no disco compartilhado entre worker e API
    disk_info = get_disk_status(download_id) or get_cached_download_record(download_id)
    if disk_info:
        status = disk_info.get("status", "pending")
        if status in ("completed", "failed") or (status == "processing" and disk_info.get("progress", 0) > 0):
            return DownloadStatus(
                id=download_id,
                status=status,
                progress=disk_info.get("progress", 0),
                title=disk_info.get("title"),
                thumbnail=disk_info.get("thumbnail"),
                download_url=disk_info.get("download_url"),
                filename=disk_info.get("filename"),
                file_size=disk_info.get("file_size"),
                error_message=disk_info.get("error_message")
            )

    # 3. Consulta no Celery (Redis)
    try:
        task_res = AsyncResult(download_id, app=celery_app)
        if task_res.state == "SUCCESS":
            result = task_res.result or {}
            return DownloadStatus(
                id=download_id,
                status="completed",
                progress=100,
                title=result.get("title"),
                filename=result.get("filename"),
                download_url=result.get("download_url"),
                file_size=result.get("file_size")
            )
        elif task_res.state == "FAILURE":
            return DownloadStatus(
                id=download_id,
                status="failed",
                error_message=str(task_res.result)
            )
        elif task_res.state == "PROGRESS":
            meta = task_res.info or {} if isinstance(task_res.info, dict) else {}
            return DownloadStatus(
                id=download_id,
                status="processing",
                progress=meta.get("progress", 50)
            )
        elif task_res.state == "STARTED":
            return DownloadStatus(
                id=download_id,
                status="processing",
                progress=20
            )
    except Exception:
        pass

    # 4. Consulta no Supabase
    client = get_supabase()
    if client:
        try:
            res = client.table("media_downloads").select("*").eq("id", download_id).execute()
            if res.data:
                item = res.data[0]
                sb_status = item.get("status", "pending")
                sb_progress = item.get("progress", 0)
                if sb_status in ("completed", "failed") or (sb_status == "processing" and sb_progress > 0):
                    return DownloadStatus(
                        id=download_id,
                        status=sb_status,
                        progress=sb_progress,
                        title=item.get("title"),
                        thumbnail=item.get("thumbnail"),
                        download_url=item.get("download_url"),
                        filename=item.get("filename"),
                        file_size=item.get("file_size"),
                        error_message=item.get("error_message")
                    )
        except Exception as e:
            logger.error(f"Erro ao consultar status no Supabase: {e}")

    # 5. Verifica se há arquivos temporários em processamento ativo no disco
    try:
        temp_files = list(download_dir.glob(f"*{download_id}*"))
        if temp_files:
            return DownloadStatus(
                id=download_id,
                status="processing",
                progress=disk_info.get("progress", 25) if disk_info else 25,
                title=disk_info.get("title") if disk_info else None,
                thumbnail=disk_info.get("thumbnail") if disk_info else None
            )
    except Exception:
        pass

    # 6. Fallback inicial
    return DownloadStatus(
        id=download_id,
        status="pending",
        progress=0
    )


@app.get("/api/files/{filename:path}")
def download_file(filename: str):
    """Entrega o arquivo baixado com suporte a download direto no navegador."""
    safe_name = os.path.basename(filename)
    file_path = Path(settings.DOWNLOAD_DIR) / safe_name

    # Fallback resiliente: se o arquivo exato não for encontrado por variação de encoding/caracteres,
    # procura por qualquer arquivo que comece com o prefixo do ID do download
    if not file_path.exists() or not file_path.is_file():
        uuid_match = re.match(r"^([a-f0-9\-]{36})_", safe_name)
        if uuid_match:
            download_id = uuid_match.group(1)
            matching = list(Path(settings.DOWNLOAD_DIR).glob(f"{download_id}_*"))
            if matching and matching[0].is_file():
                file_path = matching[0]
                safe_name = file_path.name

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Arquivo não encontrado ou já expirado pelo sistema de limpeza.")

    if safe_name.endswith(".zip"):
        media_type = "application/zip"
    elif safe_name.endswith(".mp3"):
        media_type = "audio/mpeg"
    else:
        media_type = "video/mp4"

    # Remove o prefixo do UUID do nome do arquivo salvo no dispositivo do usuário
    display_name = re.sub(r"^[a-f0-9\-]{36}_", "", safe_name) or safe_name

    # Formata cabeçalho Content-Disposition 100% compatível com RFC 6266 / RFC 5987.
    # Uvicorn/Starlette exigem que headers brutos sejam codificáveis em latin-1.
    # ascii_fallback garante compatibilidade, e filename*=UTF-8'' preserva acentuação completa nos navegadores.
    ascii_fallback = re.sub(r"[^\x20-\x7E]", "", display_name).replace('"', "").strip()
    if not ascii_fallback:
        ascii_fallback = "download" + Path(safe_name).suffix
    encoded_name = quote(display_name, encoding="utf-8")
    content_disposition = f'attachment; filename="{ascii_fallback}"; filename*=UTF-8\'\'{encoded_name}'

    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        headers={"Content-Disposition": content_disposition}
    )


@app.post("/api/cleanup")
def trigger_cleanup(authorized: bool = Depends(verify_secret_key)):
    """Dispara a limpeza de arquivos expirados manualmente."""
    removed = cleanup_old_files()
    return {"message": "Limpeza executada com sucesso.", "files_removed": removed}

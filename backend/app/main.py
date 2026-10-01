import os
import uuid
import logging
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, HTTPException, Header, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from celery.result import AsyncResult

from app.config import settings
from app.schemas import DownloadRequest, DownloadResponse, DownloadStatus, HealthResponse
from app.celery_app import celery_app
from app.tasks import process_media_download, execute_download, cleanup_old_files
from app.supabase_client import get_supabase, create_download_record

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
        if celery_app.control.ping(timeout=0.3):
            use_celery = True
    except Exception:
        use_celery = False

    if use_celery:
        logger.info(f"Enfileirando {download_id} no Celery (Worker VPS)")
        task = process_media_download.apply_async(
            args=[
                download_id,
                request.url,
                request.format,
                request.quality or "standard",
                request.is_playlist
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
            request.is_playlist
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
    """Consulta o status da tarefa no Supabase ou Celery."""
    # 1. Consulta no Supabase (fonte da verdade)
    client = get_supabase()
    if client:
        try:
            res = client.table("media_downloads").select("*").eq("id", download_id).execute()
            if res.data:
                item = res.data[0]
                return DownloadStatus(
                    id=download_id,
                    status=item.get("status", "pending"),
                    progress=item.get("progress", 0),
                    title=item.get("title"),
                    thumbnail=item.get("thumbnail"),
                    download_url=item.get("download_url"),
                    filename=item.get("filename"),
                    file_size=item.get("file_size"),
                    error_message=item.get("error_message")
                )
        except Exception as e:
            logger.error(f"Erro ao consultar status no Supabase: {e}")

    # 2. Fallback Celery
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
            meta = task_res.info or {}
            return DownloadStatus(
                id=download_id,
                status="processing",
                progress=meta.get("progress", 50)
            )
    except Exception:
        pass

    return DownloadStatus(
        id=download_id,
        status="pending",
        progress=0
    )


@app.get("/api/files/{filename}")
def download_file(filename: str):
    """Entrega o arquivo baixado com suporte a download direto no navegador."""
    safe_name = os.path.basename(filename)
    file_path = Path(settings.DOWNLOAD_DIR) / safe_name

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Arquivo não encontrado ou já expirado pelo sistema de limpeza.")

    if safe_name.endswith(".zip"):
        media_type = "application/zip"
    elif safe_name.endswith(".mp3"):
        media_type = "audio/mpeg"
    else:
        media_type = "video/mp4"

    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=safe_name,
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'}
    )


@app.post("/api/cleanup")
def trigger_cleanup(authorized: bool = Depends(verify_secret_key)):
    """Dispara a limpeza de arquivos expirados manualmente."""
    removed = cleanup_old_files()
    return {"message": "Limpeza executada com sucesso.", "files_removed": removed}

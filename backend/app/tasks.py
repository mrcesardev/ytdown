import os
import re
import time
import zipfile
import shutil
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional

import yt_dlp
from app.celery_app import celery_app
from app.config import settings
from app.supabase_client import update_download_record

logger = logging.getLogger(__name__)


def sanitize_filename(name: str) -> str:
    """Remove caracteres inválidos do nome do arquivo."""
    name = re.sub(r'[\\/*?:"<>|]', "", name)
    name = name.strip().replace(" ", "_")
    return name[:100]  # Limita tamanho para evitar erros de path


def execute_download(
    download_id: str,
    url: str,
    format_type: str = "mp3",
    quality: str = "standard",
    is_playlist: bool = False,
    task_instance=None
) -> Dict[str, Any]:
    """
    Função principal de download e conversão.
    Pode ser executada pelo Celery (em produção com Redis) ou diretamente pelo FastAPI (em desenvolvimento local).
    """
    logger.info(f"Processando download {download_id} para {url} (formato: {format_type}, qualidade: {quality}, playlist: {is_playlist})")
    
    update_download_record(download_id, {
        "status": "processing",
        "progress": 5
    })

    last_progress_time = 0.0
    last_progress_val = 0

    def progress_hook(d: Dict[str, Any]):
        nonlocal last_progress_time, last_progress_val
        if d.get("status") == "downloading":
            now = time.time()
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            downloaded = d.get("downloaded_bytes") or 0
            if total > 0:
                percent = int((downloaded / total) * 100)
                if (percent - last_progress_val >= 10 or (now - last_progress_time > 2.5)) and percent > last_progress_val:
                    last_progress_val = percent
                    last_progress_time = now
                    update_download_record(download_id, {"progress": min(percent, 90)})
                    if task_instance:
                        task_instance.update_state(state="PROGRESS", meta={"progress": percent})

    download_dir = Path(settings.DOWNLOAD_DIR)
    download_dir.mkdir(parents=True, exist_ok=True)

    # Configuração de qualidade
    if format_type == "mp3":
        # 320 kbps para cadastrados, 128 kbps padrão
        bitrate = "320" if quality == "high" else "128"
        audio_opts = [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": bitrate,
            }
        ]
        format_spec = "bestaudio/best"
    else:  # mp4
        audio_opts = []
        if quality == "high":
            format_spec = "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"
        else:
            format_spec = "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best"

    if is_playlist:
        playlist_subfolder = download_dir / f"pl_{download_id}"
        playlist_subfolder.mkdir(parents=True, exist_ok=True)
        output_template = str(playlist_subfolder / "%(playlist_index)s - %(title).80s.%(ext)s")
    else:
        playlist_subfolder = None
        output_template = str(download_dir / f"{download_id}_%(title).100s.%(ext)s")

    ydl_opts: Dict[str, Any] = {
        "outtmpl": output_template,
        "progress_hooks": [progress_hook],
        "quiet": True,
        "no_warnings": True,
        "noplaylist": not is_playlist,
        "socket_timeout": 30,
        "retries": 5,
        "format": format_spec,
    }

    if audio_opts:
        ydl_opts["postprocessors"] = audio_opts
    if format_type == "mp4":
        ydl_opts["merge_output_format"] = "mp4"

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if not info:
                raise ValueError("Não foi possível extrair metadados da URL.")

            title = info.get("title", "playlist" if is_playlist else "video")
            thumbnail = info.get("thumbnail")
            
            update_download_record(download_id, {
                "title": title,
                "thumbnail": thumbnail,
                "progress": 20
            })

            ydl.download([url])

        # Se for playlist, compacta em um único arquivo .zip
        if is_playlist and playlist_subfolder and playlist_subfolder.exists():
            zip_filename = f"{download_id}_{sanitize_filename(title)}.zip"
            zip_filepath = download_dir / zip_filename

            with zipfile.ZipFile(zip_filepath, "w", zipfile.ZIP_DEFLATED) as zipf:
                for file_in_pl in playlist_subfolder.glob("*"):
                    if file_in_pl.is_file():
                        zipf.write(file_in_pl, arcname=file_in_pl.name)

            shutil.rmtree(playlist_subfolder, ignore_errors=True)
            final_file = zip_filepath
        else:
            target_ext = "mp3" if format_type == "mp3" else "mp4"
            generated_files = list(download_dir.glob(f"{download_id}_*.{target_ext}"))
            if not generated_files:
                generated_files = list(download_dir.glob(f"{download_id}_*"))
                if not generated_files:
                    raise FileNotFoundError(f"Arquivo final com id {download_id} não encontrado no disco.")
            final_file = generated_files[0]

        filename = final_file.name
        file_size = final_file.stat().st_size
        download_url = f"{settings.BASE_URL.rstrip('/')}/api/files/{filename}"

        update_download_record(download_id, {
            "status": "completed",
            "progress": 100,
            "filename": filename,
            "file_path": str(final_file),
            "file_size": file_size,
            "download_url": download_url,
            "completed_at": datetime.now(timezone.utc).isoformat()
        })

        logger.info(f"Download {download_id} concluído: {filename} ({file_size} bytes)")
        return {
            "id": download_id,
            "status": "completed",
            "title": title,
            "filename": filename,
            "download_url": download_url,
            "file_size": file_size
        }

    except Exception as exc:
        error_msg = str(exc)
        logger.error(f"Erro no processamento do download {download_id}: {error_msg}")
        update_download_record(download_id, {
            "status": "failed",
            "error_message": error_msg[:500]
        })
        raise exc


@celery_app.task(bind=True, name="app.tasks.process_media_download")
def process_media_download(
    self,
    download_id: str,
    url: str,
    format_type: str = "mp3",
    quality: str = "standard",
    is_playlist: bool = False
) -> Dict[str, Any]:
    """Worker Celery em produção."""
    return execute_download(
        download_id=download_id,
        url=url,
        format_type=format_type,
        quality=quality,
        is_playlist=is_playlist,
        task_instance=self
    )


@celery_app.task(name="app.tasks.cleanup_old_files")
def cleanup_old_files() -> int:
    """Remove arquivos temporários com tempo de vida superior a MAX_FILE_AGE_HOURS."""
    download_dir = Path(settings.DOWNLOAD_DIR)
    if not download_dir.exists():
        return 0

    now = time.time()
    cutoff_seconds = settings.MAX_FILE_AGE_HOURS * 3600
    removed_count = 0

    for file_path in download_dir.iterdir():
        if file_path.is_file():
            try:
                mtime = file_path.stat().st_mtime
                if now - mtime > cutoff_seconds:
                    file_path.unlink()
                    removed_count += 1
            except Exception as e:
                logger.error(f"Erro ao remover arquivo {file_path.name}: {e}")

    logger.info(f"Limpeza de disco concluída: {removed_count} arquivos removidos.")
    return removed_count

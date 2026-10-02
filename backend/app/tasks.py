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


def extract_media_info(url: str) -> Dict[str, Any]:
    """Extrai informações da mídia (vídeo ou playlist) rapidamente sem baixar."""
    ydl_opts: Dict[str, Any] = {
        "extract_flat": "in_playlist",
        "skip_download": True,
        "quiet": True,
        "no_warnings": True,
        "socket_timeout": 15,
    }

    def format_duration(seconds: Optional[int]) -> Optional[str]:
        if not seconds:
            return None
        seconds = int(seconds)
        mins, secs = divmod(seconds, 60)
        hrs, mins = divmod(mins, 60)
        if hrs > 0:
            return f"{hrs:d}:{mins:02d}:{secs:02d}"
        return f"{mins:02d}:{secs:02d}"

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        if not info:
            raise ValueError("Não foi possível extrair metadados da URL informada.")

        is_playlist = info.get("_type") == "playlist" or "entries" in info

        if is_playlist:
            raw_entries = info.get("entries") or []
            entries = []
            for i, entry in enumerate(raw_entries, 1):
                if not entry:
                    continue
                v_id = entry.get("id") or str(i)
                v_url = entry.get("url")
                if not v_url or not v_url.startswith("http"):
                    v_url = f"https://www.youtube.com/watch?v={v_id}"

                v_thumb = entry.get("thumbnail")
                if not v_thumb and entry.get("thumbnails"):
                    v_thumb = entry.get("thumbnails")[-1].get("url")
                if not v_thumb and v_id:
                    v_thumb = f"https://i.ytimg.com/vi/{v_id}/hqdefault.jpg"

                entries.append({
                    "index": i,
                    "id": v_id,
                    "title": entry.get("title") or f"Vídeo {i}",
                    "duration": entry.get("duration"),
                    "duration_formatted": format_duration(entry.get("duration")),
                    "thumbnail": v_thumb,
                    "url": v_url,
                })

            pl_thumb = info.get("thumbnail")
            if not pl_thumb and entries:
                pl_thumb = entries[0].get("thumbnail")

            return {
                "url": url,
                "title": info.get("title") or "Playlist do YouTube",
                "thumbnail": pl_thumb,
                "duration": None,
                "duration_formatted": None,
                "uploader": info.get("uploader") or info.get("channel"),
                "is_playlist": True,
                "entries": entries,
                "total_entries": len(entries),
            }
        else:
            # Vídeo individual
            duration = info.get("duration")
            thumbnail = info.get("thumbnail")
            if not thumbnail and info.get("thumbnails"):
                thumbnail = info.get("thumbnails")[-1].get("url")
            if not thumbnail and info.get("id"):
                thumbnail = f"https://i.ytimg.com/vi/{info['id']}/hqdefault.jpg"

            return {
                "url": url,
                "title": info.get("title") or "Vídeo do YouTube",
                "thumbnail": thumbnail,
                "duration": duration,
                "duration_formatted": format_duration(duration),
                "uploader": info.get("uploader") or info.get("channel"),
                "is_playlist": False,
                "entries": None,
                "total_entries": 1,
            }


def execute_download(
    download_id: str,
    url: str,
    format_type: str = "mp3",
    quality: str = "standard",
    is_playlist: bool = False,
    selected_urls: Optional[list] = None,
    playlist_title: Optional[str] = None,
    task_instance=None
) -> Dict[str, Any]:
    """
    Função principal de download e conversão.
    Pode ser executada pelo Celery (em produção com Redis) ou diretamente pelo FastAPI (em desenvolvimento local).
    """
    logger.info(f"Processando download {download_id} para {url} (formato: {format_type}, qualidade: {quality}, playlist: {is_playlist}, selecionados: {len(selected_urls) if selected_urls else 'todos'})")
    
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

    # Se for playlist, garante limite de no máximo 5 itens
    safe_selected_urls = None
    if is_playlist and selected_urls:
        safe_selected_urls = [u for u in selected_urls if isinstance(u, str) and u.strip()][:5]

    if is_playlist:
        playlist_subfolder = download_dir / f"pl_{download_id}"
        playlist_subfolder.mkdir(parents=True, exist_ok=True)
        output_template = str(playlist_subfolder / "%(autonumber)02d - %(title).80s.%(ext)s")
    else:
        playlist_subfolder = None
        output_template = str(download_dir / f"{download_id}_%(title).100s.%(ext)s")

    ydl_opts: Dict[str, Any] = {
        "outtmpl": output_template,
        "progress_hooks": [progress_hook],
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True if safe_selected_urls else (not is_playlist),
        "socket_timeout": 30,
        "retries": 5,
        "format": format_spec,
    }

    if audio_opts:
        ydl_opts["postprocessors"] = audio_opts
    if format_type == "mp4":
        ydl_opts["merge_output_format"] = "mp4"

    try:
        title = playlist_title or ("playlist" if is_playlist else "video")
        thumbnail = None

        if safe_selected_urls:
            # Baixa a lista de URLs selecionadas (até 5)
            update_download_record(download_id, {
                "title": title,
                "progress": 15
            })
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download(safe_selected_urls)
        else:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                if not info:
                    raise ValueError("Não foi possível extrair metadados da URL.")

                title = playlist_title or info.get("title", "playlist" if is_playlist else "video")
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
    is_playlist: bool = False,
    selected_urls: Optional[list] = None,
    playlist_title: Optional[str] = None
) -> Dict[str, Any]:
    """Worker Celery em produção."""
    return execute_download(
        download_id=download_id,
        url=url,
        format_type=format_type,
        quality=quality,
        is_playlist=is_playlist,
        selected_urls=selected_urls,
        playlist_title=playlist_title,
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

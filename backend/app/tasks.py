import os
import re
import time
import zipfile
import shutil
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional
from urllib.parse import quote

import requests
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


def safe_int_duration(val: Any) -> Optional[int]:
    """Converte qualquer formato de duração (float, int, string) para segundos inteiros."""
    if val is None:
        return None
    try:
        return int(round(float(val)))
    except (ValueError, TypeError):
        return None


def format_duration(seconds: Any) -> Optional[str]:
    """Formata duração em segundos para string legível (MM:SS ou HH:MM:SS)."""
    secs = safe_int_duration(seconds)
    if not secs:
        return None
    mins, s = divmod(secs, 60)
    hrs, mins = divmod(mins, 60)
    if hrs > 0:
        return f"{hrs:d}:{mins:02d}:{s:02d}"
    return f"{mins:02d}:{s:02d}"


def is_tiktok_url(url: str) -> bool:
    """Detecta se a URL pertence ao TikTok."""
    if not url:
        return False
    u = url.lower().strip()
    return "tiktok.com" in u or "douyin.com" in u


def extract_tiktok_info(url: str) -> Dict[str, Any]:
    """Extrai metadados do vídeo do TikTok via TikWM API (sem marca d'água)."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept": "application/json",
    }
    resp = requests.post("https://www.tikwm.com/api/", data={"url": url.strip()}, headers=headers, timeout=12)
    if resp.status_code != 200:
        raise ValueError(f"TikWM retornou HTTP {resp.status_code}")
    res_json = resp.json()
    if res_json.get("code") != 0 or not res_json.get("data"):
        raise ValueError(res_json.get("msg") or "Não foi possível extrair dados deste vídeo do TikTok.")

    d = res_json["data"]
    title = d.get("title") or f"TikTok_{d.get('id', 'video')}"
    duration = safe_int_duration(d.get("duration"))
    uploader = d.get("author", {}).get("nickname") or d.get("author", {}).get("unique_id") or "TikTok Creator"
    cover = d.get("cover") or d.get("origin_cover")

    return {
        "url": url,
        "title": title,
        "thumbnail": cover,
        "duration": duration,
        "duration_formatted": format_duration(duration),
        "uploader": uploader,
        "is_playlist": False,
        "entries": None,
        "total_entries": 1,
    }


def download_tiktok_media(
    download_id: str,
    url: str,
    format_type: str,
    quality: str,
    download_dir: Path,
    task_instance: Optional[Any] = None
) -> Dict[str, Any]:
    """Baixa vídeo sem marca d'água ou extrai áudio MP3 de um TikTok."""
    update_download_record(download_id, {
        "status": "processing",
        "progress": 15
    })

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept": "application/json",
    }
    resp = requests.post("https://www.tikwm.com/api/", data={"url": url.strip()}, headers=headers, timeout=15)
    if resp.status_code != 200:
        raise ValueError(f"TikWM retornou HTTP {resp.status_code}")
    res_json = resp.json()
    if res_json.get("code") != 0 or not res_json.get("data"):
        raise ValueError(res_json.get("msg") or "Falha ao obter link de download do TikTok.")

    d = res_json["data"]
    raw_title = d.get("title") or f"TikTok_{d.get('id', download_id)}"
    clean_title = sanitize_filename(raw_title) or f"tiktok_{download_id[:8]}"
    thumbnail = d.get("cover")

    update_download_record(download_id, {
        "title": raw_title,
        "thumbnail": thumbnail,
        "progress": 30
    })

    if format_type == "mp3":
        target_ext = "mp3"
        final_file = download_dir / f"{download_id}_{clean_title}.mp3"
        stream_url = d.get("music") or d.get("play")
    else:
        target_ext = "mp4"
        final_file = download_dir / f"{download_id}_{clean_title}.mp4"
        stream_url = d.get("hdplay") or d.get("play")

    if not stream_url:
        raise ValueError("URL do fluxo de mídia não encontrada para este vídeo do TikTok.")

    if stream_url.startswith("/"):
        stream_url = f"https://www.tikwm.com{stream_url}"

    update_download_record(download_id, {"progress": 40})

    with requests.get(stream_url, stream=True, timeout=60, headers={"User-Agent": "Mozilla/5.0"}) as stream_resp:
        if stream_resp.status_code != 200:
            raise ValueError(f"Falha ao baixar fluxo de mídia do TikTok: HTTP {stream_resp.status_code}")

        total_len = stream_resp.headers.get("content-length")
        total_bytes = int(total_len) if total_len and total_len.isdigit() else 0
        downloaded = 0
        last_progress_time = time.time()

        with open(final_file, "wb") as f:
            for chunk in stream_resp.iter_content(chunk_size=65536):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total_bytes > 0:
                        now = time.time()
                        if now - last_progress_time > 1.5:
                            last_progress_time = now
                            pct = min(int(40 + (downloaded / total_bytes) * 50), 90)
                            update_download_record(download_id, {"progress": pct})
                            if task_instance:
                                task_instance.update_state(state="PROGRESS", meta={"progress": pct})

    filename = final_file.name
    file_size = final_file.stat().st_size
    download_url = f"{settings.BASE_URL.rstrip('/')}/api/files/{quote(filename)}"

    update_download_record(download_id, {
        "status": "completed",
        "progress": 100,
        "filename": filename,
        "file_path": str(final_file),
        "file_size": file_size,
        "download_url": download_url,
        "completed_at": datetime.now(timezone.utc).isoformat()
    })

    logger.info(f"Download TikTok {download_id} concluído com sucesso: {filename} ({file_size} bytes)")
    return {
        "id": download_id,
        "status": "completed",
        "title": raw_title,
        "filename": filename,
        "download_url": download_url,
        "file_size": file_size
    }


def is_instagram_url(url: str) -> bool:
    """Detecta se a URL pertence ao Instagram."""
    if not url:
        return False
    u = url.lower().strip()
    return "instagram.com" in u or "instagr.am" in u


def clean_instagram_url(url: str) -> str:
    """Remove parâmetros de rastreamento do Instagram (igsh, utm_source, etc.)."""
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url.strip())
        return f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
    except Exception:
        return url.split("?")[0].strip()


def extract_instagram_info(url: str) -> Dict[str, Any]:
    """Extrai metadados do Reels ou Post do Instagram via yt-dlp (com suporte a cookies se disponíveis)."""
    clean_url = clean_instagram_url(url)
    ydl_opts: Dict[str, Any] = {
        "skip_download": True,
        "quiet": True,
        "no_warnings": True,
        "socket_timeout": 15,
    }
    cookies_path = settings.resolved_cookies_file
    if cookies_path:
        ydl_opts["cookiefile"] = cookies_path

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(clean_url, download=False)
            if not info:
                raise ValueError("Não foi possível extrair dados desta publicação do Instagram.")

            title = info.get("title") or info.get("description") or f"Instagram_{info.get('id', 'media')}"
            if len(title) > 90:
                title = title[:90] + "..."
            duration = safe_int_duration(info.get("duration"))
            uploader = info.get("uploader") or info.get("channel") or "Instagram"
            thumbnail = info.get("thumbnail")
            if not thumbnail and info.get("thumbnails"):
                thumbnail = info.get("thumbnails")[-1].get("url")

            return {
                "url": clean_url,
                "title": title,
                "thumbnail": thumbnail,
                "duration": duration,
                "duration_formatted": format_duration(duration),
                "uploader": uploader,
                "is_playlist": False,
                "entries": None,
                "total_entries": 1,
            }
    except Exception as e:
        err_msg = str(e)
        if "empty media response" in err_msg.lower() or "login" in err_msg.lower() or "granting access" in err_msg.lower():
            raise ValueError(
                "O Instagram requer autenticação para acessar esta mídia. "
                "Para liberar downloads do Instagram, insira um arquivo cookies.txt na pasta backend ou configure a variável COOKIES_FILE."
            )
        raise ValueError(f"Erro ao processar link do Instagram: {err_msg}")


def download_instagram_media(
    download_id: str,
    url: str,
    format_type: str,
    quality: str,
    download_dir: Path,
    task_instance: Optional[Any] = None
) -> Dict[str, Any]:
    """Baixa Reel/Post do Instagram em MP4 ou extrai em áudio MP3."""
    clean_url = clean_instagram_url(url)
    update_download_record(download_id, {
        "status": "processing",
        "progress": 15
    })

    cookies_path = settings.resolved_cookies_file
    output_template = str(download_dir / f"{download_id}_%(title).100s.%(ext)s")

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
                if (percent - last_progress_val >= 10 or (now - last_progress_time > 2.0)) and percent > last_progress_val:
                    last_progress_val = percent
                    last_progress_time = now
                    update_download_record(download_id, {"progress": min(max(percent, 20), 90)})
                    if task_instance:
                        task_instance.update_state(state="PROGRESS", meta={"progress": percent})

    ydl_opts: Dict[str, Any] = {
        "outtmpl": output_template,
        "progress_hooks": [progress_hook],
        "quiet": True,
        "no_warnings": True,
        "socket_timeout": 30,
    }
    if cookies_path:
        ydl_opts["cookiefile"] = cookies_path

    if format_type == "mp3":
        audio_bitrate = "320" if quality == "high" else "128"
        ydl_opts.update({
            "format": "bestaudio/best",
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": audio_bitrate,
                },
                {"key": "FFmpegMetadata"},
            ],
        })
    else:
        ydl_opts.update({
            "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            "merge_output_format": "mp4",
        })

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(clean_url, download=True)
            if not info:
                raise ValueError("Falha ao baixar mídia do Instagram.")

            raw_title = info.get("title") or info.get("description") or f"Instagram_{download_id[:8]}"
            if len(raw_title) > 90:
                raw_title = raw_title[:90] + "..."
            thumbnail = info.get("thumbnail")
            target_ext = "mp3" if format_type == "mp3" else "mp4"

            # Localiza o arquivo baixado
            matching_files = list(download_dir.glob(f"{download_id}_*.{target_ext}"))
            if not matching_files:
                matching_files = list(download_dir.glob(f"{download_id}_*.*"))

            if not matching_files:
                raise FileNotFoundError("Arquivo baixado do Instagram não foi localizado.")

            final_file = matching_files[0]
            filename = final_file.name
            file_size = final_file.stat().st_size
            download_url = f"{settings.BASE_URL.rstrip('/')}/api/files/{quote(filename)}"

            update_download_record(download_id, {
                "title": raw_title,
                "thumbnail": thumbnail,
                "status": "completed",
                "progress": 100,
                "filename": filename,
                "file_path": str(final_file),
                "file_size": file_size,
                "download_url": download_url,
                "completed_at": datetime.now(timezone.utc).isoformat()
            })

            logger.info(f"Download Instagram {download_id} concluído com sucesso: {filename} ({file_size} bytes)")
            return {
                "id": download_id,
                "status": "completed",
                "title": raw_title,
                "filename": filename,
                "download_url": download_url,
                "file_size": file_size
            }
    except Exception as e:
        err_msg = str(e)
        if "empty media response" in err_msg.lower() or "login" in err_msg.lower() or "granting access" in err_msg.lower():
            friendly_err = (
                "O Instagram exige cookies de autenticação para este conteúdo. "
                "Adicione seu cookies.txt na pasta backend para baixar qualquer Reel ou vídeo do Instagram."
            )
            update_download_record(download_id, {
                "status": "failed",
                "error_message": friendly_err
            })
            raise ValueError(friendly_err)
        update_download_record(download_id, {
            "status": "failed",
            "error_message": err_msg
        })
        raise


def is_twitter_url(url: str) -> bool:
    """Detecta se a URL pertence ao X (Twitter)."""
    if not url:
        return False
    u = url.lower().strip()
    return "twitter.com" in u or "x.com" in u or "t.co" in u


def clean_twitter_url(url: str) -> str:
    """Remove parâmetros de rastreamento do X / Twitter (s, t, ref_src, etc.)."""
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url.strip())
        return f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
    except Exception:
        return url.split("?")[0].strip()


def extract_twitter_info(url: str) -> Dict[str, Any]:
    """Extrai metadados do post/vídeo do X (Twitter) via API FxTwitter ou yt-dlp."""
    clean_url = clean_twitter_url(url)

    # 1. Estratégia primária: API FxTwitter (rápida, estável e livre de rate-limits de guest token)
    match = re.search(r'(?:twitter\.com|x\.com)/(?:i|[a-zA-Z0-9_]+)/status/(\d+)', clean_url)
    if match:
        tweet_id = match.group(1)
        try:
            resp = requests.get(
                f"https://api.fxtwitter.com/i/status/{tweet_id}",
                headers={"User-Agent": "YtDown/1.0"},
                timeout=10
            )
            if resp.status_code == 200:
                data = resp.json()
                tweet = data.get("tweet") or {}
                media = tweet.get("media") or {}
                videos = media.get("videos") or []

                if not videos:
                    raise ValueError(
                        "Nenhum vídeo ou GIF foi encontrado nesta publicação do X (Twitter). "
                        "Certifique-se de que a publicação contém um vídeo."
                    )

                v = videos[0]
                raw_title = tweet.get("text") or f"X_{tweet_id}"
                if len(raw_title) > 90:
                    raw_title = raw_title[:90] + "..."
                raw_title = raw_title.replace("\n", " ").strip()
                duration = safe_int_duration(v.get("duration"))
                uploader = tweet.get("author", {}).get("name") or tweet.get("author", {}).get("screen_name") or "X (Twitter)"
                thumbnail = v.get("thumbnail_url")

                return {
                    "url": clean_url,
                    "title": raw_title,
                    "thumbnail": thumbnail,
                    "duration": duration,
                    "duration_formatted": format_duration(duration),
                    "uploader": uploader,
                    "is_playlist": False,
                    "entries": None,
                    "total_entries": 1,
                }
            elif resp.status_code == 404:
                raise ValueError("Publicação não encontrada no X (Twitter). Verifique se o link está correto ou se o post foi apagado.")
            elif resp.status_code == 401:
                raise ValueError("Esta publicação do X (Twitter) pertence a uma conta privada ou requer login.")
        except ValueError:
            raise
        except Exception as e:
            logger.warning(f"FxTwitter falhou, tentando fallback com yt-dlp para {clean_url}: {e}")

    # 2. Fallback: yt-dlp
    ydl_opts: Dict[str, Any] = {
        "skip_download": True,
        "quiet": True,
        "no_warnings": True,
        "socket_timeout": 15,
    }
    cookies_path = settings.resolved_cookies_file
    if cookies_path:
        ydl_opts["cookiefile"] = cookies_path

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(clean_url, download=False)
            if not info:
                raise ValueError("Não foi possível extrair dados desta publicação do X (Twitter).")

            raw_title = info.get("title") or info.get("description") or f"X_{info.get('id', 'media')}"
            if len(raw_title) > 90:
                raw_title = raw_title[:90] + "..."
            duration = safe_int_duration(info.get("duration"))
            uploader = info.get("uploader") or info.get("channel") or info.get("uploader_id") or "X (Twitter)"
            thumbnail = info.get("thumbnail")
            if not thumbnail and info.get("thumbnails"):
                thumbnail = info.get("thumbnails")[-1].get("url")

            return {
                "url": clean_url,
                "title": raw_title,
                "thumbnail": thumbnail,
                "duration": duration,
                "duration_formatted": format_duration(duration),
                "uploader": uploader,
                "is_playlist": False,
                "entries": None,
                "total_entries": 1,
            }
    except Exception as e:
        err_msg = str(e)
        if "no video could be found" in err_msg.lower():
            raise ValueError(
                "Nenhum vídeo foi encontrado nesta publicação do X (Twitter). "
                "Certifique-se de que a publicação contém um vídeo ou GIF."
            )
        if "login" in err_msg.lower() or "authorization" in err_msg.lower():
            raise ValueError(
                "Este conteúdo do X (Twitter) requer autenticação ou pertence a uma conta privada."
            )
        raise ValueError(f"Erro ao processar link do X (Twitter): {err_msg}")


def download_twitter_media(
    download_id: str,
    url: str,
    format_type: str,
    quality: str,
    download_dir: Path,
    task_instance: Optional[Any] = None
) -> Dict[str, Any]:
    """Baixa vídeo do X (Twitter) em MP4 ou extrai em áudio MP3."""
    clean_url = clean_twitter_url(url)
    update_download_record(download_id, {
        "status": "processing",
        "progress": 15
    })

    # 1. Tenta baixar diretamente usando os streams do FxTwitter
    match = re.search(r'(?:twitter\.com|x\.com)/(?:i|[a-zA-Z0-9_]+)/status/(\d+)', clean_url)
    if match:
        tweet_id = match.group(1)
        temp_mp4 = download_dir / f"temp_{download_id}.mp4"
        try:
            resp = requests.get(
                f"https://api.fxtwitter.com/i/status/{tweet_id}",
                headers={"User-Agent": "YtDown/1.0"},
                timeout=12
            )
            if resp.status_code == 200:
                data = resp.json()
                tweet = data.get("tweet") or {}
                videos = tweet.get("media", {}).get("videos", [])
                if not videos:
                    raise ValueError("Nenhum vídeo ou GIF encontrado nesta publicação do X (Twitter).")

                v = videos[0]
                formats = v.get("formats", [])
                mp4_formats = [f for f in formats if f.get("container") == "mp4" or "mp4" in f.get("url", "")]
                if mp4_formats:
                    mp4_formats.sort(key=lambda x: x.get("bitrate", 0), reverse=True)
                    video_stream_url = mp4_formats[0].get("url")
                else:
                    video_stream_url = v.get("url")

                if video_stream_url:
                    raw_title = tweet.get("text") or f"X_{tweet_id}"
                    if len(raw_title) > 90:
                        raw_title = raw_title[:90] + "..."
                    raw_title = raw_title.replace("\n", " ").strip()
                    clean_title = sanitize_filename(raw_title) or f"x_{download_id[:8]}"
                    thumbnail = v.get("thumbnail_url")

                    update_download_record(download_id, {
                        "title": raw_title,
                        "thumbnail": thumbnail,
                        "progress": 25
                    })

                    with requests.get(video_stream_url, stream=True, timeout=60, headers={"User-Agent": "Mozilla/5.0"}) as stream_resp:
                        stream_resp.raise_for_status()
                        total_len = stream_resp.headers.get("content-length")
                        total_bytes = int(total_len) if total_len and total_len.isdigit() else 0
                        downloaded = 0
                        last_progress_time = time.time()

                        with open(temp_mp4, "wb") as f:
                            for chunk in stream_resp.iter_content(chunk_size=65536):
                                if chunk:
                                    f.write(chunk)
                                    downloaded += len(chunk)
                                    if total_bytes > 0:
                                        now = time.time()
                                        if now - last_progress_time > 1.5:
                                            last_progress_time = now
                                            pct = min(int(25 + (downloaded / total_bytes) * 60), 85)
                                            update_download_record(download_id, {"progress": pct})
                                            if task_instance:
                                                task_instance.update_state(state="PROGRESS", meta={"progress": pct})

                    if format_type == "mp3":
                        final_file = download_dir / f"{download_id}_{clean_title}.mp3"
                        audio_bitrate = "320k" if quality == "high" else "128k"
                        update_download_record(download_id, {"progress": 90})
                        import subprocess
                        subprocess.run(
                            ["ffmpeg", "-y", "-i", str(temp_mp4), "-vn", "-c:a", "libmp3lame", "-b:a", audio_bitrate, str(final_file)],
                            check=True,
                            stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL
                        )
                        if temp_mp4.exists():
                            temp_mp4.unlink()
                    else:
                        final_file = download_dir / f"{download_id}_{clean_title}.mp4"
                        if temp_mp4.exists():
                            if final_file.exists():
                                final_file.unlink()
                            temp_mp4.rename(final_file)

                    filename = final_file.name
                    file_size = final_file.stat().st_size
                    download_url = f"{settings.BASE_URL.rstrip('/')}/api/files/{quote(filename)}"

                    update_download_record(download_id, {
                        "status": "completed",
                        "progress": 100,
                        "filename": filename,
                        "file_path": str(final_file),
                        "file_size": file_size,
                        "download_url": download_url,
                        "completed_at": datetime.now(timezone.utc).isoformat()
                    })

                    logger.info(f"Download X (Twitter) {download_id} via FxTwitter concluído: {filename} ({file_size} bytes)")
                    return {
                        "id": download_id,
                        "status": "completed",
                        "title": raw_title,
                        "filename": filename,
                        "download_url": download_url,
                        "file_size": file_size
                    }
        except ValueError:
            if temp_mp4.exists():
                temp_mp4.unlink()
            raise
        except Exception as e:
            logger.warning(f"Download direto via FxTwitter falhou ({e}), tentando fallback via yt-dlp...")
            if temp_mp4.exists():
                temp_mp4.unlink()

    # 2. Fallback: yt-dlp
    cookies_path = settings.resolved_cookies_file
    output_template = str(download_dir / f"{download_id}_%(title).100s.%(ext)s")

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
                if (percent - last_progress_val >= 10 or (now - last_progress_time > 2.0)) and percent > last_progress_val:
                    last_progress_val = percent
                    last_progress_time = now
                    update_download_record(download_id, {"progress": min(max(percent, 20), 90)})
                    if task_instance:
                        task_instance.update_state(state="PROGRESS", meta={"progress": percent})

    ydl_opts: Dict[str, Any] = {
        "outtmpl": output_template,
        "progress_hooks": [progress_hook],
        "quiet": True,
        "no_warnings": True,
        "socket_timeout": 30,
    }
    if cookies_path:
        ydl_opts["cookiefile"] = cookies_path

    if format_type == "mp3":
        audio_bitrate = "320" if quality == "high" else "128"
        ydl_opts.update({
            "format": "bestaudio/best",
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": audio_bitrate,
                },
                {"key": "FFmpegMetadata"},
            ],
        })
    else:
        ydl_opts.update({
            "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            "merge_output_format": "mp4",
        })

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(clean_url, download=True)
            if not info:
                raise ValueError("Falha ao baixar mídia do X (Twitter).")

            raw_title = info.get("title") or info.get("description") or f"X_{download_id[:8]}"
            if len(raw_title) > 90:
                raw_title = raw_title[:90] + "..."
            thumbnail = info.get("thumbnail")
            target_ext = "mp3" if format_type == "mp3" else "mp4"

            matching_files = list(download_dir.glob(f"{download_id}_*.{target_ext}"))
            if not matching_files:
                matching_files = list(download_dir.glob(f"{download_id}_*.*"))

            if not matching_files:
                raise FileNotFoundError("Arquivo baixado do X (Twitter) não foi localizado.")

            final_file = matching_files[0]
            filename = final_file.name
            file_size = final_file.stat().st_size
            download_url = f"{settings.BASE_URL.rstrip('/')}/api/files/{quote(filename)}"

            update_download_record(download_id, {
                "title": raw_title,
                "thumbnail": thumbnail,
                "status": "completed",
                "progress": 100,
                "filename": filename,
                "file_path": str(final_file),
                "file_size": file_size,
                "download_url": download_url,
                "completed_at": datetime.now(timezone.utc).isoformat()
            })

            logger.info(f"Download X (Twitter) {download_id} concluído com sucesso: {filename} ({file_size} bytes)")
            return {
                "id": download_id,
                "status": "completed",
                "title": raw_title,
                "filename": filename,
                "download_url": download_url,
                "file_size": file_size
            }
    except Exception as e:
        err_msg = str(e)
        if "no video could be found" in err_msg.lower():
            friendly_err = "Nenhum vídeo foi encontrado nesta publicação do X (Twitter)."
            update_download_record(download_id, {
                "status": "failed",
                "error_message": friendly_err
            })
            raise ValueError(friendly_err)
        update_download_record(download_id, {
            "status": "failed",
            "error_message": err_msg
        })
        raise


def clean_youtube_url(url: str) -> str:
    """Remove parâmetros de mix/rádio automático (RD..., UL...) preservando o vídeo principal."""
    try:
        from urllib.parse import urlparse, parse_qs
        parsed = urlparse(url.strip())
        qs = parse_qs(parsed.query)
        if "v" in qs and "list" in qs:
            list_val = qs["list"][0]
            if list_val.startswith("RD") or list_val.startswith("UL"):
                return f"https://www.youtube.com/watch?v={qs['v'][0]}"
        if "youtu.be" in parsed.netloc and "list" in qs:
            list_val = qs["list"][0]
            if list_val.startswith("RD") or list_val.startswith("UL"):
                vid_id = parsed.path.lstrip("/")
                if vid_id:
                    return f"https://www.youtube.com/watch?v={vid_id}"
    except Exception:
        pass
    return url.strip()


def extract_media_info(url: str) -> Dict[str, Any]:
    """Extrai informações da mídia (vídeo ou playlist) rapidamente sem baixar."""
    if is_tiktok_url(url):
        return extract_tiktok_info(url)
    if is_instagram_url(url):
        return extract_instagram_info(url)
    if is_twitter_url(url):
        return extract_twitter_info(url)

    url = clean_youtube_url(url)
    ydl_opts: Dict[str, Any] = {
        "extract_flat": "in_playlist",
        "skip_download": True,
        "quiet": True,
        "no_warnings": True,
        "socket_timeout": 10,
        "playlistend": 15,  # Garante retorno rápido em playlists grandes
        "extractor_args": {
            "youtube": {
                "player_client": ["visionos", "android", "web"]
            }
        }
    }
    cookies_path = settings.resolved_cookies_file
    info = None
    try:
        # Tenta primeiro sem cookies (evita conflitos com sessões do Google e bloqueios anti-bot)
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except Exception as e:
        err_str = str(e).lower()
        if cookies_path and ("sign in" in err_str or "confirm your age" in err_str or "private" in err_str or "login" in err_str):
            logger.info("Vídeo restrito detectado no YouTube. Retentando com cookies...")
            ydl_opts_cookies = dict(ydl_opts)
            ydl_opts_cookies["cookiefile"] = cookies_path
            with yt_dlp.YoutubeDL(ydl_opts_cookies) as ydl:
                info = ydl.extract_info(url, download=False)
        else:
            raise

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
                "duration": safe_int_duration(entry.get("duration")),
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
        duration = safe_int_duration(info.get("duration"))
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
    if is_tiktok_url(url):
        download_dir = Path(settings.DOWNLOAD_DIR)
        download_dir.mkdir(parents=True, exist_ok=True)
        return download_tiktok_media(
            download_id=download_id,
            url=url,
            format_type=format_type,
            quality=quality,
            download_dir=download_dir,
            task_instance=task_instance,
        )

    if is_instagram_url(url):
        download_dir = Path(settings.DOWNLOAD_DIR)
        download_dir.mkdir(parents=True, exist_ok=True)
        return download_instagram_media(
            download_id=download_id,
            url=url,
            format_type=format_type,
            quality=quality,
            download_dir=download_dir,
            task_instance=task_instance,
        )

    if is_twitter_url(url):
        download_dir = Path(settings.DOWNLOAD_DIR)
        download_dir.mkdir(parents=True, exist_ok=True)
        return download_twitter_media(
            download_id=download_id,
            url=url,
            format_type=format_type,
            quality=quality,
            download_dir=download_dir,
            task_instance=task_instance,
        )

    url = clean_youtube_url(url)
    if is_playlist and ("list=" not in url or "list=RD" in url or "list=UL" in url):
        is_playlist = False

    if selected_urls:
        selected_urls = [clean_youtube_url(u) for u in selected_urls if isinstance(u, str)]

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
        "extractor_args": {
            "youtube": {
                "player_client": ["visionos", "android", "web"]
            }
        }
    }

    if audio_opts:
        ydl_opts["postprocessors"] = audio_opts
    if format_type == "mp4":
        ydl_opts["merge_output_format"] = "mp4"

    cookies_path = settings.resolved_cookies_file

    try:
        title = playlist_title or ("playlist" if is_playlist else "video")
        thumbnail = None

        if safe_selected_urls:
            # Baixa a lista de URLs selecionadas (até 5)
            update_download_record(download_id, {
                "title": title,
                "progress": 15
            })
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    ydl.download(safe_selected_urls)
            except Exception as e:
                err_str = str(e).lower()
                if cookies_path and ("sign in" in err_str or "confirm your age" in err_str or "private" in err_str or "login" in err_str):
                    logger.info("Playlist com itens restritos. Retentando download com cookies...")
                    ydl_opts_cookies = dict(ydl_opts)
                    ydl_opts_cookies["cookiefile"] = cookies_path
                    with yt_dlp.YoutubeDL(ydl_opts_cookies) as ydl:
                        ydl.download(safe_selected_urls)
                else:
                    raise
        else:
            try:
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
            except Exception as e:
                err_str = str(e).lower()
                if cookies_path and ("sign in" in err_str or "confirm your age" in err_str or "private" in err_str or "login" in err_str):
                    logger.info("Vídeo restrito detectado no YouTube. Retentando download com cookies...")
                    ydl_opts_cookies = dict(ydl_opts)
                    ydl_opts_cookies["cookiefile"] = cookies_path
                    with yt_dlp.YoutubeDL(ydl_opts_cookies) as ydl:
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
                else:
                    raise

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
        download_url = f"{settings.BASE_URL.rstrip('/')}/api/files/{quote(filename)}"

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

    # Arquivos protegidos que JAMAIS devem ser excluídos
    PROTECTED_FILES = {"cookies.txt", ".gitkeep"}

    for file_path in download_dir.iterdir():
        if file_path.is_file():
            # Não remove cookies de autenticação nem arquivos de controle do git
            if file_path.name in PROTECTED_FILES or file_path.suffix.lower() == ".txt":
                continue
            try:
                mtime = file_path.stat().st_mtime
                if now - mtime > cutoff_seconds:
                    file_path.unlink()
                    removed_count += 1
            except Exception as e:
                logger.error(f"Erro ao remover arquivo {file_path.name}: {e}")
        elif file_path.is_dir() and file_path.name.startswith("pl_"):
            try:
                mtime = file_path.stat().st_mtime
                if now - mtime > cutoff_seconds:
                    shutil.rmtree(file_path, ignore_errors=True)
                    removed_count += 1
            except Exception as e:
                logger.error(f"Erro ao remover pasta temporária {file_path.name}: {e}")

    logger.info(f"Limpeza de disco concluída: {removed_count} arquivos removidos.")
    return removed_count

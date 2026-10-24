import os
import time
import asyncio
import httpx
from urllib.parse import quote

import pytest
from fastapi.testclient import TestClient
from app.config import settings
from app.main import app
from app import tasks

ID = '12345678-1234-1234-1234-123456789abc'

@pytest.fixture(autouse=True)
def downloads(tmp_path, monkeypatch):
    from app import supabase_client
    monkeypatch.setattr(supabase_client, 'LOCAL_DOWNLOADS_CACHE', {})
    monkeypatch.setattr(settings, 'DOWNLOAD_DIR', str(tmp_path))
    monkeypatch.setattr(settings, 'COOKIES_FILE', '')
    return tmp_path

@pytest.mark.parametrize('name', ['100%_pronto.mp3', 'literal%20name.mp3', 'ação.mp3'])
def test_literal_filename(downloads, name):
    (downloads / name).write_bytes(b'audio')
    # ASGITransport avoids TestClient/httpx's extra unquote of URL.path.
    async def request():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
            return await client.get('/api/files/' + quote(name, safe=''))
    response = asyncio.run(request())
    assert response.status_code == 200
    assert response.content == b'audio'
    assert 'attachment' in response.headers['content-disposition']

@pytest.mark.parametrize('name', ['cookies.txt', '.status_x.json', 'video.mp4.part', 'secret.mp4'])
def test_internal_files_not_served(downloads, name, tmp_path_factory):
    path = downloads / name
    if name == 'secret.mp4':
        secret = tmp_path_factory.mktemp('outside') / name
        secret.write_bytes(b'secret')
        path.symlink_to(secret)
    else:
        path.write_bytes(b'secret')
    assert TestClient(app).get('/api/files/' + name).status_code == 404


def test_missing_and_range(downloads):
    client = TestClient(app)
    assert client.get('/api/files/missing.mp3').status_code == 404
    (downloads / 'sample.mp3').write_bytes(b'0123456789')
    response = client.get('/api/files/sample.mp3', headers={'Range': 'bytes=2-5'})
    assert response.status_code == 206
    assert response.content == b'2345'

class FakeYDL:
    options = []
    failures = []
    write_file = True
    def __init__(self, opts):
        self.opts = opts
        self.options.append(dict(opts))
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def extract_info(self, *args, **kwargs):
        if self.failures:
            failure = self.failures.pop(0)
            if failure: raise RuntimeError(failure)
        return {'title': 'Teste', 'duration': 1.2, 'id': 'test'}
    def download(self, urls):
        if self.write_file:
            from pathlib import Path
            Path(self.opts['outtmpl'].replace('%(title).100s', 'Teste').replace('%(ext)s', 'mp3')).write_bytes(b'audio')

@pytest.fixture
def fake_ydl(monkeypatch):
    FakeYDL.options, FakeYDL.failures, FakeYDL.write_file = [], [], True
    monkeypatch.setattr(tasks.yt_dlp, 'YoutubeDL', FakeYDL)
    return FakeYDL


def test_extraction_cookie_fallback(downloads, monkeypatch, fake_ydl):
    cookies = downloads / 'cookies.txt'
    cookies.write_text('# test')
    fake_ydl.failures = ['Sign in to confirm your age', None]
    tasks.extract_media_info('https://www.youtube.com/watch?v=abcdefghijk')
    assert 'cookiefile' not in fake_ydl.options[0]
    assert fake_ydl.options[1]['cookiefile'] == str(cookies)


def test_unrelated_error_not_retried(downloads, fake_ydl):
    (downloads / 'cookies.txt').write_text('# test')
    fake_ydl.failures = ['HTTP Error 500']
    with pytest.raises(RuntimeError, match='500'):
        tasks.extract_media_info('https://www.youtube.com/watch?v=abcdefghijk')
    assert len(fake_ydl.options) == 1


def test_generation_and_delivery(downloads, fake_ydl):
    result = tasks.execute_download(ID, 'https://www.youtube.com/watch?v=abcdefghijk')
    assert result['status'] == 'completed'
    assert TestClient(app).get('/api/files/' + result['filename']).content == b'audio'


def test_partial_not_marked_completed(downloads, fake_ydl):
    fake_ydl.write_file = False
    (downloads / f'{ID}_Teste.mp3.part').write_bytes(b'partial')
    with pytest.raises(FileNotFoundError):
        tasks.execute_download(ID, 'https://www.youtube.com/watch?v=abcdefghijk')
    from app.supabase_client import get_disk_status
    assert get_disk_status(ID)['status'] == 'failed'


def test_cleanup_retention_and_playlist(downloads):
    old = time.time() - 3600
    for name in ['expired.mp3', 'fresh.mp3', 'cookies.txt', '.gitkeep']:
        path = downloads / name
        path.write_bytes(b'test')
        if name != 'fresh.mp3': os.utime(path, (old, old))
    folder = downloads / f'pl_{ID}'
    folder.mkdir()
    (folder / 'active.part').write_bytes(b'downloading')
    os.utime(folder, (old, old))
    tasks.cleanup_old_files()
    assert not (downloads / 'expired.mp3').exists()
    assert all((downloads / n).exists() for n in ['fresh.mp3', 'cookies.txt', '.gitkeep'])
    assert folder.exists(), 'directory mtime must not expire an active playlist'


def test_download_cookie_fallback(downloads, fake_ydl):
    (downloads / 'cookies.txt').write_text('# test')
    fake_ydl.failures = ['Sign in to confirm your age', None]
    result = tasks.execute_download(ID, 'https://www.youtube.com/watch?v=abcdefghijk')
    assert result['status'] == 'completed'
    assert 'cookiefile' not in fake_ydl.options[0]
    assert fake_ydl.options[1]['cookiefile'].endswith('cookies.txt')


def test_status_does_not_complete_intermediate_file(downloads):
    from app.supabase_client import update_download_record
    update_download_record(ID, {'status':'processing', 'progress':20, 'format':'mp3'})
    (downloads / f'{ID}_intermediate.mp4').write_bytes(b'not converted')
    response = TestClient(app).get('/api/downloads/'+ID)
    assert response.json()['status'] == 'processing'


def test_expired_status_has_no_stale_download_link(downloads):
    from app.supabase_client import update_download_record
    update_download_record(ID, {'status':'completed', 'filename':f'{ID}_gone.mp3'})
    response = TestClient(app).get('/api/downloads/'+ID)
    assert response.json()['status'] == 'failed'
    assert response.json()['download_url'] is None

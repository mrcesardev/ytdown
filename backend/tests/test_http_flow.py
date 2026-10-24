"""Real yt-dlp -> FFmpeg -> FastAPI -> Next.js HTTP smoke test, no external media.
Run YTDOWN_HTTP_TEST=1 PYTHONPATH=backend pytest backend/tests/test_http_flow.py -q.
Requires ffmpeg and npm ci in frontend. Does not exercise provider authentication.
"""
import functools
import hashlib
import http.server
import os
from pathlib import Path
import socket
import subprocess
import sys
import threading
import time
from urllib.parse import quote

import httpx
import pytest

pytestmark = pytest.mark.skipif(os.getenv('YTDOWN_HTTP_TEST') != '1', reason='opt-in real HTTP smoke')
ROOT = Path(__file__).resolve().parents[2]


def port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


def test_real_download(tmp_path):
    media = tmp_path / 'media'
    media.mkdir()
    downloads = tmp_path / 'downloads'
    downloads.mkdir()
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i',
                    'sine=frequency=440:duration=2', str(media / 'sample.wav')], check=True)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(
        http.server.SimpleHTTPRequestHandler, directory=str(media)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    api_port, front_port = port(), port()
    api, front = f'http://127.0.0.1:{api_port}', f'http://127.0.0.1:{front_port}'
    env = {**os.environ, 'DOWNLOAD_DIR':str(downloads), 'REDIS_URL':'redis://127.0.0.1:1/0',
           'API_URL':api, 'NEXT_PUBLIC_API_URL':api, 'BASE_URL':api,
           'SUPABASE_URL':'', 'SUPABASE_SERVICE_ROLE_KEY':'', 'SUPABASE_SECRET_KEY':'',
           'API_SECRET_KEY':'', 'COOKIES_FILE':'',
           'NEXT_PUBLIC_SUPABASE_URL':'http://127.0.0.1:1', 'NEXT_PUBLIC_SUPABASE_ANON_KEY':'test',
           'NO_PROXY':'127.0.0.1,localhost', 'no_proxy':'127.0.0.1,localhost', 'NEXT_TELEMETRY_DISABLED':'1'}
    processes = []
    with (tmp_path / 'servers.log').open('w') as log, httpx.Client(trust_env=False, timeout=60) as client:
        try:
            processes.append(subprocess.Popen([sys.executable, '-m', 'uvicorn', 'app.main:app', '--port',str(api_port)], cwd=ROOT/'backend',env=env,stdout=log,stderr=log))
            processes.append(subprocess.Popen(['npm','run','dev','--','--port',str(front_port),'--hostname','127.0.0.1'],cwd=ROOT/'frontend',env=env,stdout=log,stderr=log))
            for base, route in [(api, '/openapi.json'), (front, '/api/files/missing.mp3')]:
                for attempt in range(120):
                    try:
                        client.get(base + route)
                        break
                    except httpx.TransportError:
                        time.sleep(.5)
                else: pytest.fail((tmp_path/'servers.log').read_text())
            url = f'http://127.0.0.1:{server.server_port}/sample.wav'
            info = client.post(api+'/api/info', json={'url':url})
            assert info.status_code == 200, info.text
            queued = client.post(api+'/api/downloads', json={'url':url,'format':'mp3'})
            assert queued.status_code == 200, queued.text
            download_id = queued.json()['id']
            for attempt in range(100):
                state = client.get(api+'/api/downloads/'+download_id).json()
                if state['status'] in ('completed','failed'): break
                time.sleep(.2)
            assert state['status'] == 'completed', state
            path = '/api/files/'+quote(state['filename'], safe='')
            direct, proxied = client.get(api+path), client.get(front+path)
            assert direct.status_code == proxied.status_code == 200
            assert direct.content == proxied.content and len(proxied.content)>1000
            assert 'attachment' in proxied.headers['content-disposition']
            probe = subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(downloads/state['filename'])],capture_output=True,text=True,check=True)
            assert 1.9 < float(probe.stdout) < 2.5
            partial = client.get(front+path,headers={'Range':'bytes=2-5'})
            assert partial.status_code == 206 and partial.content == direct.content[2:6]
            assert client.get(front+path,headers={'Range':'bytes=9999999-'}).status_code == 416
            for name in ['100%_ação.mp3','literal%20name.mp3']:
                (downloads/name).write_bytes(direct.content)
                response = client.get(front+'/api/files/'+quote(name,safe=''))
                assert response.status_code == 200 and response.content == direct.content
            (downloads/'cookies.txt').write_text('never serve this')
            assert client.get(front+'/api/files/cookies.txt').status_code == 404
            bad = client.post(api+'/api/info',json={'url':url.replace('sample.wav','missing.wav')})
            assert bad.status_code == 400
            if os.getenv('YTDOWN_BROWSER_TEST') == '1':
                subprocess.run(['node',str(ROOT/'frontend/tests/browser-download.js'),front,
                                download_id,str(downloads/state['filename'])],check=True,env=env,timeout=90)
            # Exercise the actual cleanup endpoint and subsequent proxy 404.
            old = time.time()-7200
            os.utime(downloads/state['filename'],(old,old))
            assert client.post(api+'/api/cleanup').status_code == 200
            assert client.get(front+path).status_code == 404
            assert (downloads/'cookies.txt').exists()
            print(f"HTTP smoke OK: {len(proxied.content)} bytes, SHA256 {hashlib.sha256(proxied.content).hexdigest()}")
        finally:
            for process in reversed(processes):
                process.terminate()
                try: process.wait(timeout=10)
                except subprocess.TimeoutExpired: process.kill()
            server.shutdown()

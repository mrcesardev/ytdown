# Validação do fluxo de download — 24/10/2026

Base revisada: `3b3a06e` (HEAD), incluindo `149646f`, `0abb70a` e `fd8f2cd`.
Não havia testes no checkout nem PR aberto encontrado na consulta inicial.

## Problemas reproduzidos e correções

- `/api/files/cookies.txt`, arquivos de status, `.part` e symlinks externos eram entregues sem restrição. A entrega agora aceita somente arquivos regulares MP3, MP4 e ZIP no diretório de downloads, sem symlinks ou caminhos compostos.
- Decodificação repetida no proxy e na API corrompia nomes com `%` ou sequências literais como `%20`. Os parâmetros já decodificados pelo framework agora são preservados. Confirmado por HTTP real com nomes acentuados e percentuais.
- Ausência de mídia final fazia `execute_download` selecionar um `.part` e marcar sucesso. Agora exige arquivo não vazio na extensão esperada.
- Consulta de status podia anunciar um MP4 intermediário como concluído enquanto a conversão para MP3 continuava. O estado conhecido do worker agora impede essa inferência. Registros concluídos sem arquivo passam a informar falha/expiração sem link obsoleto.
- Limpeza de playlists usava apenas o mtime do diretório, que não muda ao escrever em um arquivo existente. Agora considera os descendentes. O cron usa a mesma função da API, substituindo o `find` recursivo que ignorava essa proteção. Arquivo final tem mtime renovado ao concluir a conversão.
- Proxy agora preserva `If-Range`, validadores e `Content-Range` em erros 416; o fallback de Content-Disposition suporta Unicode com RFC 5987.

## Evidência local

- 16 casos de backend aprovados: extração sem cookies, fallback com cookies na extração e no download, falha sem retry indevido, geração, entrega, arquivos internos, nomes literais, Range, status e limpeza.
- 6 testes do proxy aprovados: bytes/nome, retomada, 404/416/500 e conexão indisponível (502).
- Smoke HTTP real aprovado: mídia WAV sintética de 2 segundos -> yt-dlp -> conversão FFmpeg para MP3 -> API -> proxy Next.js. 33.062 bytes idênticos na entrega direta e no proxy; ffprobe confirmou duração; HTTP 206/416; falha de extração 400; limpeza e posterior 404; cookies preservados.
- TypeScript (`npx tsc --noEmit`) e sintaxe do script de implantação verificados.
- Chromium não estava instalado; tentativas de instalação receberam arquivo truncado do CDN. O clique/download no navegador **não foi executado localmente**. Há teste Playwright que usa o link real do histórico anônimo (resposta da lista simulada a partir do status real, sem Supabase), compara os bytes baixados e verifica ausência de nova aba. O workflow executa esse teste junto ao smoke HTTP.

## Como reproduzir

```bash
pip install -r backend/requirements.txt pytest httpx
(cd frontend && npm ci && npm test && npx tsc --noEmit)
PYTHONPATH=backend python -m pytest backend/tests -q
# ffmpeg e ffprobe devem estar no PATH
YTDOWN_HTTP_TEST=1 PYTHONPATH=backend python -m pytest backend/tests/test_http_flow.py -q -s
# Acrescentar validação no Chromium
(cd frontend && npx playwright install --with-deps chromium)
YTDOWN_HTTP_TEST=1 YTDOWN_BROWSER_TEST=1 PYTHONPATH=backend python -m pytest backend/tests/test_http_flow.py -q -s
```

## Limites e riscos pendentes

- A mídia local valida extração, conversão e transporte reais, mas não certifica os extratores atuais de YouTube, TikTok, Instagram ou X. Cookies reais e conteúdo restrito não foram acessados; os cenários de autenticação são simulados.
- Uma tentativa real de extração do vídeo de teste `BaW_jenozKc` do YouTube falhou por `CERTIFICATE_VERIFY_FAILED` (certificado autoassinado na cadeia da rede deste ambiente); não confirma falha do aplicativo nem sucesso do extrator no YouTube.
- Redis/Celery, Supabase e Vercel/VPS de produção não foram exercitados. O smoke usa BackgroundTasks e status em disco, sem credenciais externas. O limite de streaming de 60 segundos do proxy continua sendo risco para arquivos grandes e conexões lentas.
- Dependências Python aceitam versões sem limite superior; a validação foi feita com as versões resolvidas em 24/10/2026, não com uma imagem de produção inspecionada.
- Retenção de 30 minutos com cron horário implica remoção em aproximadamente 30–90 minutos. A proteção por mtime não é trava de concorrência e não garante preservação de um arquivo antigo durante uma transferência aberta. A alteração do cron só entra em vigor quando reinstalada na VPS; não executar o setup completo apenas para atualizar o cron sem revisar suas outras mudanças de sistema.
- Arquivos de autenticação permanecem protegidos da limpeza, mas a chave de API pública já documentada e outras rotas merecem revisão separada de autenticação.

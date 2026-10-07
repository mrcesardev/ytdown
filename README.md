# YtDown 🎬🎧📱

Aplicação moderna de extração e conversão de mídias do **YouTube**, **TikTok**, **Instagram** e **X (Twitter)** (estilo *stream-ripper* como o Yout.com), arquitetada para alta performance, baixo custo e sem anúncios.

### 🌟 Modelo de Acesso e Funcionalidades
* **Página Inicial Pública (Sem Login)**: Qualquer visitante pode colar o link e baixar diretamente:
  * 🎬 **YouTube**: Vídeos em MP4 (720p) ou Áudio em MP3 (128 kbps).
  * ⚡ **TikTok**: Vídeos em MP4 **sem marca d'água** ou Áudio MP3 da trilha sonora original.
  * 📸 **Instagram**: Reels, Posts e Vídeos em MP4 ou extração de Áudio MP3.
  * 🐦 **X (Twitter)**: Vídeos, Clipes e GIFs em MP4 ou extração de Áudio MP3.
* **Recursos Exclusivos (Com Cadastro Gratuito)**:
  * 📦 **Download de Playlists Completas**: Baixa todos os vídeos ou músicas de uma lista do YouTube compactados em um único arquivo `.zip`.
  * 🎵 **Áudio em Alta Fidelidade (320 kbps)**: Conversão acústica com máxima fidelidade.
  * 🕒 **Histórico de Downloads**: Salva os arquivos e links convertidos na conta do usuário com sincronização em tempo real.

---

## 🏗️ Arquitetura do Sistema

```
[ Usuário / Navegador ]
        │
        ▼ (HTTPS)
┌─────────────────────────────────┐
│     Vercel (Front-end)          │ ◄────► [ Supabase (PostgreSQL + Auth + Realtime) ]
│     Next.js 14 + Tailwind CSS   │
└────────────────┬────────────────┘
                 │ (Disparo de Download / Status)
                 ▼ (REST / HTTPS)
┌─────────────────────────────────┐
│     VPS Absam.io (Ubuntu)       │
│     - Nginx (Proxy Reverso)     │
│     - FastAPI (Backend REST)    │
│     - Celery (Concurrency = 1)  │  ◄── Garante respiro na VPS (2 vCPU / 2GB RAM)
│     - Redis 7 (Fila Leve)       │
│     - yt-dlp + FFmpeg           │
│     - Limpeza automática        │
└─────────────────────────────────┘
```

---

## 📁 Estrutura de Pastas

```
YtDown/
├── backend/                  # API em FastAPI + Worker Celery + yt-dlp/FFmpeg
│   ├── app/
│   │   ├── main.py           # Rotas da API e entrega de arquivos
│   │   ├── tasks.py          # Download com yt-dlp e conversão via FFmpeg
│   │   ├── celery_app.py     # Configuração da fila Celery
│   │   ├── supabase_client.py# Sincronização em tempo real com o Supabase
│   │   ├── schemas.py        # Modelos Pydantic
│   │   └── config.py         # Configurações e variáveis de ambiente
│   ├── downloads/            # Pasta temporária de arquivos
│   ├── Dockerfile            # Container com Python 3.12 e FFmpeg
│   ├── docker-compose.yml    # Orquestração do Redis, API e Worker
│   ├── requirements.txt
│   └── .env.example
├── frontend/                 # Interface web em Next.js 14 (App Router)
│   ├── src/
│   │   ├── app/              # Páginas (Dashboard e Login)
│   │   ├── components/       # Formulário de URL, Histórico Realtime e Navbar
│   │   └── lib/              # Cliente do Supabase e interfaces
│   ├── package.json
│   ├── tailwind.config.js
│   └── .env.example
├── supabase/
│   └── schema.sql            # Schema SQL com RLS, Políticas e Realtime
├── deploy/
│   ├── setup_vps.sh          # Script de automação para Ubuntu (Swap, Docker, Cron)
│   └── nginx.conf            # Modelo de proxy reverso Nginx para VPS
└── README.md
```

---

## 🚀 Guia de Implantação Passo a Passo

### 1. Banco de Dados e Autenticação (Supabase)
1. Crie um projeto gratuito no [Supabase](https://supabase.com).
2. Acesse a aba **SQL Editor** no painel do Supabase.
3. Copie o conteúdo do arquivo `supabase/schema.sql` e execute o script.
   - Isso criará a tabela `media_downloads`, as regras de **Row Level Security (RLS)** e ativará o **Supabase Realtime**.
4. Acesse **Project Settings > API** e anote:
   - `Project URL`
   - `anon / public key` (usada no frontend)
   - `service_role key` (secreta, usada exclusivamente no backend da VPS)

---

### 2. Backend na VPS Absam.io (Ubuntu 2 vCPU / 2GB RAM / 50GB SSD)

1. Conecte-se na sua VPS via SSH:
   ```bash
   ssh root@IP_DA_SUA_VPS
   ```
2. Clone o repositório ou envie a pasta do projeto para `/opt/ytdown`:
   ```bash
   mkdir -p /opt/ytdown
   cd /opt/ytdown
   ```
3. Execute o script de automação para preparar o sistema:
   ```bash
   chmod +x deploy/setup_vps.sh
   ./deploy/setup_vps.sh
   ```
   > O script criará automaticamente **2GB de SWAP** (essencial para não travar a memória de 2GB durante conversões no FFmpeg), instalará o Docker, Nginx, UFW e ativará o cron job de limpeza de arquivos com mais de 2 horas.

4. Configure as variáveis de ambiente do backend:
   ```bash
   cd /opt/ytdown/backend
   cp .env.example .env
   nano .env
   ```
   Preencha os valores:
   - `SUPABASE_URL`: URL do seu projeto Supabase.
   - `SUPABASE_SERVICE_ROLE_KEY`: Chave de serviço do Supabase.
   - `BASE_URL`: URL da sua API (ex: `https://api.seudominio.com` ou `http://IP_DA_VPS:8000`).
   - `API_SECRET_KEY`: Uma senha/token segura para comunicação com a Vercel.
   - `COOKIES_FILE` *(Opcional)*: Caminho para arquivo `cookies.txt` (ex: `/opt/ytdown/backend/cookies.txt`). Permite contornar a exigência de login do Instagram e restrições de idade do YouTube. Basta exportar os cookies de uma conta usando a extensão de navegador *"Get cookies.txt LOCALLY"*.

5. Suba os containers com Docker Compose:
   ```bash
   docker compose up -d --build
   ```
   Verifique o status com `docker compose ps`.

6. *(Opcional / Recomendado)* Ative o Nginx com SSL via Certbot usando `deploy/nginx.conf`.

---

### 3. Front-end na Vercel (Next.js)

1. Conecte o repositório ao seu painel da [Vercel](https://vercel.com).
2. Defina o **Root Directory** como `frontend`.
3. Adicione as seguintes **Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`: URL do seu Supabase.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Chave pública `anon` do Supabase.
   - `NEXT_PUBLIC_API_URL`: URL da API na VPS (ex: `https://api.seudominio.com` ou `http://IP_DA_VPS:8000`).
   - `NEXT_PUBLIC_API_SECRET_KEY`: A mesma chave secreta definida no backend.
   - `NEXT_PUBLIC_SITE_URL`: Seu domínio público em produção (ex: `https://ytdown.com.br`).
   - `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` *(Opcional)*: Token de verificação do Google Search Console.
   - `NEXT_PUBLIC_BING_SITE_VERIFICATION` *(Opcional)*: Token de verificação do Bing Webmaster Tools.
4. Clique em **Deploy**!

---

### 4. Configuração de SEO & Google Search Console

O **YtDown** já vem pronto para o topo das buscas com:
* 🗺️ **Sitemap Dinâmico**: `/sitemap.xml` gerado automaticamente com prioridades e frequências de atualização.
* 🤖 **Robots.txt Otimizado**: `/robots.txt` permitindo indexação de páginas públicas e protegendo rotas internas/APIs.
* 📱 **PWA & Web Manifest**: `/manifest.webmanifest` para alta pontuação no Google Lighthouse e indexação mobile.
* 📊 **Dados Estruturados Schema.org (JSON-LD)**: Marcadores para `WebApplication`, `Organization`, `HowTo` e `FAQPage` (para ativar snippets ricos com perguntas frequentes na página de resultados do Google).
* 🖼️ **OpenGraph & Twitter Cards HD**: Preview visual automático para compartilhamento no WhatsApp, Telegram, Twitter e Facebook.
* 🔍 **Envio para os buscadores**:
  1. Acesse o [Google Search Console](https://search.google.com/search-console).
  2. Adicione sua propriedade (URL do seu site).
  3. Insira o código da tag HTML na variável `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`.
  4. No menu lateral do Search Console, clique em **Sitemaps** e envie: `sitemap.xml`.

---

## 💻 Como Rodar Localmente (Desenvolvimento)

### Backend:
```bash
cd backend
python -m venv venv
venv\Scripts\activate # No Windows (ou source venv/bin/activate no Linux)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
> Para rodar o worker localmente, inicie o Redis e execute:
> `celery -A app.celery_app.celery_app worker --concurrency=1 --loglevel=info`

### Frontend:
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```
Acesse `http://localhost:3000`.

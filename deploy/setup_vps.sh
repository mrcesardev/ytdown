#!/usr/bin/env bash
# ==============================================================================
# Script de Configuração Inicial da VPS Ubuntu na Absam.io para o YtDown
# Recomendado para servidor 2 vCPU / 2 GB RAM / 50 GB SSD
# ==============================================================================

set -e

echo "🚀 Iniciando configuração da VPS Ubuntu para o YtDown..."

# 1. Configurar SWAP de 2GB (Vital para servidores com 2GB de RAM não travarem)
if [ ! -f /swapfile ]; then
    echo "📦 Criando arquivo Swap de 2GB..."
    sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    sudo sysctl vm.swappiness=20
    echo 'vm.swappiness=20' | sudo tee -a /etc/sysctl.conf
    echo "✅ Swap de 2GB ativado com sucesso."
else
    echo "ℹ️ Swapfile já existente, pulando etapa."
fi

# 2. Atualizar pacotes do sistema
echo "🔄 Atualizando repositórios e pacotes do Ubuntu..."
sudo apt update && sudo apt upgrade -y

# 3. Instalar utilitários essenciais e Docker
echo "🐳 Instalando Docker, Docker Compose e ferramentas básicas..."
sudo apt install -y curl wget git ufw htop ca-certificates gnupg lsb-release

# Adicionar repositório oficial do Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Ativar serviço do Docker
sudo systemctl enable --now docker
sudo usermod -aG docker $USER

# 4. Instalar Nginx e Certbot (para SSL gratuito)
echo "🌐 Instalando Nginx e Certbot para proxy reverso..."
sudo apt install -y nginx certbot python3-certbot-nginx

# 5. Configurar Firewall (UFW)
echo "🛡️ Configurando Firewall (UFW)..."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
echo "y" | sudo ufw enable

# 6. Configurar Cron Job para Limpeza de Arquivos Temporários
echo "🧹 Configurando Cron Job de limpeza automática de arquivos (> 2 horas)..."
DOWNLOADS_PATH="/opt/ytdown/backend/downloads"
mkdir -p "$DOWNLOADS_PATH"

CRON_JOB="0 * * * * find $DOWNLOADS_PATH -type f -mmin +120 -delete"
(crontab -l 2>/dev/null | grep -Fv "$DOWNLOADS_PATH" ; echo "$CRON_JOB") | crontab -

echo "=============================================================================="
echo "✅ Configuração concluída com sucesso!"
echo "📁 Diretório de instalação sugerido: /opt/ytdown"
echo "👉 Próximos passos:"
echo "   1. Copie o projeto para a VPS em /opt/ytdown"
echo "   2. Configure o arquivo /opt/ytdown/backend/.env"
echo "   3. Suba os containers com: docker compose up -d"
echo "   4. Configure o Nginx usando o modelo em deploy/nginx.conf"
echo "=============================================================================="

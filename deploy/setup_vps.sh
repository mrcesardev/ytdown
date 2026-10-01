#!/usr/bin/env bash
# ==============================================================================
# Script de Configuração Inicial da VPS Debian/Ubuntu na Absam.io para o YtDown
# Recomendado para servidor 2 vCPU / 2 GB RAM / 50 GB SSD
# ==============================================================================

set -e

echo "🚀 Iniciando configuração da VPS para o YtDown..."

# 1. Configurar SWAP de 2GB (Vital para servidores com 2GB de RAM não travarem)
if [ ! -f /swapfile ]; then
    echo "📦 Criando arquivo Swap de 2GB..."
    fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    sysctl vm.swappiness=20
    echo 'vm.swappiness=20' >> /etc/sysctl.conf
    echo "✅ Swap de 2GB ativado com sucesso."
else
    echo "ℹ️ Swapfile já existente, pulando etapa."
fi

# 2. Atualizar pacotes do sistema
echo "🔄 Atualizando repositórios e pacotes..."
apt update && apt upgrade -y
apt install -y curl wget git ufw htop ca-certificates nginx certbot python3-certbot-nginx

# 3. Instalar Docker oficial via script de conveniência
echo "🐳 Instalando Docker e Docker Compose oficial..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
else
    echo "ℹ️ Docker já instalado."
fi

# 4. Configurar Firewall (UFW)
echo "🛡️ Configurando Firewall (UFW)..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 8000/tcp  # API Backend
echo "y" | ufw enable || true

# 5. Configurar Cron Job para Limpeza de Arquivos Temporários (> 2 horas)
echo "🧹 Configurando Cron Job de limpeza automática de arquivos..."
DOWNLOADS_PATH="/opt/ytdown/backend/downloads"
mkdir -p "$DOWNLOADS_PATH"

CRON_JOB="0 * * * * find $DOWNLOADS_PATH -type f -mmin +120 -delete"
(crontab -l 2>/dev/null | grep -Fv "$DOWNLOADS_PATH" ; echo "$CRON_JOB") | crontab -

echo "=============================================================================="
echo "✅ Configuração da VPS concluída com sucesso!"
echo "📁 Diretório da aplicação: /opt/ytdown"
echo "=============================================================================="

#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# 启文软件 · 一键部署脚本
# 适用系统: Ubuntu 22.04 / Debian 12
# 使用: sudo bash deploy.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info() { echo -e "${BLUE}[→]${NC} $1"; }

[[ $EUID -eq 0 ]] || err "请以 root 或 sudo 运行此脚本"

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}          启文软件 · 服务器部署脚本 v1.0                     ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# ── 收集配置 ──────────────────────────────────────────────────
read -p "$(echo -e ${YELLOW}请输入您的域名 [如: qiwen.example.com]:${NC} )" DOMAIN
read -p "$(echo -e ${YELLOW}请输入 API 子域名 [如: api.qiwen.example.com]:${NC} )" API_DOMAIN
read -p "$(echo -e ${YELLOW}请输入管理员邮箱 [用于 SSL 证书]:${NC} )" ADMIN_EMAIL
read -p "$(echo -e ${YELLOW}请输入 SMTP 邮件服务器:${NC} )" SMTP_HOST
read -p "$(echo -e ${YELLOW}请输入 SMTP 邮箱用户名:${NC} )" SMTP_USER
read -sp "$(echo -e ${YELLOW}请输入 SMTP 密码:${NC} )" SMTP_PASS; echo

# Generate secrets
PG_PASS=$(openssl rand -base64 32)
REDIS_PASS=$(openssl rand -base64 24)
JWT_ACCESS=$(openssl rand -hex 64)
JWT_REFRESH=$(openssl rand -hex 64)
COOKIE_SECRET=$(openssl rand -hex 32)

log "配置已收集，开始安装..."

# ── 1. 系统依赖 ───────────────────────────────────────────────
info "更新系统包..."
apt-get update -qq && apt-get upgrade -y -qq

info "安装基础工具..."
apt-get install -y -qq \
  curl git vim htop ufw fail2ban \
  ca-certificates gnupg lsb-release \
  certbot python3-certbot-nginx

# ── 2. Docker ─────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  info "安装 Docker..."
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker $SUDO_USER 2>/dev/null || true
  systemctl enable docker
  systemctl start docker
  log "Docker 安装完成"
else
  log "Docker 已安装: $(docker --version)"
fi

if ! command -v docker-compose &>/dev/null && ! docker compose version &>/dev/null; then
  info "安装 Docker Compose..."
  COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep '"tag_name"' | cut -d'"' -f4)
  curl -SL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-x86_64" -o /usr/local/bin/docker-compose
  chmod +x /usr/local/bin/docker-compose
  log "Docker Compose 安装完成"
fi

# ── 3. 防火墙 ─────────────────────────────────────────────────
info "配置防火墙..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
log "防火墙配置完成"

# ── 4. 目录结构 ───────────────────────────────────────────────
info "创建目录结构..."
mkdir -p /opt/qiwen/{server,deploy,logs,backups}
mkdir -p /var/www/qiwen/releases
mkdir -p /var/log/qiwen

# ── 5. 写入环境变量 ───────────────────────────────────────────
info "写入环境配置..."
cat > /opt/qiwen/.env <<EOF
# ── 生成时间: $(date) ──
POSTGRES_PASSWORD=${PG_PASS}
REDIS_PASSWORD=${REDIS_PASS}
JWT_ACCESS_SECRET=${JWT_ACCESS}
JWT_REFRESH_SECRET=${JWT_REFRESH}
COOKIE_SECRET=${COOKIE_SECRET}
CLIENT_URL=https://${DOMAIN}
API_URL=https://${API_DOMAIN}
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=587
SMTP_USER=${SMTP_USER}
SMTP_PASS=${SMTP_PASS}
SMTP_FROM=noreply@${DOMAIN}
SMTP_FROM_NAME=启文
EOF
chmod 600 /opt/qiwen/.env
log "环境变量已写入 /opt/qiwen/.env"

# ── 6. SSL 证书 ───────────────────────────────────────────────
info "申请 SSL 证书..."
# 临时用 nginx 响应 ACME challenge
apt-get install -y -qq nginx
systemctl start nginx || true

certbot certonly --nginx \
  -d "${DOMAIN}" -d "${API_DOMAIN}" \
  --email "${ADMIN_EMAIL}" \
  --agree-tos --non-interactive --redirect || warn "SSL 申请失败，请检查 DNS 解析是否正确"

systemctl stop nginx || true

log "SSL 证书申请完成"

# ── 7. 复制 nginx 配置 ────────────────────────────────────────
info "配置 Nginx..."
# 替换域名占位符
sed "s/yourdomain.com/${DOMAIN}/g; s/api.yourdomain.com/${API_DOMAIN}/g" \
  /opt/qiwen/deploy/nginx/conf.d/qiwen.conf > /tmp/qiwen_nginx.conf
mkdir -p /opt/qiwen/deploy/nginx/conf.d
mv /tmp/qiwen_nginx.conf /opt/qiwen/deploy/nginx/conf.d/qiwen.conf

# ── 8. 启动服务 ───────────────────────────────────────────────
info "启动 Docker 服务..."
cd /opt/qiwen/deploy/docker
docker compose --env-file /opt/qiwen/.env up -d --build

# 等待数据库就绪
info "等待数据库启动..."
sleep 15

# 运行数据库迁移
info "运行数据库迁移..."
docker compose exec -T api npx prisma migrate deploy
log "数据库迁移完成"

# ── 9. 自动备份 ───────────────────────────────────────────────
info "配置自动备份..."
cat > /etc/cron.d/qiwen-backup <<'CRON'
# 每日 3:00 备份数据库
0 3 * * * root /opt/qiwen/deploy/scripts/backup.sh >> /var/log/qiwen/backup.log 2>&1
CRON

# ── 10. Certbot 自动续期 ──────────────────────────────────────
info "配置证书自动续期..."
cat > /etc/cron.d/certbot-renew <<'CRON'
0 2 * * 1 root certbot renew --quiet --deploy-hook "docker compose -f /opt/qiwen/deploy/docker/docker-compose.yml exec -T nginx nginx -s reload"
CRON

# ── 11. 健康检查 ──────────────────────────────────────────────
info "验证服务状态..."
sleep 5
if curl -sf "https://${API_DOMAIN}/health" >/dev/null 2>&1; then
  log "API 服务运行正常"
else
  warn "API 健康检查失败，请检查日志: docker compose logs api"
fi

# ── 完成 ──────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}          🎉 启文软件部署成功！                              ${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${BLUE}网站地址:${NC}   https://${DOMAIN}"
echo -e "  ${BLUE}API 地址:${NC}   https://${API_DOMAIN}"
echo -e "  ${BLUE}环境配置:${NC}   /opt/qiwen/.env"
echo -e "  ${BLUE}服务日志:${NC}   docker compose -f /opt/qiwen/deploy/docker/docker-compose.yml logs -f"
echo ""
echo -e "${YELLOW}重要: 请妥善保管 /opt/qiwen/.env 文件中的密钥！${NC}"
echo ""

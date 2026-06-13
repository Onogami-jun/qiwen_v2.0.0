#!/usr/bin/env bash
# 启文数据库自动备份脚本
set -euo pipefail

BACKUP_DIR="/opt/qiwen/backups"
DATE=$(date +%Y%m%d_%H%M%S)
KEEP_DAYS=14

source /opt/qiwen/.env

mkdir -p "$BACKUP_DIR"

echo "[$(date)] 开始备份..."
docker exec qiwen_postgres pg_dump \
  -U qiwen_user qiwen_db \
  | gzip > "${BACKUP_DIR}/qiwen_db_${DATE}.sql.gz"

# 删除超过 14 天的备份
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +${KEEP_DAYS} -delete

SIZE=$(du -sh "${BACKUP_DIR}/qiwen_db_${DATE}.sql.gz" | cut -f1)
echo "[$(date)] 备份完成: qiwen_db_${DATE}.sql.gz (${SIZE})"

ls -lht "$BACKUP_DIR" | head -6

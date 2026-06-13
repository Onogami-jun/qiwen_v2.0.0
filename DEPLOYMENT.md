# 启文软件 · 服务器部署完整指南

> 适用系统: Ubuntu 22.04 LTS / Debian 12  
> 预计耗时: 20-40 分钟

---

## 目录

1. [准备工作](#1-准备工作)
2. [服务器初始配置](#2-服务器初始配置)
3. [一键部署（推荐）](#3-一键部署推荐)
4. [手动部署（高级）](#4-手动部署高级)
5. [桌面客户端连接服务器](#5-桌面客户端连接服务器)
6. [日常运维](#6-日常运维)
7. [常见问题](#7-常见问题)

---

## 1. 准备工作

### 1.1 服务器要求

| 配置    | 最低要求       | 推荐配置       |
|---------|----------------|----------------|
| CPU     | 1 核           | 2 核+          |
| 内存    | 1 GB           | 2 GB+          |
| 磁盘    | 20 GB SSD      | 50 GB SSD      |
| 系统    | Ubuntu 22.04   | Ubuntu 22.04   |
| 带宽    | 1 Mbps         | 5 Mbps+        |

**推荐云服务商**: 腾讯云轻量应用服务器 / 阿里云 ECS / Vultr / DigitalOcean

### 1.2 域名准备

您需要准备 **2 个域名/子域名**，提前添加 DNS 解析到服务器 IP：

```
A 记录    qiwen.yourdomain.com     →  服务器公网 IP
A 记录    api.qiwen.yourdomain.com →  服务器公网 IP
```

> DNS 生效通常需要 5-30 分钟，请提前操作。

### 1.3 邮件服务（可选）

用于发送验证邮件和密码重置邮件。推荐选项：

- **Gmail**: 开启"应用专用密码"，SMTP: smtp.gmail.com:587
- **腾讯企业邮**: SMTP: smtp.exmail.qq.com:465
- **阿里云邮件推送**: SMTP: smtpdm.aliyun.com:465
- **Resend.com**: 免费额度够用，API 转 SMTP

---

## 2. 服务器初始配置

```bash
# 连接服务器
ssh root@your-server-ip

# 创建普通用户（推荐，避免直接用 root）
adduser qiwen
usermod -aG sudo qiwen

# 配置 SSH 密钥登录（在本地执行）
ssh-copy-id qiwen@your-server-ip

# 禁用 root 密码登录（安全加固）
sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd
```

---

## 3. 一键部署（推荐）

```bash
# 1. 克隆项目
git clone https://github.com/yourname/qiwen.git /opt/qiwen
cd /opt/qiwen

# 2. 运行一键部署脚本
sudo bash deploy/scripts/deploy.sh
```

脚本将自动完成：
- ✅ 安装 Docker、Docker Compose
- ✅ 配置 UFW 防火墙
- ✅ 申请 Let's Encrypt SSL 证书
- ✅ 启动 PostgreSQL、Redis、API 服务
- ✅ 运行数据库迁移
- ✅ 配置 Nginx 反向代理
- ✅ 设置自动备份（每日 3:00）
- ✅ 设置证书自动续期

---

## 4. 手动部署（高级）

如果需要自定义配置，按以下步骤手动操作：

### 4.1 安装 Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

### 4.2 克隆项目并配置环境变量

```bash
git clone https://github.com/yourname/qiwen.git /opt/qiwen
cd /opt/qiwen

# 复制环境变量模板
cp server/.env.example /opt/qiwen/.env

# 编辑配置（必须修改以下字段）
nano /opt/qiwen/.env
```

**必须修改的配置项**：

```bash
# 生成随机密钥（在服务器上执行以下命令）
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# 填入 .env 文件：
DATABASE_URL="postgresql://qiwen_user:YOUR_STRONG_PASSWORD@postgres:5432/qiwen_db"
POSTGRES_PASSWORD="YOUR_STRONG_PASSWORD"        # 数据库密码
REDIS_PASSWORD="YOUR_REDIS_PASSWORD"             # Redis 密码
JWT_ACCESS_SECRET="64字符随机字符串"              # 必须足够随机
JWT_REFRESH_SECRET="64字符随机字符串（不同于上面）"
COOKIE_SECRET="32字符随机字符串"
CLIENT_URL="https://qiwen.yourdomain.com"
API_URL="https://api.qiwen.yourdomain.com"
SMTP_HOST="smtp.gmail.com"
SMTP_USER="your@gmail.com"
SMTP_PASS="your-app-password"
```

### 4.3 申请 SSL 证书

```bash
sudo apt install certbot python3-certbot-nginx -y

# 申请证书（需要 DNS 已解析到此服务器）
sudo certbot certonly --standalone \
  -d qiwen.yourdomain.com \
  -d api.qiwen.yourdomain.com \
  --email admin@yourdomain.com \
  --agree-tos --non-interactive
```

### 4.4 配置 Nginx

```bash
# 修改 nginx 配置中的域名
sed -i 's/yourdomain.com/YOUR_DOMAIN/g' deploy/nginx/conf.d/qiwen.conf
sed -i 's/api.yourdomain.com/api.YOUR_DOMAIN/g' deploy/nginx/conf.d/qiwen.conf
```

### 4.5 启动所有服务

```bash
cd /opt/qiwen/deploy/docker

# 启动（-d 后台运行）
docker compose --env-file /opt/qiwen/.env up -d --build

# 查看启动日志
docker compose logs -f --tail=50

# 运行数据库迁移
docker compose exec api npx prisma migrate deploy
```

### 4.6 验证部署

```bash
# 检查所有容器状态
docker compose ps

# 测试 API 健康状态
curl https://api.yourdomain.com/health

# 测试注册接口
curl -X POST https://api.yourdomain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","username":"testuser","password":"Test1234","displayName":"测试用户"}'
```

---

## 5. 桌面客户端连接服务器

在桌面版启文中配置服务器地址：

### 方法一：修改源码

编辑 `src/renderer/store/slices/authSlice.ts`：
```typescript
const API = 'https://api.yourdomain.com/api';  // 改为您的 API 地址
```

### 方法二：环境变量（推荐）

在打包时设置：
```bash
REACT_APP_API_URL=https://api.yourdomain.com npm run build
```

### 方法三：运行时配置

用户在应用「设置 → 账户 → 服务器地址」中手动填写。

---

## 6. 日常运维

### 查看日志

```bash
cd /opt/qiwen/deploy/docker

# 查看所有服务日志
docker compose logs -f

# 只看 API 日志
docker compose logs -f api

# 只看 Nginx 日志
docker compose logs -f nginx
```

### 更新服务

```bash
cd /opt/qiwen

# 拉取最新代码
git pull origin main

# 重新构建并启动
cd deploy/docker
docker compose --env-file /opt/qiwen/.env up -d --build api

# 运行数据库迁移（如有）
docker compose exec api npx prisma migrate deploy

# 清理旧镜像
docker image prune -f
```

### 手动备份数据库

```bash
bash /opt/qiwen/deploy/scripts/backup.sh

# 查看备份文件
ls -lh /opt/qiwen/backups/
```

### 恢复数据库

```bash
# 停止 API（防止写入）
docker compose stop api

# 恢复备份
gunzip < /opt/qiwen/backups/qiwen_db_20240615_030000.sql.gz \
  | docker exec -i qiwen_postgres psql -U qiwen_user qiwen_db

# 重启 API
docker compose start api
```

### 重启服务

```bash
cd /opt/qiwen/deploy/docker

# 重启全部
docker compose restart

# 只重启 API
docker compose restart api

# 完全重新创建（慎用）
docker compose down && docker compose up -d
```

### 查看资源占用

```bash
# 容器资源
docker stats

# 磁盘占用
df -h
du -sh /opt/qiwen/backups/
du -sh /var/lib/docker/
```

---

## 7. 常见问题

### Q: SSL 证书申请失败

**原因**: DNS 尚未生效，或 80 端口被占用。

```bash
# 检查 DNS 解析
dig +short qiwen.yourdomain.com

# 检查 80 端口
sudo netstat -tlnp | grep :80

# 手动申请
sudo certbot certonly --standalone -d yourdomain.com
```

### Q: 数据库连接失败

```bash
# 检查 PostgreSQL 容器状态
docker compose ps postgres
docker compose logs postgres

# 进入数据库容器验证
docker exec -it qiwen_postgres psql -U qiwen_user -d qiwen_db -c "\l"
```

### Q: 邮件发送失败

```bash
# 查看 API 日志中的 email 错误
docker compose logs api | grep -i email

# Gmail 需要开启"两步验证"并生成"应用专用密码"
# 访问: https://myaccount.google.com/apppasswords
```

### Q: API 返回 500 错误

```bash
# 查看详细错误日志
docker compose logs api --tail=100

# 检查环境变量是否正确
docker compose exec api env | grep -v PASSWORD | grep -v SECRET
```

### Q: 容器启动后立刻退出

```bash
# 查看退出原因
docker compose logs api

# 常见原因：
# 1. 数据库未就绪 → docker compose restart api
# 2. 环境变量缺失 → 检查 .env 文件
# 3. 端口冲突 → netstat -tlnp
```

### Q: 如何查看当前注册用户数

```bash
docker exec qiwen_postgres psql -U qiwen_user -d qiwen_db \
  -c "SELECT COUNT(*) as total_users, plan, COUNT(*) FILTER (WHERE is_verified) as verified FROM users GROUP BY plan;"
```

### Q: 忘记数据库密码

查看 `/opt/qiwen/.env` 文件：
```bash
grep POSTGRES_PASSWORD /opt/qiwen/.env
```

---

## 附录：端口说明

| 端口  | 服务         | 说明                  |
|-------|-------------|----------------------|
| 80    | Nginx       | HTTP（自动跳转 HTTPS）|
| 443   | Nginx       | HTTPS（对外暴露）     |
| 4000  | API Server  | 内部，不对外          |
| 5432  | PostgreSQL  | 内部，不对外          |
| 6379  | Redis       | 内部，不对外          |

## 附录：文件路径

| 路径                          | 说明               |
|------------------------------|--------------------|
| `/opt/qiwen/.env`            | 环境变量配置        |
| `/opt/qiwen/backups/`        | 数据库备份文件      |
| `/var/log/qiwen/`            | 应用日志           |
| `/etc/letsencrypt/`          | SSL 证书           |

---

*如有问题，欢迎在 GitHub Issues 反馈。*

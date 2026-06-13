#!/usr/bin/env bash
cd "$(dirname "$0")"

echo ""
echo "  启文软件 v1.0.0"
echo "  启于思，行于文"
echo ""

if ! command -v node &>/dev/null; then
    echo "  [错误] 没有找到 Node.js，请先安装！"
    echo "  请访问 https://nodejs.org 下载安装"
    open "https://nodejs.org" 2>/dev/null || true
    exit 1
fi

echo "  [OK] Node.js: $(node -v)"

if [ ! -d "node_modules" ]; then
    echo "  [提示] 首次启动，正在安装依赖包，约3-5分钟..."
    npm config set registry https://registry.npmmirror.com 2>/dev/null || true
    npm install
    echo "  [OK] 安装完成"
fi

echo "  [启动] 正在启动启文..."
npm run dev

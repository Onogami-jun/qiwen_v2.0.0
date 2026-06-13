@echo off
cd /d "%~dp0"

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [错误] 没有找到 Node.js，请先安装！
    echo  正在打开下载页面...
    start https://nodejs.org
    pause
    exit /b 1
)

echo  [OK] Node.js 已安装
echo.

if not exist "node_modules" (
    echo  [提示] 首次启动，正在安装依赖包，大约需要3-5分钟...
    echo  [提示] 国内网络自动使用镜像加速，请耐心等待
    npm config set registry https://registry.npmmirror.com
    call npm install
    if %errorlevel% neq 0 (
        echo  [错误] 依赖安装失败，请检查网络后重试
        pause
        exit /b 1
    )
    echo  [OK] 依赖安装完成
)

echo  [启动] 正在启动启文软件...
echo  [提示] 软件窗口将在几秒后自动弹出
echo.
npm run dev

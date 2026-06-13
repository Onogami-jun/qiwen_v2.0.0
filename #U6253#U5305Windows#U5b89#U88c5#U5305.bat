@echo off
cd /d "%~dp0"
echo  [启文] 开始打包 Windows 安装包...
if not exist "node_modules" (
    npm config set registry https://registry.npmmirror.com
    call npm install
)
call npm run build:renderer
call npm run build:win
echo.
echo  [完成] 安装包已生成在 dist 文件夹中
explorer dist
pause

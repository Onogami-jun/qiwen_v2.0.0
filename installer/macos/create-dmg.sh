#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════
#  启文软件 · macOS DMG 打包脚本
#  依赖: create-dmg (brew install create-dmg)
#  使用: bash create-dmg.sh
# ══════════════════════════════════════════════════════════
set -euo pipefail

APP_NAME="启文"
APP_EN="QiWen"
VERSION=$(node -p "require('../../package.json').version")
DIST_DIR="../../dist"
DMG_NAME="${APP_EN}-${VERSION}-macOS"

echo "🍎 启文 macOS DMG 打包脚本"
echo "版本: ${VERSION}"
echo ""

# 检查依赖
command -v create-dmg &>/dev/null || {
  echo "❌ 需要 create-dmg: brew install create-dmg"
  exit 1
}

# 确保 .app 存在
APP_PATH="${DIST_DIR}/mac/${APP_EN}.app"
[[ -d "$APP_PATH" ]] || { echo "❌ 找不到 ${APP_PATH}，请先运行 npm run build:mac"; exit 1; }

echo "📦 正在创建 DMG..."

create-dmg \
  --volname "${APP_NAME} ${VERSION}" \
  --volicon "../../assets/icon.icns" \
  --background "assets/dmg-background.png" \
  --window-pos 200 120 \
  --window-size 660 440 \
  --icon-size 128 \
  --icon "${APP_EN}.app" 160 200 \
  --hide-extension "${APP_EN}.app" \
  --app-drop-link 500 200 \
  --no-internet-enable \
  --codesign "${APPLE_SIGN_IDENTITY:-}" \
  --notarize "${APPLE_NOTARIZE_PROFILE:-}" \
  "${DIST_DIR}/${DMG_NAME}.dmg" \
  "$APP_PATH"

echo ""
echo "✅ DMG 已创建: ${DIST_DIR}/${DMG_NAME}.dmg"
ls -lh "${DIST_DIR}/${DMG_NAME}.dmg"

#!/bin/bash

# 本地開發環境設置腳本
# 設置 D1 數據庫、應用遷移、啟動開發服務器

set -e

echo "🚀 設置本地開發環境..."

# 檢查必要工具
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI 未安裝。請先安裝: npm install -g wrangler"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm 未安裝。請先安裝 Node.js"
    exit 1
fi

# 1. 創建本地 D1 數據庫
echo "📦 創建本地 D1 數據庫..."
if ! wrangler d1 list | grep -q "twdiw-chat-db"; then
    echo "創建新的 D1 數據庫..."
    wrangler d1 create twdiw-chat-db
    echo "⚠️  請將上面輸出的 database_id 更新到 wrangler.toml 中"
    echo "⚠️  按 Enter 繼續..."
    read
else
    echo "✅ D1 數據庫已存在"
fi

# 2. 應用數據庫遷移
echo "🗄️  應用數據庫遷移..."
wrangler d1 migrations apply twdiw-chat-db --local

# 3. 安裝後端依賴
echo "📦 安裝後端依賴..."
npm install

# 4. 安裝前端依賴
echo "📦 安裝前端依賴..."
cd frontend
npm install
cd ..

# 5. 創建測試數據
echo "🌱 初始化測試數據..."
echo "啟動後端服務器以初始化測試數據..."

# 在背景啟動後端
wrangler dev --local &
BACKEND_PID=$!

# 等待後端啟動
echo "等待後端服務器啟動..."
sleep 5

# 初始化測試數據
echo "初始化測試數據..."
curl -X POST http://localhost:8787/api/dev/seed-data || echo "⚠️  測試數據初始化失敗，請稍後手動執行"

# 停止後端
kill $BACKEND_PID 2>/dev/null || true

echo ""
echo "✅ 本地開發環境設置完成！"
echo ""
echo "🚀 啟動開發服務器:"
echo "   後端: npm run dev        (http://localhost:8787)"
echo "   前端: cd frontend && npm run dev  (http://localhost:3000)"
echo ""
echo "👥 測試用戶:"
echo "   - 測試用戶 (一般): user-1"
echo "   - 金牌會員: user-2"
echo "   - 銀牌會員: user-3"
echo "   - 銅牌會員: user-4"
echo ""
echo "🔧 開發模式功能:"
echo "   - Mock 認證 (跳過 OIDC)"
echo "   - 測試用戶快速登入"
echo "   - Mock VC 驗證"
echo "   - 本地數據庫"
echo ""
echo "📖 更多信息請參考 README.md"

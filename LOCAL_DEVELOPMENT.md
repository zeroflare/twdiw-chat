# 本地開發環境指南

## 🚀 快速開始

### 1. 自動設置（推薦）
```bash
# 執行自動設置腳本
chmod +x dev-setup.sh
./dev-setup.sh
```

### 2. 手動設置
```bash
# 1. 安裝依賴
npm install
cd frontend && npm install && cd ..

# 2. 創建 D1 數據庫
wrangler d1 create twdiw-chat-db
# 將輸出的 database_id 更新到 wrangler.toml

# 3. 應用遷移
wrangler d1 migrations apply twdiw-chat-db --local

# 4. 啟動服務
npm run dev  # 後端 (localhost:8787)
cd frontend && npm run dev  # 前端 (localhost:3000)
```

## 🔧 開發模式特性

### Mock 認證系統
- **跳過 OIDC**: 無需真實的身份提供者
- **測試用戶**: 預設 4 個不同等級的測試用戶
- **快速切換**: 一鍵切換不同用戶身份

### 測試用戶
| 用戶 ID | 暱稱 | 狀態 | 等級 | 用途 |
|---------|------|------|------|------|
| user-1 | 測試用戶 (一般) | GENERAL | - | 測試一般會員功能 |
| user-2 | 金牌會員 | VERIFIED | Gold | 測試最高等級存取 |
| user-3 | 銀牌會員 | VERIFIED | Silver | 測試中等級存取 |
| user-4 | 銅牌會員 | VERIFIED | Bronze | 測試基本等級存取 |

### Mock API 端點
```bash
# 獲取測試用戶列表
GET /api/dev/users

# Mock 登入
POST /api/dev/login/:userId

# 初始化測試數據
POST /api/dev/seed-data

# Mock VC 驗證
POST /api/dev/vc/mock-verify
GET /api/dev/vc/mock-complete/:transactionId
```

## 🎯 測試流程

### 1. 基本功能測試
```bash
# 1. 啟動服務器
npm run dev &
cd frontend && npm run dev &

# 2. 訪問 http://localhost:3000
# 3. 使用開發模式登入面板選擇測試用戶
# 4. 測試各項功能
```

### 2. 等級權限測試
1. **一般會員 (user-1)**:
   - 登入後看到 VC 驗證介面
   - 無法存取任何論壇
   - 看到功能解鎖提示

2. **金牌會員 (user-2)**:
   - 可存取所有等級論壇 (Gold/Silver/Bronze)
   - 顯示已驗證狀態
   - 可使用所有功能

3. **銀牌會員 (user-3)**:
   - 可存取 Silver 和 Bronze 論壇
   - 無法存取 Gold 論壇

4. **銅牌會員 (user-4)**:
   - 只能存取 Bronze 論壇
   - 無法存取 Gold 和 Silver 論壇

### 3. VC 驗證測試
```bash
# 使用一般會員登入後
# 1. 點擊「開始驗證」
# 2. 會顯示 Mock QR 碼
# 3. 系統會自動完成驗證（開發模式）
# 4. 用戶狀態更新為已驗證
```

## 🛠️ 開發工具

### 數據庫管理
```bash
# 查看本地數據庫
wrangler d1 execute twdiw-chat-db --local --command="SELECT * FROM member_profiles"

# 重置數據庫
wrangler d1 migrations apply twdiw-chat-db --local --force

# 查看遷移狀態
wrangler d1 migrations list twdiw-chat-db --local
```

### API 測試
```bash
# 測試 Mock 登入
curl -X POST http://localhost:8787/api/dev/login/user-2

# 測試用戶資訊
curl http://localhost:8787/api/auth/me \
  -H "Cookie: mock-user-id=user-2"

# 測試論壇列表
curl http://localhost:8787/api/forums \
  -H "Cookie: mock-user-id=user-2"
```

### 前端開發
```bash
# 前端開發服務器
cd frontend
npm run dev

# 構建前端
npm run build

# 預覽構建結果
npm run preview
```

## 🔍 除錯指南

### 常見問題

1. **數據庫連接失敗**
   ```bash
   # 檢查 D1 數據庫狀態
   wrangler d1 list
   
   # 重新應用遷移
   wrangler d1 migrations apply twdiw-chat-db --local
   ```

2. **Mock 認證不工作**
   - 檢查 `.dev.vars` 中的 `MOCK_AUTH=true`
   - 確認前端能正確檢測開發模式
   - 查看瀏覽器 Console 錯誤

3. **前端 API 調用失敗**
   - 確認後端服務器運行在 `localhost:8787`
   - 檢查 Vite 代理配置
   - 查看網路請求錯誤

### 日誌查看
```bash
# 後端日誌
wrangler dev --local  # 會顯示所有 console.log

# 前端日誌
# 打開瀏覽器開發者工具 Console 面板
```

### 重置環境
```bash
# 完全重置本地環境
rm -rf node_modules frontend/node_modules
rm -rf .wrangler
npm install
cd frontend && npm install && cd ..
./dev-setup.sh
```

## 📝 開發注意事項

### 環境變數
- 開發模式使用 `.dev.vars` 文件
- 生產模式使用 Wrangler secrets
- 不要將真實的 API 密鑰提交到版本控制

### 數據庫
- 本地使用 SQLite (D1 local mode)
- 生產使用 Cloudflare D1
- 遷移文件會同時應用到兩個環境

### 安全性
- Mock 認證僅在開發模式啟用
- 生產環境會自動使用真實的 OIDC 流程
- 開發模式會在 UI 上顯示明顯標識

## 🚀 部署到生產

```bash
# 1. 設置生產環境密鑰
wrangler secret put OIDC_CLIENT_ID
wrangler secret put OIDC_CLIENT_SECRET
wrangler secret put JWT_SECRET
wrangler secret put ENCRYPTION_KEY
wrangler secret put TWDIW_API_TOKEN

# 2. 創建生產數據庫
wrangler d1 create twdiw-chat-db-prod

# 3. 應用遷移到生產
wrangler d1 migrations apply twdiw-chat-db --remote

# 4. 部署後端
wrangler deploy

# 5. 構建和部署前端
cd frontend
npm run build
wrangler pages deploy dist
```

## 📞 支援

如果遇到問題：
1. 查看本文檔的除錯指南
2. 檢查 GitHub Issues
3. 查看 Cloudflare Workers 文檔
4. 聯繫開發團隊

# Deployment Guide for TWDIW Chat

## Overview
TWDIW Chat 是一個基於 Cloudflare Workers 的單點部署應用程式，整合了 VC 驗證、論壇聊天和用戶配對功能。

## Prerequisites
- Node.js 18+ and npm
- Cloudflare account with Workers access
- Wrangler CLI: `npm install -g wrangler`

## Architecture
採用 **Cloudflare Workers Assets** 單點部署架構：
- **API**: Cloudflare Workers (Hono.js)
- **Frontend**: React SPA (編譯後放在 `public/` 目錄)
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare KV (會話管理)
- **Scheduling**: Cloudflare Cron Triggers (會話清理)

## Configuration

### 1. Environment Variables
複製並編輯配置文件：

```bash
cp .dev.vars.example .dev.vars
cp wrangler.jsonc.example wrangler.jsonc
```

### 2. Secrets Management
設定敏感資訊：

```bash
npx wrangler secret put JWT_SECRET
npx wrangler secret put ENCRYPTION_KEY
npx wrangler secret put OIDC_CLIENT_ID
npx wrangler secret put OIDC_CLIENT_SECRET
npx wrangler secret put TAIWAN_WALLET_API_TOKEN
npx wrangler secret put TWDIW_API_TOKEN
npx wrangler secret put ADMIN_TOKEN
```

### 3. Database Setup
```bash
# 建立 D1 資料庫
npx wrangler d1 create twdiw-chat-db

# 更新 wrangler.jsonc 中的 database_id

# 執行遷移
npx wrangler d1 migrations apply twdiw-chat-db --local
npx wrangler d1 migrations apply twdiw-chat-db --remote
```

## Deployment Steps

### Local Development
```bash
# 安裝依賴
npm install

# 啟動開發服務器 (自動編譯前端)
npm run dev

# 訪問 http://localhost:8787
```

### Production Deployment
```bash
# 部署到 Cloudflare Workers (自動編譯前端)
npm run deploy

# 執行生產環境資料庫遷移
npm run db:migrate:remote

# 應用程式將可在以下網址訪問：
# https://twdiw-chat.<your-subdomain>.workers.dev
```

## API Endpoints

### Authentication
- `GET /api/auth/me` - 取得當前用戶資訊
- `GET /api/auth/login` - OIDC 登入
- `GET /api/auth/callback` - OIDC 回調
- `POST /api/auth/logout` - 登出

### VC Verification
- `POST /api/vc/verify/start` - 開始 VC 驗證
- `GET /api/vc/verify/poll/:transactionId` - 輪詢驗證狀態

### Forums
- `GET /api/forums` - 取得論壇列表
- `GET /api/forums/:forumId/chat` - 取得論壇聊天資訊

### Matching & Chat
- `POST /api/chat/daily-matching` - 每日配對
- `GET /api/chat/private/:sessionId` - 私人聊天

### Debug (Development)
- `POST /api/debug/vc/clear-cache` - 清除 VC 驗證快取
- `POST /api/debug/vc/force-check/:transactionId` - 強制檢查驗證狀態

## Testing

### Acceptance Test
1. 訪問部署的 URL
2. 使用 OIDC 登入
3. 進行 VC 驗證流程
4. 確認 QR Code 顯示
5. 使用 moda 數位錢包掃描
6. 驗證狀態應更新為成功
7. 測試論壇存取和配對功能

### Manual Testing Checklist
- [ ] 靜態資源正確載入
- [ ] OIDC 認證流程正常
- [ ] VC 驗證成功啟動
- [ ] QR Code 正確顯示
- [ ] 輪詢機制檢測驗證完成
- [ ] 用戶狀態正確更新
- [ ] 論壇存取權限正確
- [ ] 配對功能正常運作
- [ ] tlk.io 聊天整合正常

## Monitoring

### Health Check
```bash
curl https://your-worker.workers.dev/health
```

### Logs
```bash
# 即時日誌
npx wrangler tail

# 特定時間範圍
npx wrangler tail --since 1h
```

### Metrics
- 在 Cloudflare Dashboard 查看 Workers 指標
- 監控 API 錯誤率和回應時間
- 檢查 D1 資料庫查詢效能

## Troubleshooting

### Common Issues

#### 1. 靜態資源 404
```bash
# 確認前端已建置並複製到 public/
ls -la public/
```

#### 2. VC 驗證失敗
- 檢查 `TAIWAN_WALLET_API_TOKEN` 是否正確
- 確認 `TWDIW_REF` 參數正確
- 查看 Workers 日誌中的錯誤訊息

#### 3. 資料庫連接問題
```bash
# 測試資料庫連接
npx wrangler d1 execute twdiw-chat-db --command "SELECT 1"
```

#### 4. OIDC 認證問題
- 確認 `OIDC_CLIENT_ID` 和 `OIDC_CLIENT_SECRET`
- 檢查 `OIDC_REDIRECT_URI` 是否匹配部署域名

### Rollback Plan
```bash
# 回滾到上一個版本
npx wrangler rollback

# 或刪除部署
npx wrangler delete twdiw-chat
```

## Security Considerations

### Data Protection
- 所有 PII 資料使用 AES-256-GCM 加密
- JWT 使用 HS256 演算法簽名
- 會話資料儲存在 Cloudflare KV

### Access Control
- 基於等級的存取控制 (RBAC)
- Rate limiting 防止 API 濫用
- CORS 嚴格限制允許的來源

### Secrets Management
- 使用 Wrangler secrets 管理敏感資訊
- 定期輪換 API 金鑰
- 監控異常存取模式

## Support
如有問題，請：
1. 檢查 Cloudflare Workers 文件
2. 查看專案 GitHub Issues
3. 聯絡開發團隊

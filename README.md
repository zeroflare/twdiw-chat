# TWDIW Chat - Token-Gated Forum & Matching Platform

一個基於 Verifiable Credentials (VC) 的代幣門控聊天應用程式，使用者需要透過階級卡驗證來存取專屬論壇並與同等級用戶配對聊天。

## 🌟 功能特色

### 🎫 VC 驗證系統
- **階級卡驗證**: 透過 Taiwan Wallet 政府數位錢包驗證數位憑證
- **智能輪詢**: 即時檢測驗證狀態更新，自動停止輪詢
- **快取機制**: 30 秒 TTL 快取，減少 API 負載
- **等級系統**: 支援五個等級的階級卡
  - 🥇 地球OL財富畢業證書持有者 (EARTH_OL_GRADUATE)
  - 🏆 人生勝利組S級玩家 (LIFE_WINNER_S)
  - 💎 準富豪VIP登錄證 (QUASI_WEALTHY_VIP)
  - 👑 尊爵不凡．小資族認證 (DISTINGUISHED_PETTY)
  - 🌱 新手村榮譽村民證 (NEWBIE_VILLAGE)

### 💬 論壇系統
- **等級門控**: 只有相應等級用戶可存取論壇
- **相鄰等級存取**: 允許相鄰等級用戶互動
- **即時聊天**: 整合 tlk.io 提供即時聊天功能

### 🤝 配對系統
- **每日配對**: 同等級用戶每日配對機會
- **私人聊天**: 配對成功後開啟專屬聊天室
- **智能排隊**: 自動配對演算法

### 🔐 安全特性
- **OIDC 認證**: 標準 OpenID Connect 身份驗證
- **資料加密**: PII 資料使用 AES-256-GCM 加密
- **會話管理**: 安全的 JWT 會話管理
- **CORS 保護**: 嚴格的跨域請求控制

## 🏗️ 技術架構

### 單點部署 (Cloudflare Workers + Assets)
- **框架**: Hono.js - 輕量級邊緣運算框架
- **語言**: TypeScript 5.x
- **資料庫**: Cloudflare D1 (SQLite)
- **儲存**: Cloudflare KV (會話儲存)
- **排程**: Cloudflare Cron Triggers (每 5 分鐘清理會話)
- **靜態資源**: Cloudflare Workers Assets (SPA 自動路由)
- **架構模式**: Domain-Driven Design (DDD)

### 外部整合
- **Taiwan Wallet API**: 政府數位錢包驗證服務 (verifier-sandbox.wallet.gov.tw)
- **TWDIW SSO**: 單一登入服務 (twdiw-sso.zeroflare.tw)
- **tlk.io**: 即時聊天服務

## 🚀 快速開始

### 環境需求
- Node.js 18+
- npm 或 yarn
- Cloudflare 帳戶
- Wrangler CLI

### 本地開發

1. **複製專案**
```bash
git clone https://github.com/zeroflare/twdiw-chat.git
cd twdiw-chat
```

2. **安裝依賴**
```bash
# 後端依賴
npm install

# 前端依賴
cd frontend
npm install
cd ..
```

3. **設定環境變數**
```bash
# 複製環境變數範本
cp .dev.vars.example .dev.vars
cp wrangler.jsonc.example wrangler.jsonc

# 設定 Cloudflare Workers Secrets
npx wrangler secret put JWT_SECRET
npx wrangler secret put ENCRYPTION_KEY
npx wrangler secret put OIDC_CLIENT_ID
npx wrangler secret put OIDC_CLIENT_SECRET
npx wrangler secret put TAIWAN_WALLET_API_TOKEN
```

4. **資料庫設定**
```bash
# 建立 D1 資料庫
npx wrangler d1 create twdiw-chat-db

# 執行遷移
npx wrangler d1 migrations apply twdiw-chat-db --local
npx wrangler d1 migrations apply twdiw-chat-db --remote
```

5. **啟動開發環境**
```bash
# 自動編譯前端並啟動 Workers 開發服務器
npm run dev
```

### 部署到生產環境

1. **單點部署**
```bash
# 自動編譯前端並部署 Workers (包含 API 和靜態資源)
npm run deploy

# 執行生產環境資料庫遷移
npm run db:migrate:remote
```

## 📁 專案結構

```
twdiw-chat/
├── src/                          # 後端原始碼
│   ├── api/                      # API 路由
│   │   ├── auth.ts              # 認證端點
│   │   ├── chat.ts              # 聊天相關 API
│   │   ├── forums.ts            # 論壇 API
│   │   └── vc-verification.ts   # VC 驗證 API
│   ├── domain/                   # 領域層 (DDD)
│   │   ├── entities/            # 實體
│   │   ├── value-objects/       # 值物件
│   │   └── services/            # 領域服務
│   ├── infrastructure/          # 基礎設施層
│   │   ├── repositories/        # 資料存取
│   │   ├── services/            # 外部服務
│   │   └── security/            # 安全相關
│   ├── middleware/              # 中介軟體
│   └── index.ts                 # 主要入口點
├── frontend/                     # 前端原始碼
│   ├── src/
│   │   ├── components/          # React 組件
│   │   ├── hooks/               # 自定義 Hooks
│   │   ├── services/            # API 服務
│   │   └── utils/               # 工具函數
│   └── public/                  # 靜態資源
├── migrations/                   # 資料庫遷移
├── tests/                       # 測試檔案
└── .specify/                    # 專案規格與記憶
```

## 🔧 配置說明

### Wrangler 配置 (wrangler.jsonc)
```jsonc
{
  "name": "twdiw-chat",
  "main": "src/index.ts",
  "compatibility_date": "2024-11-01",
  "compatibility_flags": ["nodejs_compat"],
  
  "kv_namespaces": [
    {
      "binding": "twdiw_chat_session",
      "id": "your-kv-namespace-id"
    }
  ],
  
  "d1_databases": [
    {
      "binding": "twdiw_chat_db",
      "database_name": "twdiw-chat-db",
      "database_id": "your-d1-database-id"
    }
  ],
  
  "vars": {
    "TWDIW_API_ENDPOINT": "https://verifier-sandbox.wallet.gov.tw",
    "OIDC_ISSUER_URL": "https://twdiw-sso.zeroflare.tw",
    "FRONTEND_URL": "https://twdiw-chat.pages.dev"
  }
}
```

### 環境變數
| 變數名稱 | 描述 | 必需 |
|---------|------|------|
| `JWT_SECRET` | JWT 簽名密鑰 | ✅ |
| `ENCRYPTION_KEY` | 資料加密密鑰 | ✅ |
| `OIDC_CLIENT_ID` | OIDC 客戶端 ID | ✅ |
| `OIDC_CLIENT_SECRET` | OIDC 客戶端密鑰 | ✅ |
| `TAIWAN_WALLET_API_TOKEN` | Taiwan Wallet API 權杖 | ✅ |
| `TWDIW_API_TOKEN` | TWDIW API 權杖 | ✅ |
| `ADMIN_TOKEN` | 管理員權杖 | ✅ |

## 🧪 測試

### 執行測試
```bash
# 執行所有測試
npm test

# 執行特定測試
npm test -- --grep "VCVerification"

# 測試覆蓋率
npm run test:coverage
```

### 開發模式測試
在開發環境中，可以使用 Mock 認證進行測試：
1. 設定 `DEV_MODE=true` 和 `MOCK_AUTH=true`
2. 使用開發面板中的測試用戶登入
3. 測試 VC 驗證流程

## 📊 API 文件

### 認證 API
- `GET /api/auth/me` - 取得當前用戶資訊
- `GET /api/auth/login` - OIDC 登入
- `GET /api/auth/callback` - OIDC 回調
- `POST /api/auth/logout` - 登出

### VC 驗證 API
- `POST /api/vc/verify/start` - 開始 VC 驗證
- `GET /api/vc/verify/poll/:transactionId` - 輪詢驗證狀態

### 論壇 API
- `GET /api/forums` - 取得論壇列表
- `GET /api/forums/:forumId/chat` - 取得論壇聊天資訊

### 配對 API
- `POST /api/chat/daily-matching` - 每日配對
- `GET /api/chat/private/:sessionId` - 私人聊天

## 🔒 安全考量

### 資料保護
- 所有 PII 資料使用 AES-256-GCM 加密
- JWT 使用 HS256 演算法簽名
- 會話資料儲存在 Cloudflare KV

### 存取控制
- 基於等級的存取控制 (RBAC)
- CORS 嚴格限制允許的來源
- Rate limiting 防止 API 濫用

### 認證流程
1. OIDC 認證取得身份
2. VC 驗證確認等級
3. JWT 會話管理
4. 定期會話清理

## 🚀 部署架構

```
┌─────────────────────────────────────────────────────────────┐
│                Cloudflare Workers                           │
│  ┌─────────────────┐    ┌──────────────────┐              │
│  │  Static Assets  │    │  API Endpoints   │              │
│  │  (Frontend)     │◄──►│  (Backend)       │◄──────────┐  │
│  │  /public/*      │    │  /api/*          │           │  │
│  └─────────────────┘    └──────────────────┘           │  │
└─────────────────────────────────────────────────────────│──┘
                                  │                       │
                                  ▼                       │
                       ┌──────────────────┐               │
                       │  Cloudflare D1   │               │
                       │  (Database)      │               │
                       └──────────────────┘               │
                                                          │
                                                          ▼
                                                ┌─────────────────┐
                                                │  Taiwan Wallet  │
                                                │  API            │
                                                │  (VC Verify)    │
                                                └─────────────────┘
```

## 📈 監控與日誌

### 生產環境
- Cloudflare Analytics 監控請求
- Workers 日誌記錄錯誤
- D1 查詢效能監控

### 開發環境
- 詳細的 Console 日誌
- API 請求追蹤
- 輪詢狀態監控

## 🤝 貢獻指南

1. Fork 專案
2. 建立功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交變更 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 開啟 Pull Request

### 開發規範
- 遵循 TypeScript 嚴格模式
- 使用 Prettier 格式化程式碼
- 撰寫單元測試
- 遵循 Domain-Driven Design 原則

## 📄 授權

本專案採用 MIT 授權 - 詳見 [LICENSE](LICENSE) 檔案

## 🆘 支援

如有問題或需要協助：
- 開啟 [GitHub Issue](https://github.com/zeroflare/twdiw-chat/issues)
- 查看 [Wiki 文件](https://github.com/zeroflare/twdiw-chat/wiki)
- 聯絡開發團隊

## 🔄 版本歷史

### v1.1.0 (2025-11-11)
- ✅ 修正 VC 驗證前後端狀態同步問題
- ✅ 優化輪詢機制，確保驗證完成後正確停止
- ✅ 改進 DID 處理邏輯，符合官方 VP API 規範
- ✅ 完善單點部署配置和文件

### v1.0.0 (2025-11-10)
- ✅ 完整的 VC 驗證系統
- ✅ 論壇與配對功能
- ✅ 安全的認證機制
- ✅ 生產環境部署

---

**Built with ❤️ using Cloudflare Workers & React**

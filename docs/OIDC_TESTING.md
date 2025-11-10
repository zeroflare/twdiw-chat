# OIDC 本地測試指南

## 概述

本專案支援兩種本地開發認證模式：
1. **真實 OIDC 認證** - 測試完整的 OIDC 流程
2. **Mock 用戶認證** - 快速功能測試

## 設定真實 OIDC 測試

### 1. 取得 OIDC 憑證

從生產環境取得相同的 OIDC 憑證：

```bash
# 檢視雲端設定的 secrets
wrangler secret list

# 複製到本地開發環境 (使用與生產環境相同的值)
wrangler secret put OIDC_CLIENT_ID --local
wrangler secret put OIDC_CLIENT_SECRET --local
```

### 2. 設定環境變數

複製 `.dev.vars.example` 到 `.dev.vars`：

```bash
cp .dev.vars.example .dev.vars
```

編輯 `.dev.vars` 檔案，確認 OIDC 配置與生產環境一致：

```bash
# 關閉 Mock 認證以啟用真實 OIDC
MOCK_AUTH=false

# OIDC 配置 (與生產環境相同)
OIDC_ISSUER_URL=https://twdiw-sso.zeroflare.tw
OIDC_REDIRECT_URI=http://localhost:8787/api/auth/callback
```

**重要**：本地環境的 `OIDC_REDIRECT_URI` 必須設為 `http://localhost:8787/api/auth/callback`

### 3. 啟動開發環境

```bash
npm run dev
```

### 4. 測試 OIDC 流程

1. 開啟 http://localhost:8787
2. 在開發面板中選擇「真實 OIDC 登入」
3. 點擊「登入 / 註冊」按鈕
4. 完成 OIDC 認證流程

## 切換回 Mock 認證

如需快速測試功能，可以：

1. **方法一**：在開發面板中選擇「Mock 用戶登入」
2. **方法二**：修改 `.dev.vars` 設定 `MOCK_AUTH=true`

## 驗證測試結果

### OIDC 認證成功指標：
- ✅ 成功重導向到 OIDC 提供者 (twdiw-sso.zeroflare.tw)
- ✅ 完成認證後正確回調到本地應用
- ✅ 取得真實的 JWT token
- ✅ 用戶資訊正確顯示

### 常見問題排除：

**問題**：OIDC 回調失敗
**解決**：
1. 確認 `OIDC_REDIRECT_URI` 設定為 `http://localhost:8787/api/auth/callback`
2. 檢查 OIDC 提供者是否允許 localhost 回調

**問題**：認證後無法取得用戶資訊
**解決**：檢查 `OIDC_CLIENT_ID` 和 `OIDC_CLIENT_SECRET` 是否與生產環境相同

**問題**：開發面板未顯示
**解決**：確認瀏覽器訪問 `localhost:8787`（非其他 port）

## 生產環境部署

生產環境會自動使用真實 OIDC，無需額外設定。確保以下 secrets 已正確配置：

```bash
wrangler secret put OIDC_CLIENT_ID
wrangler secret put OIDC_CLIENT_SECRET
wrangler secret put JWT_SECRET
wrangler secret put ENCRYPTION_KEY
```

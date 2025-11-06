# Feature Specification: 三人行必有我師論壇

## 1. Overview

### Feature Name
三人行必有我師論壇

### Feature Description
本專案旨在建立一個以「階級卡」W3C 可驗證憑證 (Verifiable Credential, VC) 為基礎的社群平台。使用者透過 OIDC 單一登入 (SSO) 後，可選擇性地提供其「階級卡 VC」進行驗證，從而進入專屬的階級分群論壇，並獲得每日配對的機會，實現更精準、多元的互動。

## 2. User Scenarios & Testing

### 2.1 OIDC 登入與會員註冊
- **Scenario**: 新使用者首次透過 OIDC 登入並註冊。
  - **Steps**:
    1. 使用者點擊「登入/註冊」。
    2. 系統導向 OIDC Provider 進行身份驗證。
    3. 使用者在 OIDC Provider 完成驗證。
    4. OIDC Provider 導回本站，後端驗證 Token，建立新的會員資料。
    5. 新會員填寫自我宣告資料（暱稱、性別、興趣等）。
- **Expected Outcome**: 使用者成功註冊為「一般會員」，並可瀏覽公開頁面。

### 2.2 VC 驗證與管理
- **Scenario**: 已登入會員提交「階級卡 VC」進行驗證。
  - **Steps**:
    1. 已登入會員點擊「驗證階級卡」。
    2. 後端呼叫 `twdiw` API 產生 `authUri` 和 `transactionId`。
    3. 前端導向使用者至錢包 APP 進行 VC 呈現。
    4. 使用者在錢包 APP 完成 VC 呈現。
    5. 使用者從錢包 APP 返回本站，前端開始輪詢後端 API 查詢驗證狀態。
    6. 後端透過 `twdiw` API 查詢結果，更新會員狀態為「已驗證會員」。
    7. **若驗證失敗或超時**：**顯示明確錯誤訊息（說明失敗原因或逾時），並引導使用者重試或聯繫客服。**
- **Expected Outcome**: 使用者成功升級為「已驗證會員」，並解鎖進階功能。

### 2.3 階級分群論壇 (Gated Group Chat) 存取
- **Scenario**: 已驗證會員進入其階級對應的群組論壇。
  - **Steps**:
    1. 已驗證會員點擊「進入群組論壇」。
    2. 後端檢查會員階級權限。
    3. 後端回傳 `tlkChannelId` 和使用者暱稱。
    4. 前端載入 `tlk.io` 群組聊天室。
- **Expected Outcome**: 已驗證會員成功進入其階級對應的群組聊天室。

### 2.4 每日配對 (Daily Matching) - 隨機私聊機會
- **Scenario**: 已驗證會員獲得一次與其他相似會員的隨機私聊機會。
  - **Steps**:
    1. 已驗證會員點擊「每日配對」。
    2. 後端尋找相似會員，生成一個專屬的 `tlk.io` 私聊頻道 ID。**若最初配對的使用者不線上，系統會自動重新配對，並優先考慮未曾配對過的線上使用者。**
    3. 後端回傳 `tlkChannelId` 和使用者暱稱。
    4. 前端載入 `tlk.io` 私聊聊天室。
- **Expected Outcome**: 已驗證會員成功進入與相似會員的私聊聊天室。

### 2.5 每日配對 (Daily Matching) - 群聊轉私聊
- **Scenario**: 已驗證會員在群聊中向另一位會員發送私聊邀請並成功建立私聊。
  - **Steps"**: 
    1. 在群組聊天室介面中，已驗證會員點擊或懸停在其他成員的暱稱/頭像上。
    2. 彈出上下文選單，選擇「發送私聊邀請」。
    3. 後端接收邀請，儲存並通知被邀請者。
    4. 被邀請者收到通知，選擇接受。
    5. 後端生成一個專屬的 `tlk.io` 私聊頻道 ID。
    6. 前端無縫切換到新的私聊聊天室。
- **Expected Outcome**: 雙方成功建立並進入私聊聊天室。

## 3. Functional Requirements

- **FR1**: 系統必須支援透過 OIDC Provider 進行使用者登入與註冊。
- **FR2**: 系統必須允許使用者在註冊時填寫自我宣告資料（暱稱、性別、興趣等）。
- **FR3**: 系統必須提供機制讓使用者提交「階級卡 VC」進行驗證。
- **FR4**: 系統必須透過 `twdiw` API 執行 VC 驗證流程（包含 `qrcode` 產生與 `result` 查詢）。
- **FR5**: 系統必須根據 VC 驗證結果，將會員區分為「一般會員」和「已驗證會員」。
- **FR6**: 系統必須為「已驗證會員」提供存取其階級對應的群組聊天室的權限。
- **FR7**: 系統必須支援「每日配對」功能，包含隨機私聊機會和群聊轉私聊。
- **FR8**: 系統必須使用 `tlk.io` 嵌入式服務提供所有聊天功能（群組與私聊）。
- **FR9**: 系統必須在配對人數不足時，優先為「已驗證會員」進行配對。
- **FR10**: 系統必須在群聊中提供發送和接受私聊邀請的介面與邏輯。
- **FR11**: 系統必須對使用者自我宣告的敏感資料（如性別、興趣）採取加密儲存，並確保僅限授權人員存取。
- **FR12**: 若 `tlk.io` 聊天服務不可用或載入失敗，系統必須向使用者顯示服務中斷訊息，並引導使用者稍後重試。
- **FR13**: 系統必須在「每日配對」功能中，若最初配對的使用者不線上，自動重新配對，並優先考慮未曾配對過的線上使用者。

## 4. Success Criteria

- **SC1**: 99% 的使用者能在 30 秒內完成 OIDC 登入與註冊流程。
- **SC2**: 95% 的已驗證會員能在 60 秒內完成「階級卡 VC」提交與驗證流程。
- **SC3**: 100% 的已驗證會員能成功進入其階級對應的群組聊天室。
- **SC4**: 90% 的已驗證會員在點擊「每日配對」後，能在 10 秒內成功進入私聊聊天室。
- **SC5**: 95% 的私聊邀請能在 5 秒內送達被邀請者，且雙方能在 10 秒內成功建立私聊。
- **SC6**: 在配對人數不足時，已驗證會員的配對成功率比一般會員高出至少 20%。

## 5. Key Entities

- **Member Profile**: 包含 `memberId` (內部唯一識別), `oidcSubjectId` (OIDC 主體識別碼，作為主要外部識別鍵), `status` (一般會員/已驗證會員), `selfDeclaredProfile` (暱稱、性別、興趣等), `linkedVcDid` (連結的 VC DID，作為次要外部識別鍵), `derivedRank`。
- **Forum**: 包含 `forumId`, `requiredRank`, `description`, `tlkChannelId`。
- **Forum Post**: 包含 `postId`, `forumId`, `authorId`, `content`, `createdAt`。
- **Private Chat Session**: 包含 `sessionId`, `memberAId`, `memberBId`, `tlkChannelId`, `createdAt`, `expiresAt`, `type` (daily_match/group_initiated)。**會話到期後，系統應自動終止會話並清除相關資料。**

## 6. Assumptions

- `twdiw` API 穩定可用，且其 `ref` 參數（驗證服務代碼）已預先配置。
- `tlk.io` 服務穩定可用，並能支援動態生成頻道 ID 和嵌入式聊天。
- OIDC Provider 穩定可用，並能提供有效的 ID Token。
- 使用者擁有兼容的數位憑證錢包 APP，並能順利進行 VC 呈現。
- 系統能夠根據會員的自我宣告資料和 VC 聲明（如階級、興趣）進行相似度匹配。

## 7. Clarifications

### Session 2025-11-06
- Q: How are OIDC 'sub' and VC 'did' linked to a single Member Profile? → A: oidcSubjectId is the primary key, linkedVcDid is a foreign key.
- Q: What is the UX for failed/long-pending VC verification? → A: 顯示明確錯誤訊息並引導重試。
- Q: What specific data protection measures are needed for self-declared data? → A: 採取加密儲存，並僅限授權人員存取。
- Q: What is the fallback UX if `tlk.io` chat service is unavailable or fails to load? → A: 顯示服務中斷訊息，引導使用者稍後重試。
- Q: What happens to a `Private Chat Session` after its `expiresAt` timestamp is reached? → A: 自動終止會話，並清除相關資料。
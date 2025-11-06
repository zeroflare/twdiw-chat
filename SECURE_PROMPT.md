# 落實《Secure by Design / Secure by Default》原則的程式碼撰寫指南

## 1. 遵循《安全開發框架》

* 導入《安全軟體開發生命周期》（如《NIST SSDF》、OWASP 指南）。
* 在架構與設計階段考量安全需求，進行《威脅建模》與《風險評估》。
* 撰寫程式碼時遵循《安全編碼標準》，並搭配：

  * 程式碼審查
  * 自動化安全掃描（SAST/DAST）
  * 單元測試與模擬攻擊測試
* 目標：提早發現漏洞並修補，符合 NCSC 1.1 與 1.3 的安全要求。

---

## 2. 管理《第三方元件風險》

* 減少不必要的外部依賴，只採用持續維護的函式庫。
* 使用《軟體組成分析（SCA）》工具產出《SBOM》，追蹤套件版本與漏洞狀態。
* 當元件曝露漏洞時，及時更新或套用補丁。
* 對應 NCSC 1.2 關於第三方組件管理的要求。

---

## 3. 預設即提供安全設定

* 軟體產品「開箱即安全」，《必要功能》預設啟用，《高風險功能》預設關閉。
* 例如：

  * 預設強制身份驗證
  * 預設開啟日誌與存取控制
  * 不常用或高風險介面預設禁用
* 對應 CISA「Secure out of the box」與 NCSC 1.4 的精神。

---

## 4. 使用者保護與易用性優先

* 簡化安全設定，避免使用者需自行判斷複雜選項。
* 例如：

  * 預設加密連線、自動證書管理
  * 清晰的安全狀態提示與安全預設值
* 對應 CISA「Minimal User Burden」與 Saltzer & Schroeder《心理可接受性》原則。

---

## 5. 實施《最小權限》與《預設加密》

* 《最小權限》：模組與服務僅具備必要權限。

  * 例：資料庫存取僅限只讀或指定資料表。
* 《預設加密》：所有傳輸與存儲皆採安全加密。

  * 例：預設 TLS、敏感資料加密/哈希存放。
* Cloudflare「Universal SSL」為範例，無需手動設定即強制啟用加密。
* 對應 NCSC 1.4 與 CISA 對預設安全功能的倡議。

---

## 6. 供應商安全責任與透明度

* 開發廠商應承擔安全責任，避免將風險轉嫁給使用者。
* 程式碼應避免：

  * 預設憑證或後門
  * 延遲修補漏洞
* 建立漏洞揭露與更新流程，保持透明。
* 對應 CISA「Vendor Accountability」與 NCSC 守則。

---

## 7. 自動更新與事件回報機制

* 軟體預設包含：

  * 自動更新模組（或便利的更新流程）
  * 安全事件日誌（異常登入、錯誤配置、異常流量）
  * 攻擊與錯誤回報管道
* 確保軟體生命週期中持續安全。
* 對應 CISA「Automatic Updates and Reporting」原則。

---

## 總結

* 將《安全 by 設計》與《預設安全》融入程式碼撰寫，能確保軟體從一開始就以安全為核心。
* 關鍵在於「安全與易用性平衡」：降低使用者負擔，同時強化產品防護。
* 最終目標：讓安全成為產品品質的一部分，而非事後補救。

---

## 參考資料

* CISA: [Principles and Approaches for Secure by Design and Default, 2023](https://www.cisa.gov)
* NCSC (UK): [Software Security Code of Practice, 2025](https://assets.publishing.service.gov.uk)
* Microsoft: [Secure Development Lifecycle](https://learn.microsoft.com)
* Saltzer & Schroeder: 《The Protection of Information in Computer Systems》
* Cloudflare Security Blog: [Secure by Default 指南, 2023](https://blog.cloudflare.com)
# 🎯 Render.com 部署詳細步驟

## ✅ 前置檢查

- [x] 代碼已推送到 GitHub
- [x] `server/index.js` 支持 PORT 環境變數
- [x] `package.json` 包含 `start` 腳本

---

## 📋 詳細步驟

### 1. 註冊並登入 Render.com

1. 打開 https://render.com
2. 點擊右上角 **"Get Started"** 或 **"Sign Up"**
3. 選擇 **"Sign up with GitHub"**（推薦）
4. 授權 Render 訪問您的 GitHub 帳號

---

### 2. 創建新的 Web Service

1. 登入後，點擊 **"New +"** 按鈕（右上角）
2. 選擇 **"Web Service"**

---

### 3. 連接 GitHub Repository

#### 方式 A：如果看到您的 repository
- 在列表中找到 **"JUMBO-Bridge"**
- 點擊 **"Connect"**

#### 方式 B：如果沒看到 repository
1. 點擊 **"Configure account"**
2. 在 GitHub 授權頁面中：
   - 向下滾動找到 **"Repository access"**
   - 選擇 **"Only select repositories"**
   - 選擇 **"JUMBO-Bridge"**
   - 點擊 **"Save"**
3. 返回 Render，點擊 **"Connect"**

---

### 4. 配置 Web Service

填寫以下資訊：

```
┌────────────────────────────────────────┐
│ Name                                   │
│ jumbo-bridge-server                    │  ← 任意名稱，建議用這個
├────────────────────────────────────────┤
│ Region                                 │
│ Singapore                              │  ← 選擇最近的區域
├────────────────────────────────────────┤
│ Branch                                 │
│ master                                 │  ← 您的主分支
├────────────────────────────────────────┤
│ Root Directory                         │
│ (留空)                                  │  ← 不需要填寫
├────────────────────────────────────────┤
│ Runtime                                │
│ Node                                   │  ← 自動偵測
├────────────────────────────────────────┤
│ Build Command                          │
│ npm install                            │  ← 自動填入
├────────────────────────────────────────┤
│ Start Command                          │
│ npm start                              │  ← 自動填入（使用 package.json 的 start 腳本）
└────────────────────────────────────────┘
```

#### 關鍵設定：

**✅ Start Command 必須是：**
```bash
npm start
```
或
```bash
node server/index.js
```

---

### 5. 選擇計劃

- 選擇 **"Free"** 計劃
- 免費版特點：
  - ✅ 512 MB RAM
  - ✅ 自動 HTTPS
  - ⚠️ 閒置 15 分鐘後休眠（首次訪問需等待 30-60 秒喚醒）

---

### 6. 高級設定（可選，通常不需要）

向下滾動到 **"Advanced"** 區段，可以設定：

#### 環境變數（Environment Variables）
通常不需要，但如果需要可以添加：
```
NODE_ENV = production
PORT = 10000  ← Render 會自動設定，不需要手動添加
```

#### Auto-Deploy（自動部署）
- 預設：✅ **Yes**（推薦）
- 每次推送到 master 分支時自動重新部署

---

### 7. 創建 Web Service

1. 檢查所有設定
2. 點擊頁面底部的 **"Create Web Service"** 按鈕
3. 等待部署開始

---

### 8. 監控部署進度

部署過程大約需要 **3-5 分鐘**，您會看到：

```
┌─────────────────────────────────────┐
│ 🟡 Building...                      │
│    ├─ Installing dependencies       │
│    └─ npm install                   │
├─────────────────────────────────────┤
│ 🟡 Starting...                      │
│    └─ npm start                     │
├─────────────────────────────────────┤
│ ✅ Live                             │
│    Your service is live!            │
└─────────────────────────────────────┘
```

#### 查看日誌（Logs）
點擊頂部的 **"Logs"** 標籤，應該會看到：
```
Server running on port 10000
Environment: production
```

---

### 9. 獲取服務 URL

部署成功後，在頁面頂部您會看到：

```
┌───────────────────────────────────────────────────┐
│ https://jumbo-bridge-server.onrender.com         │  ← 您的後端伺服器 URL
└───────────────────────────────────────────────────┘
```

**複製這個 URL！** 我們需要在前端配置中使用它。

---

### 10. 測試後端伺服器

1. 打開新的瀏覽器標籤
2. 訪問您的伺服器 URL（上面獲取的）
3. 您可能會看到：
   - **Cannot GET /**（這是正常的！表示伺服器運行中）
   - 或者空白頁面

要真正測試 Socket.IO 連接，您需要使用前端應用。

---

### 11. 配置前端使用新的後端 URL

在本地電腦上：

#### 步驟 A：創建 `.env.production` 文件

```bash
cd "d:\JUMBO Bridge"
New-Item -Path .env.production -ItemType File -Force
```

#### 步驟 B：編輯文件內容

在 `.env.production` 中添加（替換成您的實際 URL）：

```env
VITE_SERVER_URL=https://jumbo-bridge-server.onrender.com
```

**⚠️ 注意：**
- 不要有多餘的空格
- 不要加引號
- 確保 URL 正確（不要漏掉 https://）

---

### 12. 更新 CORS 設定

確保後端允許來自 GitHub Pages 的請求：

編輯 `server/index.js`，找到 CORS 設定並更新為：

```javascript
const io = new Server(server, {
    cors: {
        origin: [
            "http://localhost:3001",                          // 本地開發
            "https://你的用戶名.github.io"                    // GitHub Pages
        ],
        methods: ["GET", "POST"],
        credentials: true
    }
});
```

---

### 13. 重新構建並部署前端

```bash
# 1. 構建（會使用 .env.production）
npm run build

# 2. 測試本地預覽（可選）
npm run preview

# 3. 提交更改
git add .
git commit -m "config: Add production server URL for Render.com"
git push origin master
```

等待 2-3 分鐘讓 GitHub Actions 完成部署。

---

### 14. 測試完整應用

1. 訪問您的 GitHub Pages：
   ```
   https://你的用戶名.github.io/JUMBO-Bridge/
   ```

2. 如果是首次訪問 Render 伺服器（休眠中）：
   - 可能需要等待 **30-60 秒**
   - 畫面會顯示 "Waiting for server..."
   - 這是正常的！等待伺服器喚醒即可

3. 成功連接後：
   - ✅ 可以登入
   - ✅ 可以進入大廳
   - ✅ 可以進入房間
   - ✅ 可以開始遊戲！

---

## 🎉 完成！

您的 JUMBO Bridge 現在已經完全部署在雲端了！

```
┌────────────────────────────────────────┐
│ 前端：GitHub Pages                     │
│ https://你的用戶名.github.io/JUMBO-Bridge/│
├────────────────────────────────────────┤
│ 後端：Render.com                       │
│ https://jumbo-bridge-server.onrender.com│
└────────────────────────────────────────┘
```

---

## 🔧 常見問題

### Q1: 首次訪問很慢怎麼辦？
**A:** 免費版會在閒置 15 分鐘後休眠，首次訪問需要 30-60 秒喚醒。這是正常現象。

### Q2: 如何查看伺服器日誌？
**A:** 在 Render.com 的服務頁面，點擊頂部的 "Logs" 標籤。

### Q3: 如何更新後端代碼？
**A:** 直接推送到 GitHub，Render 會自動重新部署（如果開啟了 Auto-Deploy）。

### Q4: 連接失敗怎麼辦？
**A:** 檢查：
1. Render 服務是否正常運行（狀態為 "Live"）
2. `.env.production` 中的 URL 是否正確
3. CORS 設定是否包含您的 GitHub Pages 域名
4. 瀏覽器控制台（F12）中的錯誤訊息

### Q5: 如何升級到付費版？
**A:** 在 Render 服務頁面，Settings → 選擇不同的 Plan。

---

## 📞 需要幫助？

如果在任何步驟遇到問題，請告訴我：
1. 在哪個步驟遇到問題
2. 看到什麼錯誤訊息
3. Render 日誌中的內容（如果有）

我會立即幫您解決！💪

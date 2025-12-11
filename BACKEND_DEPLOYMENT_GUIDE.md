# 🚀 部署後端伺服器指南

## 問題說明

您的 JUMBO Bridge 遊戲包含兩個部分：

1. **前端（React）**：已成功部署到 GitHub Pages ✅
2. **後端（Node.js + Socket.IO）**：需要另外部署 ❌

GitHub Pages 只能託管靜態網站，無法運行 Node.js 伺服器。因此需要將後端部署到其他平台。

---

## 🎯 推薦方案：Render.com（免費）

### 步驟 1：準備後端代碼

1. 確保 `server/index.js` 中的端口配置支持環境變數：

```javascript
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

2. 更新 `package.json` 添加啟動腳本：

```json
{
  "scripts": {
    "start": "node server/index.js",
    "dev": "concurrently \"node server/index.js\" \"vite --host\"",
    "build": "vite build"
  }
}
```

### 步驟 2：在 Render.com 上部署

1. **註冊 Render.com**

   - 前往 https://render.com
   - 使用 GitHub 帳號登入

2. **創建新的 Web Service**

   - 點擊 "New +" → "Web Service"
   - 連接您的 GitHub repository（JUMBO-Bridge）

3. **配置服務**

   ```
   Name: jumbo-bridge-server
   Region: Singapore (或選擇最近的)
   Branch: master
   Runtime: Node
   Build Command: npm install
   Start Command: node server/index.js
   Plan: Free
   ```

4. **添加環境變數**（如果需要）

   - 在 "Environment" 標籤中添加
   - 目前可能不需要

5. **部署**

   - 點擊 "Create Web Service"
   - 等待 5-10 分鐘完成部署

6. **獲取伺服器 URL**
   - 部署完成後，您會得到類似：
   - `https://jumbo-bridge-server.onrender.com`

### 步驟 3：更新前端配置

1. 創建 `.env.production` 文件：

```bash
VITE_SERVER_URL=https://jumbo-bridge-server.onrender.com
```

2. 重新構建並部署前端：

```bash
npm run build
git add .
git commit -m "Update production server URL"
git push origin master
```

### 步驟 4：更新 CORS 設定

確保 `server/index.js` 中的 CORS 允許您的 GitHub Pages 域名：

```javascript
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3001", "https://您的用戶名.github.io"],
    methods: ["GET", "POST"],
  },
});
```

---

## 🔄 其他部署平台選項

### Railway.app（免費額度）

- 網址：https://railway.app
- 優點：簡單易用，自動部署
- 缺點：免費額度有限

### Heroku（需付費）

- 網址：https://heroku.com
- 優點：成熟穩定
- 缺點：不再提供免費方案

### Fly.io（免費額度）

- 網址：https://fly.io
- 優點：全球 CDN
- 缺點：配置稍複雜

---

## 📝 完整部署流程總結

```
1. 部署後端到 Render.com
   ↓
2. 獲取後端伺服器 URL
   ↓
3. 創建 .env.production 文件
   ↓
4. 更新 CORS 設定
   ↓
5. 重新構建並部署前端
   ↓
6. 測試完整應用 ✅
```

---

## 🔧 開發 vs 生產環境

| 環境 | 前端           | 後端           | 配置               |
| ---- | -------------- | -------------- | ------------------ |
| 開發 | localhost:3001 | localhost:3000 | `.env.development` |
| 生產 | GitHub Pages   | Render.com     | `.env.production`  |

---

## ⚠️ 注意事項

1. **免費版限制**：

   - Render.com 免費版可能會在閒置 15 分鐘後休眠
   - 首次訪問需要等待 30-60 秒喚醒

2. **WebSocket 連接**：

   - 確保後端支持 WebSocket
   - Render.com 默認支持

3. **環境變數**：
   - 不要將 `.env.production` 提交到 git
   - 已在 `.gitignore` 中排除

---

## 🆘 需要幫助？

如果您在部署過程中遇到問題，請告訴我具體的錯誤訊息，我會協助您解決！

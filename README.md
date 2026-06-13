# Sequential Circuit Design Automation System

這是一個為**數位邏輯設計課程期末專題**打造的前端網頁工具。使用者只需輸入**狀態轉移表 (State Table)**，系統便會自動推導激勵表、透過可處理 Don't Care 的 **Quine-McCluskey 演算法**進行布林化簡，並即時渲染出對應的 **SVG 邏輯電路圖**。

## 🌟 功能特點
- 💡 **雙模型支援**：相容 Mealy Model 與 Moore Model 序向電路設計。
- ⚡ **正反器可切換**：支援 JK 正反器、T 正反器以及 D 正反器的激勵推導。
- 📊 **動態卡諾圖 (K-Map)**：視覺化展示 3 變數卡諾圖，並以框線標註簡化後的圈選群組。
- 🎨 **互動式 SVG 電路圖**：支援滑鼠滾輪縮放（Zoom）與拖曳平移（Pan），可點擊邏輯閘互動，並支援一鍵下載導出 `.svg` 向量圖檔。
- 🍃 **純前端無伺服器 (Serverless)**：100% 執行於瀏覽器，零成本託管。

## 🛠️ 技術架構
- **結構**：HTML5 + Semantic Tagging
- **樣式**：CSS3 (深色霓虹玻璃擬物化風格 Glassmorphism)
- **邏輯**：ES6 JavaScript Module
- **核心演算法**：手寫 Quine-McCluskey 簡化演算法
- **電路圖**：動態 SVG DOM 操作與正交佈線 (Orthogonal Routing)

## 🚀 本機開啟與部署

### 1. 本機運行
你可以使用任何靜態網頁伺服器（例如 VS Code 的 Live Server 擴充功能，或在終端機執行 `npx serve`、`python -m http.server`）開啟本資料夾，接著在瀏覽器存取即可。

*註：由於使用了 ES6 模組 (Modules)，直接按兩下 `index.html` 本機雙擊開啟可能會因為 CORS 限制而無法運作，請務必透過本機伺服器開啟。*

### 2. 部署到 GitHub Pages
這是一個 100% 純前端網頁，部署非常簡單：
1. 將本專案上傳至你的 GitHub 儲存庫。
2. 進入該儲存庫的 **Settings > Pages**。
3. 將 Build and deployment 的 Source 設定為 **Deploy from a branch**，並選擇你的分支（例如 `main` 或 `master`）下的 `/ (root)` 資料夾。
4. 點選儲存後，幾分鐘內即可獲得一個所有人都能開啟的線上 Demo 網址！

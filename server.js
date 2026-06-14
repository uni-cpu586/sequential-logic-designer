const express = require('express');
const path = require('path');
const fs = require('fs');

// 載入本地 .env 檔案（僅限本地開發使用）
if (fs.existsSync('.env')) {
  fs.readFileSync('.env', 'utf8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const parts = trimmed.split('=');
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim();
    process.env[key] = value.replace(/(^["']|["']$)/g, ''); // 去除包圍的引號
  });
}

const app = express();
const PORT = process.env.PORT || 8000;

// 限制 JSON 請求主體最大為 10mb，以容納上傳的圖片 Base64
app.use(express.json({ limit: '10mb' }));

// 靜態檔案目錄設定為目前目錄
app.use(express.static(path.join(__dirname, '.')));

// 代理 Gemini API 的後端端點
app.post('/api/solve-image', async (req, res) => {
  const { mimeType, base64Data } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: { message: '伺服器配置錯誤：未設定 GEMINI_API_KEY 環境變數。' }
    });
  }

  if (!mimeType || !base64Data) {
    return res.status(400).json({
      error: { message: '缺少必要的圖片型態 (mimeType) 或資料 (base64Data)。' }
    });
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `You are a Digital Logic Design helper.
Analyze this image (which contains a state table, state diagram, or text description of a sequential circuit).
Extract the state transitions and outputs.
Respond ONLY with a valid JSON matching this schema:
{
  "modelType": "Mealy" | "Moore",
  "ffType": "JK" | "T" | "D",
  "states": ["A", "B", "C"],
  "transitions": [
    { "presentState": "A", "x": 0, "nextState": "A", "z": 0 },
    { "presentState": "A", "x": 1, "nextState": "B", "z": 0 }
  ],
  "mooreOutputs": {
    "A": 0,
    "B": 0,
    "C": 1
  }
}
Note: Max 8 states (A, B, C, D, E, F, G, H). If it is Moore, the "z" in transitions can be omitted, but mooreOutputs must be filled. If it is Mealy, mooreOutputs can be empty.`
              },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    res.status(500).json({ error: { message: `呼叫 Gemini API 失敗: ${error.message}` } });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

import { solveSequentialCircuit } from './solver.js';
import { renderCircuit } from './renderer.js';

// 全域狀態
let states = ["A", "B", "C"];
let modelType = "Mealy";
let ffType = "JK";
let activeTab = "J1";

// Moore 狀態輸出預設值
let mooreOutputs = {
  "A": 0,
  "B": 0,
  "C": 1,
  "D": 0
};

// 預設轉移關係表 (Mealy 序列偵測器範例)
let transitions = [
  { presentState: "A", x: 0, nextState: "A", z: 0 },
  { presentState: "A", x: 1, nextState: "B", z: 0 },
  { presentState: "B", x: 0, nextState: "C", z: 0 },
  { presentState: "B", x: 1, nextState: "B", z: 0 },
  { presentState: "C", x: 0, nextState: "A", z: 1 },
  { presentState: "C", x: 1, nextState: "B", z: 0 }
];

// SVG 縮放與平移狀態
let scale = 0.9;
let panX = 40;
let panY = 20;
let isDragging = false;
let startX, startY;

// DOM 元素
const stateTableBody = document.getElementById("state-table-body");
const mooreOutputSection = document.getElementById("moore-output-section");
const mooreStateOutputsDiv = document.getElementById("moore-state-outputs");
const eqTabsDiv = document.getElementById("eq-tabs");
const equationLabel = document.getElementById("equation-label");
const equationExpression = document.getElementById("equation-expression");
const kmapGridContainer = document.getElementById("kmap-grid-container");
const circuitSvg = document.getElementById("circuit-svg");
const btnLoadExample = document.getElementById("btn-load-example");

/**
 * 載入範例資料
 */
function loadExample() {
  if (modelType === "Mealy") {
    states = ["A", "B", "C"];
    transitions = [
      { presentState: "A", x: 0, nextState: "A", z: 0 },
      { presentState: "A", x: 1, nextState: "B", z: 0 },
      { presentState: "B", x: 0, nextState: "C", z: 0 },
      { presentState: "B", x: 1, nextState: "B", z: 0 },
      { presentState: "C", x: 0, nextState: "A", z: 1 },
      { presentState: "C", x: 1, nextState: "B", z: 0 }
    ];
  } else {
    states = ["A", "B", "C"];
    mooreOutputs = { "A": 0, "B": 0, "C": 1 };
    transitions = [
      { presentState: "A", x: 0, nextState: "A" },
      { presentState: "A", x: 1, nextState: "B" },
      { presentState: "B", x: 0, nextState: "C" },
      { presentState: "B", x: 1, nextState: "B" },
      { presentState: "C", x: 0, nextState: "A" },
      { presentState: "C", x: 1, nextState: "C" }
    ];
  }
  
  // 重置 activeTab 避免切換正反器時出錯
  updateTabsList();
  renderStateTable();
  updateSolverAndCircuit();
}

/**
 * 新增狀態 (最多 4 個狀態：A, B, C, D)
 */
function addState() {
  if (states.length >= 4) {
    alert("本專案使用 2 個正反器，最高支援 4 個狀態 (A, B, C, D)！");
    return;
  }
  
  const nextName = String.fromCharCode(65 + states.length); // A, B, C, D
  states.push(nextName);
  
  // 為新狀態新增轉移項目
  transitions.push({ presentState: nextName, x: 0, nextState: "A", z: 0 });
  transitions.push({ presentState: nextName, x: 1, nextState: "A", z: 0 });
  
  if (modelType === "Moore") {
    mooreOutputs[nextName] = 0;
  }

  renderStateTable();
  updateSolverAndCircuit();
}

/**
 * 清空資料表
 */
function clearTable() {
  transitions.forEach(t => {
    t.nextState = states[0];
    t.z = 0;
  });
  
  Object.keys(mooreOutputs).forEach(k => {
    mooreOutputs[k] = 0;
  });

  renderStateTable();
  updateSolverAndCircuit();
}

/**
 * 渲染狀態表 (HTML Table)
 */
function renderStateTable() {
  // 處理 Moore 輸出編輯區
  if (modelType === "Moore") {
    mooreOutputSection.style.display = "block";
    mooreStateOutputsDiv.innerHTML = "";
    states.forEach(state => {
      const div = document.createElement("div");
      div.style.display = "flex";
      div.style.flexDirection = "column";
      div.style.alignItems = "center";
      
      const label = document.createElement("span");
      label.style.fontSize = "0.8rem";
      label.style.fontWeight = "bold";
      label.style.marginBottom = "0.2rem";
      label.textContent = `Y(${state})`;
      
      const select = document.createElement("select");
      select.innerHTML = `<option value="0">0</option><option value="1">1</option>`;
      select.value = mooreOutputs[state] !== undefined ? mooreOutputs[state] : "0";
      select.addEventListener("change", (e) => {
        mooreOutputs[state] = parseInt(e.target.value);
        updateSolverAndCircuit();
      });
      
      div.appendChild(label);
      div.appendChild(select);
      mooreStateOutputsDiv.appendChild(div);
    });
    
    // 隱藏狀態表中的 Z 欄
    document.querySelectorAll(".mealy-only").forEach(el => el.style.display = "none");
  } else {
    mooreOutputSection.style.display = "none";
    document.querySelectorAll(".mealy-only").forEach(el => el.style.display = "");
  }

  // 渲染轉移表格主體
  stateTableBody.innerHTML = "";
  
  // 篩選與排序 transitions 確保只顯示存在的狀態
  const activeTransitions = [];
  states.forEach(state => {
    [0, 1].forEach(x => {
      let t = transitions.find(trans => trans.presentState === state && trans.x === x);
      if (!t) {
        t = { presentState: state, x: x, nextState: states[0], z: 0 };
        transitions.push(t);
      }
      activeTransitions.push(t);
    });
  });

  activeTransitions.forEach(t => {
    const row = document.createElement("tr");

    // Present State
    const tdPresent = document.createElement("td");
    tdPresent.textContent = t.presentState;
    row.appendChild(tdPresent);

    // Input X
    const tdX = document.createElement("td");
    tdX.textContent = t.x;
    row.appendChild(tdX);

    // Next State (Select)
    const tdNext = document.createElement("td");
    const selectNext = document.createElement("select");
    states.forEach(state => {
      const opt = document.createElement("option");
      opt.value = state;
      opt.textContent = state;
      selectNext.appendChild(opt);
    });
    selectNext.value = t.nextState;
    selectNext.addEventListener("change", (e) => {
      t.nextState = e.target.value;
      updateSolverAndCircuit();
    });
    tdNext.appendChild(selectNext);
    row.appendChild(tdNext);

    // Output Z (Select, Mealy 專用)
    if (modelType === "Mealy") {
      const tdZ = document.createElement("td");
      tdZ.className = "mealy-only";
      const selectZ = document.createElement("select");
      selectZ.innerHTML = `<option value="0">0</option><option value="1">1</option>`;
      selectZ.value = t.z !== undefined ? t.z : "0";
      selectZ.addEventListener("change", (e) => {
        t.z = parseInt(e.target.value);
        updateSolverAndCircuit();
      });
      tdZ.appendChild(selectZ);
      row.appendChild(tdZ);
    }

    stateTableBody.appendChild(row);
  });
}

/**
 * 更新 Tab 分頁清單 (J1, K1, J0, K0, Z 等)
 */
function updateTabsList() {
  eqTabsDiv.innerHTML = "";
  const tabs = [];
  const numFFs = Math.ceil(Math.log2(states.length)) || 1;

  if (ffType === "JK") {
    for (let i = numFFs - 1; i >= 0; i--) {
      tabs.push(`J${i}`, `K${i}`);
    }
  } else {
    for (let i = numFFs - 1; i >= 0; i--) {
      tabs.push(`${ffType}${i}`);
    }
  }
  tabs.push("Z");

  // 若當前 activeTab 不在列表內，重設為第一個
  if (!tabs.includes(activeTab)) {
    activeTab = tabs[0];
  }

  tabs.forEach(tab => {
    const btn = document.createElement("button");
    btn.className = `tab-btn ${tab === activeTab ? 'active' : ''}`;
    btn.textContent = tab;
    btn.addEventListener("click", () => {
      activeTab = tab;
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      updateSolverAndCircuit(); // 切換分頁更新卡諾圖與方程式顯示
    });
    eqTabsDiv.appendChild(btn);
  });
}

/**
 * 求解邏輯並重新繪製卡諾圖與電路圖
 */
function updateSolverAndCircuit() {
  const solved = solveSequentialCircuit(modelType, ffType, states, transitions, mooreOutputs);

  // 1. 更新卡諾圖 (K-Map) 顯示
  renderKMap(solved);

  // 2. 更新方程式文字
  const eq = solved.equations[activeTab];
  if (eq) {
    equationLabel.textContent = `${activeTab} =`;
    // 美化點號 (AND) 表示法
    equationExpression.textContent = eq.algebraic.replace(/\*/g, " · ");
  }

  // 3. 渲染電路圖
  renderCircuit(circuitSvg, solved, ffType);
  applyTransform();
}

/**
 * 渲染卡諾圖網格 (3 變數)
 */
function renderKMap(solved) {
  kmapGridContainer.innerHTML = "";
  const mapData = solved.kMaps[activeTab];
  if (!mapData) return;

  const eq = solved.equations[activeTab];
  if (!eq) return;

  const numFFs = solved.numFFs;
  const numVars = numFFs + 1;

  // 3 變數卡諾圖格網對應
  // 縱軸: Q1 Q0 (00, 01, 11, 10)
  // 橫軸: X (0, 1)
  const grayCodeRows = [0, 1, 3, 2]; // 00, 01, 11, 10
  const cols = [0, 1]; // X=0, X=1

  grayCodeRows.forEach(rowVal => {
    cols.forEach(colVal => {
      // 合併得到真值表索引 (Q1 Q0 X)
      // rowVal 二進位代表 Q1 Q0, colVal 代表 X
      const cellIndex = (rowVal << 1) | colVal;
      const cellValue = mapData.table[cellIndex];

      const cell = document.createElement("div");
      cell.className = "kmap-cell";

      // 檢查此單元格是否在化簡後的圈選組中 (增加視覺互動)
      const binaryString = cellIndex.toString(2).padStart(numVars, "0");
      let isInGroup = false;

      // 如果有被簡化方程式的項覆蓋，可給予微亮色彩
      eq.rawImplicants.forEach((imp, impIdx) => {
        const impStr = imp.toString(numVars);
        let match = true;
        for (let charIdx = 0; charIdx < numVars; charIdx++) {
          if (impStr[charIdx] !== "-" && impStr[charIdx] !== binaryString[charIdx]) {
            match = false;
            break;
          }
        }
        if (match) {
          isInGroup = true;
          // 用不同的色系代表不同的圈選組
          cell.style.boxShadow = `inset 0 0 12px rgba(59, 130, 246, 0.4)`;
          cell.style.borderColor = "rgba(59, 130, 246, 0.6)";
        }
      });

      const valSpan = document.createElement("span");
      valSpan.className = "kmap-cell-val";
      valSpan.textContent = cellValue;
      if (cellValue === "1") valSpan.style.color = "var(--accent-blue)";
      else if (cellValue === "X") valSpan.style.color = "var(--accent-yellow)";
      
      const idxSpan = document.createElement("span");
      idxSpan.className = "kmap-cell-idx";
      idxSpan.textContent = cellIndex;

      cell.appendChild(valSpan);
      cell.appendChild(idxSpan);
      kmapGridContainer.appendChild(cell);
    });
  });
}

// --- SVG 縮放、拖曳與下載事件 ---

function applyTransform() {
  const g = document.getElementById("circuit-main-group");
  if (g) {
    g.setAttribute("transform", `translate(${panX}, ${panY}) scale(${scale})`);
  }
}

circuitSvg.addEventListener("mousedown", (e) => {
  isDragging = true;
  startX = e.clientX - panX;
  startY = e.clientY - panY;
});

window.addEventListener("mouseup", () => {
  isDragging = false;
});

circuitSvg.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  panX = e.clientX - startX;
  panY = e.clientY - startY;
  applyTransform();
});

circuitSvg.addEventListener("wheel", (e) => {
  e.preventDefault();
  const zoomFactor = 1.1;
  if (e.deltaY < 0) {
    scale = Math.min(scale * zoomFactor, 3);
  } else {
    scale = Math.max(scale / zoomFactor, 0.3);
  }
  applyTransform();
});

// 工具列按鈕
document.getElementById("btn-zoom-in").addEventListener("click", () => {
  scale = Math.min(scale * 1.2, 3);
  applyTransform();
});

document.getElementById("btn-zoom-out").addEventListener("click", () => {
  scale = Math.max(scale / 1.2, 0.3);
  applyTransform();
});

document.getElementById("btn-zoom-reset").addEventListener("click", () => {
  scale = 0.9;
  panX = 40;
  panY = 20;
  applyTransform();
});

document.getElementById("btn-download-svg").addEventListener("click", () => {
  const svgData = circuitSvg.outerHTML;
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);
  const downloadLink = document.createElement("a");
  downloadLink.href = svgUrl;
  downloadLink.download = "sequential-circuit.svg";
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
});

// --- 主要 UI 設定變更事件 ---

// 切換 Mealy / Moore
document.querySelectorAll('input[name="model-type"]').forEach(radio => {
  radio.addEventListener("change", (e) => {
    modelType = e.target.value;
    btnLoadExample.textContent = `載入 ${modelType} 範例`;
    loadExample();
  });
});

// 切換 JK / T / D
document.querySelectorAll('input[name="ff-type"]').forEach(radio => {
  radio.addEventListener("change", (e) => {
    ffType = e.target.value;
    // 重置所有這個類型的 FF 選項按鈕狀態 (讓頂部和底部 D FF 按鈕同步)
    document.querySelectorAll(`input[name="ff-type"][value="${ffType}"]`).forEach(r => r.checked = true);
    
    updateTabsList();
    updateSolverAndCircuit();
  });
});

// 按鈕事件綁定
document.getElementById("btn-add-state").addEventListener("click", addState);
document.getElementById("btn-clear").addEventListener("click", clearTable);
btnLoadExample.addEventListener("click", loadExample);

// 初始化載入
loadExample();
updateTabsList();
renderStateTable();
updateSolverAndCircuit();

// --- 懸浮窗 (Tooltip) 處理邏輯 ---

const tooltip = document.getElementById("circuit-tooltip");

function showTooltip(e, contentHtml) {
  const container = document.querySelector(".circuit-canvas-container");
  const rect = container.getBoundingClientRect();
  
  // 計算相對於容器的座標
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  tooltip.innerHTML = contentHtml;
  tooltip.style.left = `${x + 15}px`;
  tooltip.style.top = `${y + 15}px`;
  tooltip.style.display = "block";
}

function showGateTooltip(e, type, eqName) {
  let title = "";
  let desc = "";
  let tableHtml = "";

  if (type === "AND") {
    title = "AND Gate (及閘)";
    desc = `此及閘對應激勵方程式中的乘積項。當所有輸入均為 1 時輸出為 1。`;
    tableHtml = `
      <table class="tooltip-table">
        <tr><th>In 1</th><th>In 2</th><th>Out</th></tr>
        <tr><td>0</td><td>0</td><td>0</td></tr>
        <tr><td>0</td><td>1</td><td>0</td></tr>
        <tr><td>1</td><td>0</td><td>0</td></tr>
        <tr><td>1</td><td>1</td><td>1</td></tr>
      </table>
    `;
  } else if (type === "OR") {
    title = "OR Gate (或閘)";
    desc = `此或閘對應激勵方程式中的總和。當任意輸入為 1 時輸出為 1。`;
    tableHtml = `
      <table class="tooltip-table">
        <tr><th>In 1</th><th>In 2</th><th>Out</th></tr>
        <tr><td>0</td><td>0</td><td>0</td></tr>
        <tr><td>0</td><td>1</td><td>1</td></tr>
        <tr><td>1</td><td>0</td><td>1</td></tr>
        <tr><td>1</td><td>1</td><td>1</td></tr>
      </table>
    `;
  } else if (type === "NOT") {
    title = "NOT Gate (反相器)";
    desc = `將輸入訊號進行反相處理。例如將 X 轉為 X'。`;
    tableHtml = `
      <table class="tooltip-table">
        <tr><th>In</th><th>Out</th></tr>
        <tr><td>0</td><td>1</td></tr>
        <tr><td>1</td><td>0</td></tr>
      </table>
    `;
  }

  const eqText = eqName ? `<div class="tooltip-eq">${eqName} 的邏輯閘</div>` : "";

  const content = `
    <div class="tooltip-title">
      <span>${title}</span>
    </div>
    <div class="tooltip-desc">${desc}</div>
    ${eqText}
    ${tableHtml}
  `;
  showTooltip(e, content);
}

function showFFTooltip(e, ffText) {
  let title = `${ffType} Flip-Flop`;
  let desc = "";
  let tableHtml = "";

  if (ffType === "JK") {
    desc = `特性方程式：Q(t+1) = J·Q' + K'·Q<br>激勵表如下：`;
    tableHtml = `
      <table class="tooltip-table">
        <tr><th>Q → Q(t+1)</th><th>J</th><th>K</th></tr>
        <tr><td>0 → 0</td><td>0</td><td>X</td></tr>
        <tr><td>0 → 1</td><td>1</td><td>X</td></tr>
        <tr><td>1 → 0</td><td>X</td><td>1</td></tr>
        <tr><td>1 → 1</td><td>X</td><td>0</td></tr>
      </table>
    `;
  } else if (ffType === "T") {
    desc = `特性方程式：Q(t+1) = T ⊕ Q<br>當 T=1 時狀態翻轉，T=0 時狀態保持。`;
    tableHtml = `
      <table class="tooltip-table">
        <tr><th>Q → Q(t+1)</th><th>T</th></tr>
        <tr><td>0 → 0</td><td>0</td></tr>
        <tr><td>0 → 1</td><td>1</td></tr>
        <tr><td>1 → 0</td><td>1</td></tr>
        <tr><td>1 → 1</td><td>0</td></tr>
      </table>
    `;
  } else if (ffType === "D") {
    desc = `特性方程式：Q(t+1) = D<br>次一狀態完全等於當前 D 輸入的值。`;
    tableHtml = `
      <table class="tooltip-table">
        <tr><th>Q → Q(t+1)</th><th>D</th></tr>
        <tr><td>0 → 0</td><td>0</td></tr>
        <tr><td>0 → 1</td><td>1</td></tr>
        <tr><td>1 → 0</td><td>0</td></tr>
        <tr><td>1 → 1</td><td>1</td></tr>
      </table>
    `;
  }

  const content = `
    <div class="tooltip-title">
      <span>${title} (${ffText})</span>
    </div>
    <div class="tooltip-desc">${desc}</div>
    ${tableHtml}
  `;
  showTooltip(e, content);
}

// 監聽 SVG 中的點擊事件，進行事件代理
circuitSvg.addEventListener("click", (e) => {
  // 檢查是否點擊邏輯閘 (class 為 logic-gate)
  const gateTarget = e.target.closest(".logic-gate");
  if (gateTarget) {
    e.stopPropagation();
    const type = gateTarget.getAttribute("data-type") || "AND";
    const eqName = gateTarget.getAttribute("data-equation");
    showGateTooltip(e, type, eqName);
    return;
  }

  // 檢查是否點擊正反器框
  const ffTarget = e.target.closest(".flip-flops rect");
  if (ffTarget) {
    e.stopPropagation();
    // 取得對應正反器的 Q0/Q1 標籤
    const ffGroup = ffTarget.parentNode;
    const textNode = ffGroup.querySelector("text");
    const labelText = textNode ? textNode.textContent : "FF";
    showFFTooltip(e, labelText);
    return;
  }

  // 點擊其他地方隱藏懸浮窗
  tooltip.style.display = "none";
});

// 點擊網頁其他地方也隱藏懸浮窗
document.addEventListener("click", (e) => {
  if (!e.target.closest("#circuit-svg")) {
    tooltip.style.display = "none";
  }
});

// --- AI 圖片解題相關邏輯 (AI Image Solver Logic) ---

const aiSolverToggle = document.getElementById("ai-solver-toggle");
const aiSolverWrapper = document.getElementById("ai-solver-wrapper");
const geminiKeyInput = document.getElementById("gemini-key");
const uploadZone = document.getElementById("upload-zone");
const fileInput = document.getElementById("file-input");
const aiStatus = document.getElementById("ai-status");
const aiStatusText = document.getElementById("ai-status-text");

// 摺疊/展開選單
aiSolverToggle.addEventListener("click", () => {
  aiSolverWrapper.classList.toggle("collapsed");
});

// 載入與儲存 API Key
const savedKey = localStorage.getItem("gemini_api_key");
if (savedKey) {
  geminiKeyInput.value = savedKey;
}
geminiKeyInput.addEventListener("input", () => {
  localStorage.setItem("gemini_api_key", geminiKeyInput.value.trim());
});

// 拖曳與上傳事件
uploadZone.addEventListener("click", () => {
  fileInput.click();
});

uploadZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadZone.classList.add("dragover");
});

uploadZone.addEventListener("dragleave", () => {
  uploadZone.classList.remove("dragover");
});

uploadZone.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadZone.classList.remove("dragover");
  if (e.dataTransfer.files.length > 0) {
    handleImageUpload(e.dataTransfer.files[0]);
  }
});

fileInput.addEventListener("change", (e) => {
  if (e.target.files.length > 0) {
    handleImageUpload(e.target.files[0]);
  }
});

// 防止瀏覽器預設開啟拖放檔案的行為
window.addEventListener("dragover", (e) => {
  e.preventDefault();
}, false);

window.addEventListener("drop", (e) => {
  e.preventDefault();
}, false);

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64Data = result.split(",")[1];
      resolve(base64Data);
    };
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

async function handleImageUpload(file) {
  const apiKey = geminiKeyInput.value.trim();
  if (!apiKey) {
    alert("請先輸入您的 Gemini API Key！");
    return;
  }

  if (!file.type.startsWith("image/")) {
    alert("請上傳圖片檔案！");
    return;
  }

  aiStatusText.textContent = "正在讀取圖片...";
  aiStatus.style.display = "flex";

  try {
    const base64Data = await fileToBase64(file);
    aiStatusText.textContent = "AI 分析解題中...";

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
Note: Max 4 states (A, B, C, D). If it is Moore, the "z" in transitions can be omitted, but mooreOutputs must be filled. If it is Mealy, mooreOutputs can be empty.`
              },
              {
                inlineData: {
                  mimeType: file.type,
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

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `HTTP error ${response.status}`);
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Gemini 回傳內容為空，請確認圖片內容是否清晰。");
    }

    const parsed = JSON.parse(text);
    
    // 驗證與更新狀態
    if (!parsed.modelType || !parsed.ffType || !parsed.states || !parsed.transitions) {
      throw new Error("AI 回傳的 JSON 格式不正確，缺少必要欄位。");
    }

    // 更新全域變數
    modelType = parsed.modelType;
    ffType = parsed.ffType;
    states = parsed.states;
    transitions = parsed.transitions;
    if (modelType === "Moore" && parsed.mooreOutputs) {
      mooreOutputs = parsed.mooreOutputs;
    }

    // 更新 UI 元件狀態
    document.querySelectorAll('input[name="model-type"]').forEach(radio => {
      radio.checked = (radio.value === modelType);
    });
    btnLoadExample.textContent = `載入 ${modelType} 範例`;

    document.querySelectorAll('input[name="ff-type"]').forEach(radio => {
      radio.checked = (radio.value === ffType);
    });

    // 重新執行渲染流程
    updateTabsList();
    renderStateTable();
    updateSolverAndCircuit();

    aiStatusText.textContent = "解題成功！";
    setTimeout(() => {
      aiStatus.style.display = "none";
    }, 2000);

  } catch (error) {
    console.error(error);
    aiStatusText.textContent = `失敗: ${error.message}`;
    alert(`AI 解析失敗，請確認 API 金鑰與圖片格式是否正確。\n錯誤訊息: ${error.message}`);
    setTimeout(() => {
      aiStatus.style.display = "none";
    }, 5000);
  }
}

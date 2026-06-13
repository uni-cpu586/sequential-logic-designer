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

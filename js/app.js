import { solveSequentialCircuit } from './solver.js';
import { renderCircuit } from './renderer.js';
import { renderStateDiagram } from './stateDiagram.js';

// 全域狀態
let states = ["A", "B", "C"];
let modelType = "Mealy";
let ffType = "JK";
let activeTab = "J1";
let currentView = "kmap-all"; // "kmap-all" | "state-diag" | "truth-table" | "circuit"

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
  if (states.length >= 8) {
    alert("本專案使用 3 個正反器，最高支援 8 個狀態 (A 至 H)！");
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
/**
 * 求解邏輯並重新繪製卡諾圖與電路圖
 */
function updateSolverAndCircuit() {
  const solved = solveSequentialCircuit(modelType, ffType, states, transitions, mooreOutputs);

  // 1. 動態更新分頁標籤 (確保分頁按鈕數量隨正反器增減自動更新)
  updateTabsList();

  // 2. 更新卡諾圖 (K-Map) 顯示
  renderKMap(solved);

  // 3. 更新方程式文字
  const eq = solved.equations[activeTab];
  if (eq) {
    equationLabel.textContent = `${activeTab} =`;
    // 美化點號 (AND) 表示法
    equationExpression.textContent = eq.algebraic.replace(/\*/g, " · ");
  }

  // 4. 根據選中視圖進行渲染
  const mainTitle = document.getElementById("main-panel-title");
  const circuitSvg = document.getElementById("circuit-svg");
  const kmapsDashboard = document.getElementById("kmaps-dashboard");
  const truthTableDashboard = document.getElementById("truth-table-dashboard");
  const toolbar = document.getElementById("circuit-toolbar-btns");
  const legendLabel = document.getElementById("legend-text-label");
  const legendTip = document.getElementById("circuit-legend-tip");
  const legendHint = document.querySelector(".legend-hint");

  if (currentView === "circuit") {
    mainTitle.textContent = "4. 動態邏輯電路圖";
    circuitSvg.style.display = "block";
    kmapsDashboard.style.display = "none";
    if (truthTableDashboard) truthTableDashboard.style.display = "none";
    if (toolbar) toolbar.style.display = "flex";
    if (legendTip) legendTip.style.display = "flex";
    if (legendLabel) legendLabel.textContent = "🟢 綠色: 時脈與反饋線 | 🔵 藍色: 激勵輸入邏輯 | 🔴 紅色: 輸出 Z";
    if (legendHint) legendHint.style.display = "block";
    
    renderCircuit(circuitSvg, solved, ffType);
    applyTransform();
  } else if (currentView === "state-diag") {
    mainTitle.textContent = "4. State Diagram";
    circuitSvg.style.display = "block";
    kmapsDashboard.style.display = "none";
    if (truthTableDashboard) truthTableDashboard.style.display = "none";
    if (toolbar) toolbar.style.display = "flex";
    if (legendTip) legendTip.style.display = "flex";
    if (legendLabel) legendLabel.textContent = "🔵 藍色: X = 0 轉移 | 🟡 橘黃色: X = 1 轉移 | 🟢 綠色節點: 狀態";
    if (legendHint) legendHint.style.display = "block";
    
    renderStateDiagram(circuitSvg, solved, modelType, transitions, states, mooreOutputs);
    applyTransform(); // 狀態圖也支援縮放平移！
  } else if (currentView === "kmap-all") {
    mainTitle.textContent = "4. K-Maps";
    circuitSvg.style.display = "none";
    kmapsDashboard.style.display = "block";
    if (truthTableDashboard) truthTableDashboard.style.display = "none";
    if (toolbar) toolbar.style.display = "none";
    if (legendTip) legendTip.style.display = "flex";
    if (legendLabel) legendLabel.textContent = "🔵 藍色格網: 圈選主要隱含項 (Prime Implicants)";
    if (legendHint) legendHint.style.display = "none";
    
    renderAllKMapsDashboard(solved);
  } else if (currentView === "truth-table") {
    mainTitle.textContent = "4. Truth Table";
    circuitSvg.style.display = "none";
    kmapsDashboard.style.display = "none";
    if (truthTableDashboard) truthTableDashboard.style.display = "block";
    if (toolbar) toolbar.style.display = "none";
    if (legendTip) legendTip.style.display = "flex";
    if (legendLabel) legendLabel.textContent = "🟢 綠色: 目前狀態 | 🟡 黃色: 次一狀態 | 🔵 藍色: 激勵變數 | 🔴 紅色: 輸出 Z";
    if (legendHint) legendHint.style.display = "none";
    
    renderTruthTable(solved);
  }
}

/**
 * 渲染全域所有卡諾圖儀表板
 */
function renderAllKMapsDashboard(solved) {
  const container = document.getElementById("kmaps-dashboard");
  if (!container) return;
  container.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "kmaps-grid-dashboard";
  container.appendChild(grid);

  const numFFs = solved.numFFs;
  const numVars = numFFs + 1;

  Object.keys(solved.kMaps).forEach(tab => {
    const mapData = solved.kMaps[tab];
    const eq = solved.equations[tab];
    if (!mapData || !eq) return;

    const card = document.createElement("div");
    card.className = "kmap-dashboard-card";

    // 標題與簡化公式
    const title = document.createElement("div");
    title.className = "kmap-dashboard-title";
    title.textContent = `${tab} = ${eq.algebraic.replace(/\*/g, " · ")}`;
    card.appendChild(title);

    // 標籤提示
    const labels = document.createElement("div");
    labels.style.display = "flex";
    labels.style.justify = "space-between";
    labels.style.fontSize = "0.7rem";
    labels.style.color = "var(--text-secondary)";
    labels.style.marginBottom = "0.35rem";
    if (numVars === 4) {
      labels.textContent = "直: Q0X(00-10) | 橫: Q2Q1(00-10)";
    } else if (numVars === 3) {
      labels.textContent = "直: Q1Q0(00-10) | 橫: X(0-1)";
    } else {
      labels.textContent = "直: Q0(0-1) | 橫: X(0-1)";
    }
    card.appendChild(labels);

    // 卡諾圖格網容器
    const gridContainer = document.createElement("div");
    gridContainer.className = "kmap-grid";
    gridContainer.style.margin = "0";
    gridContainer.style.padding = "4px";
    gridContainer.style.background = "rgba(0,0,0,0.15)";
    card.appendChild(gridContainer);

    if (numVars === 4) {
      const grayCodeRows = [0, 1, 3, 2];
      const grayCodeCols = [0, 1, 3, 2];
      grayCodeRows.forEach(rowVal => {
        grayCodeCols.forEach(colVal => {
          const cellIndex = (colVal << 2) | rowVal;
          const cellValue = mapData.table[cellIndex];
          const cell = createCellDOM(cellIndex, cellValue, eq, numVars);
          gridContainer.appendChild(cell);
        });
      });
    } else {
      const grayCodeRows = [0, 1, 3, 2];
      const cols = [0, 1];
      grayCodeRows.forEach(rowVal => {
        cols.forEach(colVal => {
          const cellIndex = (rowVal << 1) | colVal;
          const cellValue = mapData.table[cellIndex];
          const cell = createCellDOM(cellIndex, cellValue, eq, numVars);
          gridContainer.appendChild(cell);
        });
      });
    }

    grid.appendChild(card);
  });
}

/**
 * 渲染狀態轉移與激勵真值表 (State Transition & Excitation Truth Table)
 */
function renderTruthTable(solved) {
  const container = document.getElementById("truth-table-dashboard");
  if (!container) return;
  container.innerHTML = "";

  const numFFs = solved.numFFs;
  const numVars = numFFs + 1; // FFs + input X

  const card = document.createElement("div");
  card.className = "truth-table-card";
  container.appendChild(card);

  const title = document.createElement("div");
  title.className = "truth-table-title";
  title.textContent = "狀態轉移與激勵真值表 (State Transition & Excitation Truth Table)";
  card.appendChild(title);

  const tableContainer = document.createElement("div");
  tableContainer.className = "truth-table-wrapper";
  card.appendChild(tableContainer);

  const table = document.createElement("table");
  table.className = "cyber-truth-table";
  tableContainer.appendChild(table);

  const thead = document.createElement("thead");
  table.appendChild(thead);

  const tr1 = document.createElement("tr");
  thead.appendChild(tr1);

  // 第一行表頭：分類大標題
  const thPresent = document.createElement("th");
  thPresent.setAttribute("colspan", numFFs + 1);
  thPresent.textContent = "Present State";
  tr1.appendChild(thPresent);

  const thInput = document.createElement("th");
  thInput.textContent = "Input";
  tr1.appendChild(thInput);

  const thNext = document.createElement("th");
  thNext.setAttribute("colspan", numFFs + 1);
  thNext.textContent = "Next State";
  tr1.appendChild(thNext);

  const excitationVars = [];
  if (ffType === "JK") {
    for (let i = numFFs - 1; i >= 0; i--) {
      excitationVars.push(`J${i}`, `K${i}`);
    }
  } else {
    for (let i = numFFs - 1; i >= 0; i--) {
      excitationVars.push(`${ffType}${i}`);
    }
  }

  const thExcitation = document.createElement("th");
  thExcitation.setAttribute("colspan", excitationVars.length);
  thExcitation.textContent = `Excitation Inputs (${ffType} 正反器輸入)`;
  tr1.appendChild(thExcitation);

  const thOutput = document.createElement("th");
  thOutput.textContent = "Output";
  tr1.appendChild(thOutput);

  // 第二行表頭：具體變數名稱
  const tr2 = document.createElement("tr");
  thead.appendChild(tr2);

  // 目前狀態變數
  for (let i = numFFs - 1; i >= 0; i--) {
    const th = document.createElement("th");
    th.textContent = `Q${i}`;
    tr2.appendChild(th);
  }
  const thStateName = document.createElement("th");
  thStateName.textContent = "State";
  thStateName.style.color = "var(--accent-green)";
  tr2.appendChild(thStateName);

  // 輸入 X
  const thX = document.createElement("th");
  thX.textContent = "X";
  tr2.appendChild(thX);

  // 次一狀態變數
  for (let i = numFFs - 1; i >= 0; i--) {
    const th = document.createElement("th");
    th.textContent = `Q${i}+`;
    tr2.appendChild(th);
  }
  const thNextStateName = document.createElement("th");
  thNextStateName.textContent = "Next";
  thNextStateName.style.color = "var(--accent-yellow)";
  tr2.appendChild(thNextStateName);

  // 激勵變數
  excitationVars.forEach(v => {
    const th = document.createElement("th");
    th.textContent = v;
    th.style.color = "var(--accent-blue)";
    tr2.appendChild(th);
  });

  // 輸出 Z
  const thZ = document.createElement("th");
  thZ.textContent = "Z";
  thZ.style.color = "var(--accent-red)";
  tr2.appendChild(thZ);

  // 表身
  const tbody = document.createElement("tbody");
  table.appendChild(tbody);

  const totalRows = 1 << numVars;
  for (let val = 0; val < totalRows; val++) {
    const x = val & 1;
    const currentStateVal = val >> 1;

    // 尋找目前狀態名稱，若不存在（未使用狀態）則跳過不顯示
    const currentStateName = states.find((s, idx) => idx === currentStateVal);
    if (!currentStateName) {
      continue;
    }

    const tr = document.createElement("tr");
    tbody.appendChild(tr);

    // 目前狀態二進位
    for (let i = numFFs - 1; i >= 0; i--) {
      const td = document.createElement("td");
      td.textContent = (currentStateVal >> i) & 1;
      tr.appendChild(td);
    }

    // 目前狀態名稱
    const tdStateName = document.createElement("td");
    tdStateName.textContent = currentStateName;
    tdStateName.style.color = "var(--accent-green)";
    tdStateName.style.fontWeight = "bold";
    tr.appendChild(tdStateName);

    // 輸入 X
    const tdX = document.createElement("td");
    tdX.textContent = x;
    tr.appendChild(tdX);

    // 尋找轉移
    const trans = transitions.find(t => t.presentState === currentStateName && t.x === x);
    if (trans) {
      const nextStateName = trans.nextState;
      const nextStateVal = solved.stateEncoding[nextStateName];

      for (let i = numFFs - 1; i >= 0; i--) {
        const td = document.createElement("td");
        td.textContent = nextStateVal !== undefined ? ((nextStateVal >> i) & 1) : "X";
        tr.appendChild(td);
      }

      const tdNextStateName = document.createElement("td");
      tdNextStateName.textContent = nextStateName;
      tdNextStateName.style.color = "var(--accent-yellow)";
      tdNextStateName.style.fontWeight = "bold";
      tr.appendChild(tdNextStateName);
    } else {
      for (let i = numFFs - 1; i >= 0; i--) {
        const td = document.createElement("td");
        td.textContent = "X";
        tr.appendChild(td);
      }
      const tdNextStateName = document.createElement("td");
      tdNextStateName.textContent = "-";
      tr.appendChild(tdNextStateName);
    }

    // 激勵變數
    excitationVars.forEach(v => {
      const td = document.createElement("td");
      const mapData = solved.kMaps[v];
      const cellValue = mapData ? mapData.table[val] : "X";
      td.textContent = cellValue;
      if (cellValue === "X" || cellValue === "x") {
        td.style.color = "#64748b";
      } else {
        td.style.color = "var(--accent-blue)";
        td.style.fontWeight = "bold";
      }
      tr.appendChild(td);
    });

    // 輸出 Z
    const tdZ = document.createElement("td");
    const zValue = solved.kMaps["Z"] ? solved.kMaps["Z"].table[val] : "X";
    tdZ.textContent = zValue;
    if (zValue === "X" || zValue === "x") {
      tdZ.style.color = "#64748b";
    } else {
      tdZ.style.color = "var(--accent-red)";
      tdZ.style.fontWeight = "bold";
    }
    tr.appendChild(tdZ);
  }
}

function createCellDOM(cellIndex, cellValue, eq, numVars) {
  const cell = document.createElement("div");
  cell.className = "kmap-cell";
  cell.style.aspectRatio = "1";
  cell.style.padding = "2px";

  const binaryString = cellIndex.toString(2).padStart(numVars, "0");

  eq.rawImplicants.forEach((imp) => {
    const impStr = imp.toString(numVars);
    let match = true;
    for (let charIdx = 0; charIdx < numVars; charIdx++) {
      if (impStr[charIdx] !== "-" && impStr[charIdx] !== binaryString[charIdx]) {
        match = false;
        break;
      }
    }
    if (match) {
      cell.style.boxShadow = `inset 0 0 10px rgba(59, 130, 246, 0.4)`;
      cell.style.borderColor = "rgba(59, 130, 246, 0.6)";
    }
  });

  const valSpan = document.createElement("span");
  valSpan.className = "kmap-cell-val";
  valSpan.style.fontSize = "0.9rem";
  valSpan.textContent = cellValue !== undefined ? cellValue : "X";
  if (valSpan.textContent === "1") valSpan.style.color = "var(--accent-blue)";
  else if (valSpan.textContent === "X") valSpan.style.color = "var(--accent-yellow)";
  
  const idxSpan = document.createElement("span");
  idxSpan.className = "kmap-cell-idx";
  idxSpan.style.fontSize = "0.55rem";
  idxSpan.textContent = cellIndex;

  cell.appendChild(valSpan);
  cell.appendChild(idxSpan);
  return cell;
}

/**
 * 渲染卡諾圖網格 (動態支援 3 與 4 變數)
 */
function renderKMap(solved) {
  kmapGridContainer.innerHTML = "";
  const mapData = solved.kMaps[activeTab];
  if (!mapData) return;

  const eq = solved.equations[activeTab];
  if (!eq) return;

  const numFFs = solved.numFFs;
  const numVars = numFFs + 1;

  // 動態更新卡諾圖軸標籤
  const kmapRowLabel = document.getElementById("kmap-row-label");
  const kmapColLabel = document.getElementById("kmap-col-label");
  if (kmapRowLabel && kmapColLabel) {
    if (numVars === 4) {
      kmapRowLabel.textContent = "直軸: Q0 X (00, 01, 11, 10)";
      kmapColLabel.textContent = "橫軸: Q2 Q1 (00, 01, 11, 10)";
    } else if (numVars === 3) {
      kmapRowLabel.textContent = "直軸: Q1 Q0 (00, 01, 11, 10)";
      kmapColLabel.textContent = "橫軸: X (0, 1)";
    } else {
      kmapRowLabel.textContent = "直軸: Q0 (0, 1)";
      kmapColLabel.textContent = "橫軸: X (0, 1)";
    }
  }

  // 根據變數數量渲染不同大小與排序的卡諾圖
  if (numVars === 4) {
    // 4 變數卡諾圖 - 4x4 格網 (直軸 Q0 X, 橫軸 Q2 Q1 對調)
    const grayCodeRows = [0, 1, 3, 2]; // Q0 X
    const grayCodeCols = [0, 1, 3, 2]; // Q2 Q1

    grayCodeRows.forEach(rowVal => {
      grayCodeCols.forEach(colVal => {
        const cellIndex = (colVal << 2) | rowVal;
        const cellValue = mapData.table[cellIndex];

        const cell = document.createElement("div");
        cell.className = "kmap-cell";

        const binaryString = cellIndex.toString(2).padStart(numVars, "0");

        eq.rawImplicants.forEach((imp) => {
          const impStr = imp.toString(numVars);
          let match = true;
          for (let charIdx = 0; charIdx < numVars; charIdx++) {
            if (impStr[charIdx] !== "-" && impStr[charIdx] !== binaryString[charIdx]) {
              match = false;
              break;
            }
          }
          if (match) {
            cell.style.boxShadow = `inset 0 0 12px rgba(59, 130, 246, 0.4)`;
            cell.style.borderColor = "rgba(59, 130, 246, 0.6)";
          }
        });

        const valSpan = document.createElement("span");
        valSpan.className = "kmap-cell-val";
        valSpan.textContent = cellValue !== undefined ? cellValue : "X";
        if (valSpan.textContent === "1") valSpan.style.color = "var(--accent-blue)";
        else if (valSpan.textContent === "X") valSpan.style.color = "var(--accent-yellow)";
        
        const idxSpan = document.createElement("span");
        idxSpan.className = "kmap-cell-idx";
        idxSpan.textContent = cellIndex;

        cell.appendChild(valSpan);
        cell.appendChild(idxSpan);
        kmapGridContainer.appendChild(cell);
      });
    });
  } else {
    // 3 變數卡諾圖 (Q1 Q0 X) - 2x4 格網
    const grayCodeRows = [0, 1, 3, 2];
    const cols = [0, 1];

    grayCodeRows.forEach(rowVal => {
      cols.forEach(colVal => {
        const cellIndex = (rowVal << 1) | colVal;
        const cellValue = mapData.table[cellIndex];

        const cell = document.createElement("div");
        cell.className = "kmap-cell";

        const binaryString = cellIndex.toString(2).padStart(numVars, "0");

        eq.rawImplicants.forEach((imp) => {
          const impStr = imp.toString(numVars);
          let match = true;
          for (let charIdx = 0; charIdx < numVars; charIdx++) {
            if (impStr[charIdx] !== "-" && impStr[charIdx] !== binaryString[charIdx]) {
              match = false;
              break;
            }
          }
          if (match) {
            cell.style.boxShadow = `inset 0 0 12px rgba(59, 130, 246, 0.4)`;
            cell.style.borderColor = "rgba(59, 130, 246, 0.6)";
          }
        });

        const valSpan = document.createElement("span");
        valSpan.className = "kmap-cell-val";
        valSpan.textContent = cellValue !== undefined ? cellValue : "X";
        if (valSpan.textContent === "1") valSpan.style.color = "var(--accent-blue)";
        else if (valSpan.textContent === "X") valSpan.style.color = "var(--accent-yellow)";
        
        const idxSpan = document.createElement("span");
        idxSpan.className = "kmap-cell-idx";
        idxSpan.textContent = cellIndex;

        cell.appendChild(valSpan);
        cell.appendChild(idxSpan);
        kmapGridContainer.appendChild(cell);
      });
    });
  }
}

// --- SVG 縮放、拖曳與下載事件 ---

function updateZoomControls() {
  const slider = document.getElementById("zoom-slider");
  const valueDisplay = document.getElementById("zoom-value");
  if (slider) {
    slider.value = Math.round(scale * 100);
  }
  if (valueDisplay) {
    valueDisplay.textContent = `${Math.round(scale * 100)}%`;
  }
}

function applyTransform() {
  const g = document.getElementById("circuit-main-group");
  if (g) {
    g.setAttribute("transform", `translate(${panX}, ${panY}) scale(${scale})`);
  }
  updateZoomControls();
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
  const zoomFactor = 1.05; // 降低縮放靈敏度，避免忽大忽小
  if (e.deltaY < 0) {
    scale = Math.min(scale * zoomFactor, 3);
  } else {
    scale = Math.max(scale / zoomFactor, 0.3);
  }
  applyTransform();
});

// 工具列與縮放滑動條事件監聽
const zoomSlider = document.getElementById("zoom-slider");
if (zoomSlider) {
  zoomSlider.addEventListener("input", (e) => {
    scale = parseInt(e.target.value) / 100;
    applyTransform();
  });
}

document.getElementById("btn-zoom-in").addEventListener("click", () => {
  scale = Math.min(scale * 1.1, 3); // 減緩步進
  applyTransform();
});

document.getElementById("btn-zoom-out").addEventListener("click", () => {
  scale = Math.max(scale / 1.1, 0.3);
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

// 全域視圖切換事件
document.querySelectorAll(".view-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".view-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentView = btn.getAttribute("data-view");
    updateSolverAndCircuit();
  });
});

// 初始化載入
loadExample();
updateTabsList();
renderStateTable();
updateSolverAndCircuit();

// --- 懸浮窗 (Tooltip) 處理邏輯與拖曳功能 ---

const tooltip = document.getElementById("circuit-tooltip");

function showTooltip(e, contentHtml) {
  const container = document.querySelector(".circuit-canvas-container");
  const rect = container.getBoundingClientRect();
  
  tooltip.innerHTML = contentHtml;
  tooltip.style.display = "block";
  
  // 取得真實尺寸 (必須在 display: block 之後才有寬高)
  const tooltipRect = tooltip.getBoundingClientRect();
  
  // 預設坐標為滑鼠右下方
  let x = e.clientX - rect.left + 15;
  let y = e.clientY - rect.top + 15;
  
  // 邊界防禦：如果右邊超出，移至左邊
  if (x + tooltipRect.width > rect.width) {
    x = e.clientX - rect.left - tooltipRect.width - 15;
  }
  // 邊界防禦：如果底部超出，移至上方
  if (y + tooltipRect.height > rect.height) {
    y = e.clientY - rect.top - tooltipRect.height - 15;
  }
  
  // 極限保護
  x = Math.max(5, Math.min(x, rect.width - tooltipRect.width - 5));
  y = Math.max(5, Math.min(y, rect.height - tooltipRect.height - 5));
  
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
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
      <span style="font-size: 0.62rem; color: #94a3b8; font-weight: normal; margin-left: 0.5rem; opacity: 0.8; user-select: none;">(拖曳標題移動)</span>
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
      <span style="font-size: 0.62rem; color: #94a3b8; font-weight: normal; margin-left: 0.5rem; opacity: 0.8; user-select: none;">(拖曳標題移動)</span>
    </div>
    <div class="tooltip-desc">${desc}</div>
    ${tableHtml}
  `;
  showTooltip(e, content);
}

// 懸浮窗拖曳事件監聽
let isDraggingTooltip = false;
let tooltipStartX = 0;
let tooltipStartY = 0;

tooltip.addEventListener("mousedown", (e) => {
  const titleBar = e.target.closest(".tooltip-title");
  if (!titleBar) return;
  
  isDraggingTooltip = true;
  tooltipStartX = e.clientX - parseFloat(tooltip.style.left || 0);
  tooltipStartY = e.clientY - parseFloat(tooltip.style.top || 0);
  e.preventDefault();
  e.stopPropagation();
});

document.addEventListener("mousemove", (e) => {
  if (!isDraggingTooltip) return;
  
  const container = document.querySelector(".circuit-canvas-container");
  const rect = container.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  
  let newLeft = e.clientX - tooltipStartX;
  let newTop = e.clientY - tooltipStartY;
  
  // 限制拖曳範圍不超出畫布
  newLeft = Math.max(5, Math.min(newLeft, rect.width - tooltipRect.width - 5));
  newTop = Math.max(5, Math.min(newTop, rect.height - tooltipRect.height - 5));
  
  tooltip.style.left = `${newLeft}px`;
  tooltip.style.top = `${newTop}px`;
});

document.addEventListener("mouseup", () => {
  isDraggingTooltip = false;
});

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
  if (!e.target.closest("#circuit-svg") && !e.target.closest("#circuit-tooltip")) {
    tooltip.style.display = "none";
  }
});

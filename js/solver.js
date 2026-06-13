/**
 * 序向電路布林求解器 (Quine-McCluskey 演算法實作)
 */

// 表示一個布林項 (Implicant)
class Implicant {
  constructor(mask, value, minterms = []) {
    this.mask = mask; // 位元遮罩 (例如 111 代表全部都有值, 110 代表最後一位是 -)
    this.value = value; // 數值
    this.minterms = minterms; // 所覆蓋的 minterms
    this.combined = false; // 是否已被合併
  }

  // 取得二進位字串表示 (例如 "10-")
  toString(numVars) {
    let str = "";
    for (let i = numVars - 1; i >= 0; i--) {
      if ((this.mask & (1 << i)) === 0) {
        str += "-";
      } else {
        str += (this.value & (1 << i)) ? "1" : "0";
      }
    }
    return str;
  }

  // 取得變數表示法 (例如 A'B)
  toAlgebraic(varNames) {
    let terms = [];
    const numVars = varNames.length;
    for (let i = 0; i < numVars; i++) {
      const bitIndex = numVars - 1 - i;
      if ((this.mask & (1 << bitIndex)) !== 0) {
        if (this.value & (1 << bitIndex)) {
          terms.push(varNames[i]);
        } else {
          terms.push(varNames[i] + "'");
        }
      }
    }
    return terms.length === 0 ? "1" : terms.join("");
  }

  // 計算有幾個 1 (用於分組)
  countOnes() {
    let count = 0;
    let temp = this.value & this.mask;
    while (temp > 0) {
      if (temp & 1) count++;
      temp >>= 1;
    }
    return count;
  }

  // 檢查是否可與另一個項合併
  canCombineWith(other) {
    // 遮罩必須相同，且只有一個位元不同
    if (this.mask !== other.mask) return false;
    const diff = this.value ^ other.value;
    // 檢查 diff 是否為 2 的冪次方 (即只有一位元不同)
    return diff > 0 && (diff & (diff - 1)) === 0;
  }

  // 合併兩個項
  combineWith(other) {
    const diff = this.value ^ other.value;
    const newMask = this.mask & ~diff;
    const newValue = this.value & newMask;
    const newMinterms = Array.from(new Set([...this.minterms, ...other.minterms])).sort((a, b) => a - b);
    return new Implicant(newMask, newValue, newMinterms);
  }
}

/**
 * 核心布林化簡演算法 (Quine-McCluskey)
 * @param {number} numVars 變數數量 (3 或 4)
 * @param {number[]} minterms 輸出為 1 的 minterms
 * @param {number[]} dontCares 輸出為 X 的 dontCares
 * @returns {{ algebraic: string, terms: string[] }} 化簡後的布林表達式
 */
export function minimizeBoolean(numVars, minterms, dontCares) {
  if (minterms.length === 0) {
    return [];
  }
  const allTerms = [...minterms, ...dontCares];
  if (allTerms.length === (1 << numVars)) {
    return [new Implicant(0, 0, allTerms)];
  }

  // 1. 初始化第 0 階 implicants
  let currentImplicants = allTerms.map(val => new Implicant((1 << numVars) - 1, val, [val]));
  let primeImplicants = [];

  // 2. 遞迴合併
  while (currentImplicants.length > 0) {
    // 按 1 的數量分組
    const groups = {};
    for (const imp of currentImplicants) {
      const ones = imp.countOnes();
      if (!groups[ones]) groups[ones] = [];
      groups[ones].push(imp);
    }

    const nextImplicants = [];
    const keys = Object.keys(groups).map(Number).sort((a, b) => a - b);

    // 兩兩比對相鄰群組
    for (let i = 0; i < keys.length - 1; i++) {
      const g1 = groups[keys[i]];
      const g2 = groups[keys[i + 1]];
      if (!g1 || !g2) continue;

      for (const imp1 of g1) {
        for (const imp2 of g2) {
          if (imp1.canCombineWith(imp2)) {
            imp1.combined = true;
            imp2.combined = true;
            const combined = imp1.combineWith(imp2);
            // 避免重複加入
            if (!nextImplicants.some(n => n.mask === combined.mask && n.value === combined.value)) {
              nextImplicants.push(combined);
            }
          }
        }
      }
    }

    // 未被合併的項即為主要隱含項 (Prime Implicant)
    for (const imp of currentImplicants) {
      if (!imp.combined && !primeImplicants.some(p => p.mask === imp.mask && p.value === imp.value)) {
        primeImplicants.push(imp);
      }
    }

    currentImplicants = nextImplicants;
  }

  // 3. 覆蓋矩陣求解 (Petrick's Method 簡化版或貪婪覆蓋)
  // 因為只有 3-4 個變數，直接用簡單的覆蓋選擇即可
  let remainingMinterms = [...minterms];
  const chosenImplicants = [];

  // 先找出本質主要隱含項 (Essential Prime Implicants)
  // 如果某個 minterm 只被一個 PI 覆蓋，那它就是 Essential
  let changed = true;
  while (changed && remainingMinterms.length > 0) {
    changed = false;
    const coverage = {};
    for (const m of remainingMinterms) {
      coverage[m] = [];
      for (const pi of primeImplicants) {
        if (pi.minterms.includes(m)) {
          coverage[m].push(pi);
        }
      }
    }

    // 尋找只被一個 PI 覆蓋的 minterm
    for (const m of remainingMinterms) {
      if (coverage[m] && coverage[m].length === 1) {
        const epi = coverage[m][0];
        if (!chosenImplicants.includes(epi)) {
          chosenImplicants.push(epi);
          // 從剩餘 minterm 中移除已覆蓋的
          remainingMinterms = remainingMinterms.filter(x => !epi.minterms.includes(x));
          changed = true;
          break;
        }
      }
    }
  }

  // 4. 貪婪覆蓋剩餘的 minterms
  while (remainingMinterms.length > 0) {
    // 找出覆蓋最多剩餘 minterm 的 PI
    let bestPi = null;
    let maxCover = -1;

    for (const pi of primeImplicants) {
      if (chosenImplicants.includes(pi)) continue;
      const coverCount = pi.minterms.filter(m => remainingMinterms.includes(m)).length;
      if (coverCount > maxCover) {
        maxCover = coverCount;
        bestPi = pi;
      }
    }

    if (bestPi && maxCover > 0) {
      chosenImplicants.push(bestPi);
      remainingMinterms = remainingMinterms.filter(x => !bestPi.minterms.includes(x));
    } else {
      break;
    }
  }

  return chosenImplicants;
}

/**
 * 求解整個狀態表，輸出簡化後的方程式與卡諾圖資料
 * @param {string} modelType "Mealy" | "Moore"
 * @param {string} ffType "JK" | "T" | "D"
 * @param {string[]} states 狀態列表 (例如 ["A", "B", "C"])
 * @param {Object[]} transitions 轉移表項目
 * @param {Object} stateOutputs Moore 狀態輸出對照表 (僅 Moore 機型使用)
 */
export function solveSequentialCircuit(modelType, ffType, states, transitions, stateOutputs = {}) {
  const numStates = states.length;
  // 決定需要幾個正反器 (預設 2 個，支援最多 4 個狀態)
  const numFFs = Math.ceil(Math.log2(numStates)) || 1;
  const numVars = numFFs + 1; // 狀態變數 + 輸入 X (共 3 變數)

  // 狀態編碼映射表 (例如 A -> 00, B -> 01)
  const stateEncoding = {};
  states.forEach((state, index) => {
    stateEncoding[state] = index;
  });

  // 變數名稱清單 (例如 ["Q1", "Q0", "X"])
  const varNames = [];
  for (let i = numFFs - 1; i >= 0; i--) {
    varNames.push(`Q${i}`);
  }
  varNames.push("X");

  // 初始化各個正反器輸入與輸出的真值表
  // 激勵方程式 JK 的 J1, K1, J0, K0, T1, T0, D1, D0
  const excitationTables = {};
  if (ffType === "JK") {
    for (let i = 0; i < numFFs; i++) {
      excitationTables[`J${i}`] = Array(1 << numVars).fill("X");
      excitationTables[`K${i}`] = Array(1 << numVars).fill("X");
    }
  } else if (ffType === "T") {
    for (let i = 0; i < numFFs; i++) {
      excitationTables[`T${i}`] = Array(1 << numVars).fill("X");
    }
  } else if (ffType === "D") {
    for (let i = 0; i < numFFs; i++) {
      excitationTables[`D${i}`] = Array(1 << numVars).fill("X");
    }
  }

  // 輸出 Z 的真值表 (Mealy 模型有 2^numVars 項，Moore 模型只跟狀態有關)
  const outputTable = Array(1 << numVars).fill("X");

  // 填寫真值表
  // 對於每個二進位組合 (例如 000 代表 Q1=0, Q0=0, X=0)
  for (let val = 0; val < (1 << numVars); val++) {
    const x = val & 1;
    const currentStateVal = val >> 1;

    // 尋找對應的狀態名稱
    const currentStateName = states.find((s, idx) => idx === currentStateVal);

    // 如果該狀態編碼在實際狀態列表中不存在 (例如只有 A, B, C，那 11 即 D 就是 Don't Care)
    if (!currentStateName) {
      continue; // 保留為 "X" (Don't Care)
    }

    // 尋找轉移
    const trans = transitions.find(t => t.presentState === currentStateName && t.x === x);
    if (!trans) continue;

    const nextStateName = trans.nextState;
    const nextStateVal = stateEncoding[nextStateName];

    if (nextStateVal === undefined) continue;

    // 填寫正反器激勵值
    for (let i = 0; i < numFFs; i++) {
      const bitIndex = i; // Q0 是最低位元, Q1 是第 1 位元
      const q = (currentStateVal >> bitIndex) & 1;
      const qNext = (nextStateVal >> bitIndex) & 1;

      if (ffType === "JK") {
        let j, k;
        if (q === 0 && qNext === 0) { j = 0; k = "X"; }
        else if (q === 0 && qNext === 1) { j = 1; k = "X"; }
        else if (q === 1 && qNext === 0) { j = "X"; k = 1; }
        else if (q === 1 && qNext === 1) { j = "X"; k = 0; }

        excitationTables[`J${i}`][val] = j;
        excitationTables[`K${i}`][val] = k;
      } else if (ffType === "T") {
        excitationTables[`T${i}`][val] = (q ^ qNext);
      } else if (ffType === "D") {
        excitationTables[`D${i}`][val] = qNext;
      }
    }

    // 填寫輸出表
    if (modelType === "Mealy") {
      outputTable[val] = trans.z;
    } else {
      // Moore 機型的輸出只跟當前狀態有關
      outputTable[val] = stateOutputs[currentStateName] !== undefined ? stateOutputs[currentStateName] : 0;
    }
  }

  // 對各個輸出進行 Quine-McCluskey 布林簡化
  const equations = {};
  const kMaps = {};

  const solveEquation = (name, table) => {
    const minterms = [];
    const dontCares = [];

    table.forEach((v, idx) => {
      if (v === 1 || v === "1") minterms.push(idx);
      else if (v === "X" || v === "x") dontCares.push(idx);
    });

    const minimizedTerms = minimizeBoolean(numVars, minterms, dontCares);
    
    // 轉化為代數文字表示
    const algebraicTerms = minimizedTerms.map(t => t.toAlgebraic(varNames));
    let algebraic = algebraicTerms.join(" + ");
    if (algebraic === "") algebraic = "0";

    equations[name] = {
      algebraic: algebraic,
      terms: algebraicTerms,
      rawImplicants: minimizedTerms
    };

    kMaps[name] = {
      table: [...table],
      minimizedGroups: minimizedTerms.map(t => t.toString(numVars))
    };
  };

  // 求解正反器方程式
  Object.keys(excitationTables).forEach(name => {
    solveEquation(name, excitationTables[name]);
  });

  // 求解輸出 Z 方程式
  solveEquation("Z", outputTable);

  return {
    numFFs,
    stateEncoding,
    varNames,
    equations,
    kMaps
  };
}

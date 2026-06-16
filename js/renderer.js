/**
 * 序向電路 SVG 繪圖引擎
 */

// SVG 命名空間
const SVG_NS = "http://www.w3.org/2000/svg";

// 建立 SVG 元素
function createSVGElement(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  Object.keys(attrs).forEach(key => {
    el.setAttribute(key, attrs[key]);
  });
  return el;
}

// 取得邏輯閘的 SVG Path
const GATE_PATHS = {
  AND: "M 0 0 L 15 0 C 25 0, 30 10, 30 15 C 30 20, 25 30, 15 30 L 0 30 Z",
  OR: "M 0 0 C 10 2, 20 5, 30 15 C 20 25, 10 28, 0 30 C 5 20, 5 10, 0 0 Z",
  NOT: "M 0 0 L 20 10 L 0 20 Z",
  XOR: "M 0 0 C 8 2, 15 5, 23 15 C 15 25, 8 28, 0 30 C 4 20, 4 10, 0 0 Z M -4 0 C 0 10, 0 20, -4 30 C -1 20, -1 10, -4 0 Z"
};

/**
 * 渲染電路圖到指定的 SVG 容器中
 * @param {SVGSVGElement} svgContainer SVG 元素
 * @param {Object} solvedData 求解器輸出的資料
 * @param {string} ffType 正反器類型 ("JK" | "T" | "D")
 */
export function renderCircuit(svgContainer, solvedData, ffType) {
  // 清空舊的內容
  svgContainer.innerHTML = "";

  const { numFFs, equations, varNames } = solvedData;

  // 定義畫布尺寸與佈局參數
  const width = 1000;
  const height = 300 + numFFs * 200; // 每個正反器增加 200px 高度，動態調整畫布大小 (1 FF: 500, 2 FFs: 700, 3 FFs: 900)
  svgContainer.setAttribute("viewBox", `0 0 ${width} ${height}`);

  // 建立主要分組以支援縮放與拖曳
  const mainGroup = createSVGElement("g", { id: "circuit-main-group" });
  svgContainer.appendChild(mainGroup);

  // 繪製背景網格 (增加質感)
  const pattern = createSVGElement("pattern", {
    id: "grid",
    width: "20",
    height: "20",
    patternUnits: "userSpaceOnUse"
  });
  const gridPath = createSVGElement("path", {
    d: "M 20 0 L 0 0 0 20",
    fill: "none",
    stroke: "rgba(255, 255, 255, 0.03)",
    "stroke-width": "1"
  });
  pattern.appendChild(gridPath);
  svgContainer.appendChild(pattern);

  const rectBg = createSVGElement("rect", {
    width: "100%",
    height: "100%",
    fill: "url(#grid)",
    "pointer-events": "none"
  });
  mainGroup.appendChild(rectBg);

  // 1. 定義匯流排垂直 Rails
  // 對應：X, X', Q1, Q1', Q0, Q0' (如果支援 2 個正反器)
  const rails = {};
  const railStartX = 80;
  const railSpacing = 25;

  // 動態建立垂直軌道列表
  const railList = ["X", "X'"];
  for (let i = numFFs - 1; i >= 0; i--) {
    railList.push(`Q${i}`);
    railList.push(`Q${i}'`);
  }

  railList.forEach((name, idx) => {
    rails[name] = railStartX + idx * railSpacing;
  });

  // 繪製垂直軌道導線與標籤
  const railGroup = createSVGElement("g", { class: "bus-rails" });
  mainGroup.appendChild(railGroup);

  railList.forEach(name => {
    const x = rails[name];
    const isInput = name.startsWith("X");
    // 繪製軌道導線
    const line = createSVGElement("line", {
      x1: x,
      y1: 40,
      x2: x,
      y2: height - 50, // 動態延伸到畫布底部上方 50px
      stroke: isInput ? "#3b82f6" : "#10b981",
      "stroke-width": "2",
      "stroke-dasharray": name.includes("'") ? "2 2" : "none",
      class: isInput ? "rail-line rail-input" : "rail-line rail-feedback"
    });
    railGroup.appendChild(line);

    // 軌道上方標籤
    const label = createSVGElement("text", {
      x: x,
      y: 30,
      fill: isInput ? "#60a5fa" : "#34d399",
      "font-size": "12",
      "text-anchor": "middle",
      "font-family": "monospace",
      "font-weight": "bold",
      class: isInput ? "rail-label rail-input" : "rail-label rail-feedback"
    });
    label.textContent = name;
    railGroup.appendChild(label);
  });

  // 繪製 X 到 X' 的 NOT 反相器
  const notX = rails["X"];
  const notXPrime = rails["X'"];
  const notY = 45;

  const xNotWire = createSVGElement("path", {
    d: `M ${notX} ${notY} L ${notXPrime - 15} ${notY}`,
    stroke: "#3b82f6",
    "stroke-width": "2",
    fill: "none"
  });
  railGroup.appendChild(xNotWire);

  // NOT 閘本體
  const notGate = createSVGElement("path", {
    d: `M ${notXPrime - 15} ${notY - 8} L ${notXPrime - 5} ${notY} L ${notXPrime - 15} ${notY + 8} Z`,
    fill: "none",
    stroke: "#3b82f6",
    "stroke-width": "2",
    "data-type": "NOT",
    class: "logic-gate"
  });
  railGroup.appendChild(notGate);

  // NOT 閘氣泡
  const bubble = createSVGElement("circle", {
    cx: notXPrime - 3,
    cy: notY,
    r: 3,
    fill: "#030712",
    stroke: "#3b82f6",
    "stroke-width": "2",
    class: "not-bubble"
  });
  railGroup.appendChild(bubble);

  // 連接至 X' 軌道
  const notOutWire = createSVGElement("line", {
    x1: notXPrime,
    y1: notY,
    x2: notXPrime,
    y2: notY,
    stroke: "#3b82f6",
    "stroke-width": "2"
  });
  railGroup.appendChild(notOutWire);

  // X 軌道上的節點 (Dot)
  const xDot = createSVGElement("circle", {
    cx: notX,
    cy: notY,
    r: 4,
    fill: "#3b82f6",
    class: "connection-dot"
  });
  railGroup.appendChild(xDot);


  // 2. 定義正反器 (Flip-Flops) 坐標
  // 垂直排列：FF1 (Q1) 在上方，FF0 (Q0) 在下方
  const ffX = 650;
  const ffWidth = 85;
  const ffHeight = 120;

  const ffs = [];
  for (let i = 0; i < numFFs; i++) {
    const ffY = 80 + i * 200;
    ffs.push({
      index: i,
      x: ffX,
      y: ffY,
      name: `Q${i}`
    });
  }

  // 繪製正反器區塊
  const ffGroup = createSVGElement("g", { class: "flip-flops" });
  mainGroup.appendChild(ffGroup);

  ffs.forEach(ff => {
    // 正反器方框
    const rect = createSVGElement("rect", {
      x: ff.x,
      y: ff.y,
      width: ffWidth,
      height: ffHeight,
      rx: "8",
      fill: "rgba(30, 30, 46, 0.8)",
      stroke: "#10b981",
      "stroke-width": "2.5",
      filter: "drop-shadow(0 4px 10px rgba(16, 185, 129, 0.15))"
    });
    ffGroup.appendChild(rect);

    // 正反器名稱標籤 (例: Q1 Flip-Flop)
    const label = createSVGElement("text", {
      x: ff.x + ffWidth / 2,
      y: ff.y + ffHeight / 2,
      fill: "#e2e8f0",
      "font-size": "14",
      "text-anchor": "middle",
      "font-family": "system-ui, sans-serif",
      "font-weight": "600",
      class: "ff-title"
    });
    label.textContent = `${ffType} FF (${ff.name})`;
    ffGroup.appendChild(label);

    // 繪製時脈輸入三角形標誌 (CLK)
    const clkTriangle = createSVGElement("polygon", {
      points: `${ff.x},${ff.y + ffHeight - 30} ${ff.x + 10},${ff.y + ffHeight - 25} ${ff.x},${ff.y + ffHeight - 20}`,
      fill: "none",
      stroke: "#10b981",
      "stroke-width": "2"
    });
    ffGroup.appendChild(clkTriangle);

    const clkText = createSVGElement("text", {
      x: ff.x + 15,
      y: ff.y + ffHeight - 21,
      fill: "#10b981",
      "font-size": "10",
      "font-family": "monospace",
      class: "ff-clk-label"
    });
    clkText.textContent = "CLK";
    ffGroup.appendChild(clkText);

    // 輸入輸出腳位標籤
    const drawPinText = (px, py, text, anchor) => {
      const pinText = createSVGElement("text", {
        x: px,
        y: py,
        fill: "#a1a1aa",
        "font-size": "12",
        "font-family": "monospace",
        "text-anchor": anchor,
        "alignment-baseline": "middle",
        class: "ff-pin-label"
      });
      pinText.textContent = text;
      ffGroup.appendChild(pinText);
    };

    if (ffType === "JK") {
      drawPinText(ff.x + 8, ff.y + 25, "J", "start");
      drawPinText(ff.x + 8, ff.y + 75, "K", "start");
    } else if (ffType === "T") {
      drawPinText(ff.x + 8, ff.y + 40, "T", "start");
    } else if (ffType === "D") {
      drawPinText(ff.x + 8, ff.y + 40, "D", "start");
    }

    drawPinText(ff.x + ffWidth - 8, ff.y + 25, "Q", "end");
    drawPinText(ff.x + ffWidth - 8, ff.y + 75, "Q'", "end");
  });

  // 3. 繪製時脈 (CLK) 信號線
  const clkGroup = createSVGElement("g", { class: "clock-wires" });
  mainGroup.appendChild(clkGroup);

  const clkBusX = railStartX - 30;
  const clkBusY = height - 80; // 動態放置在畫布底部上方 80px
  const clkLabel = createSVGElement("text", {
    x: clkBusX - 5,
    y: clkBusY + 5,
    fill: "#10b981",
    "font-size": "12",
    "font-family": "sans-serif",
    "font-weight": "bold",
    "text-anchor": "end"
  });
  clkLabel.textContent = "CLK";
  clkGroup.appendChild(clkLabel);

  // CLK 主要匯流排
  const clkLine = createSVGElement("line", {
    x1: clkBusX,
    y1: clkBusY,
    x2: ffX - 25,
    y2: clkBusY,
    stroke: "#10b981",
    "stroke-width": "2",
    fill: "none"
  });
  clkGroup.appendChild(clkLine);

  // 連接至各個正反器
  ffs.forEach(ff => {
    const clkY = ff.y + ffHeight - 25;
    const path = createSVGElement("path", {
      d: `M ${ff.x - 25} ${clkY} L ${ff.x} ${clkY}`,
      stroke: "#10b981",
      "stroke-width": "2",
      fill: "none"
    });
    clkGroup.appendChild(path);
  });

  // 垂直 CLK 連接線
  const clkVertical = createSVGElement("line", {
    x1: ffX - 25,
    y1: ffs[0].y + ffHeight - 25,
    x2: ffX - 25,
    y2: clkBusY,
    stroke: "#10b981",
    "stroke-width": "2"
  });
  clkGroup.appendChild(clkVertical);

  // 4. 定義組合邏輯電路專區 (組合閘的放置與連線)
  // 將方程式對應到特定的垂直高度區域 (Zones)
  const zones = [];
  if (ffType === "JK") {
    // 每個正反器有 J 與 K，總共 2 * numFFs 區
    for (let i = 0; i < numFFs; i++) {
      zones.push({ name: `J${i}`, yStart: 50 + i * 200, yEnd: 130 + i * 200, targetY: ffs[i].y + 25 });
      zones.push({ name: `K${i}`, yStart: 130 + i * 200, yEnd: 210 + i * 200, targetY: ffs[i].y + 75 });
    }
  } else {
    // T 或 D 正反器，每個正反器只有一個輸入
    for (let i = 0; i < numFFs; i++) {
      zones.push({ name: `${ffType}${i}`, yStart: 70 + i * 200, yEnd: 170 + i * 200, targetY: ffs[i].y + 40 });
    }
  }
  // 最後一區是輸出 Z，放最底部的 Zone，避免重疊
  const zYStart = height - 180;
  const zYEnd = height - 100;
  const zTargetY = (zYStart + zYEnd) / 2;
  zones.push({ name: "Z", yStart: zYStart, yEnd: zYEnd, targetY: zTargetY });

  const gatesGroup = createSVGElement("g", { id: "circuit-gates" });
  mainGroup.appendChild(gatesGroup);

  const wiresGroup = createSVGElement("g", { id: "circuit-wires" });
  mainGroup.appendChild(wiresGroup);

  // 遍歷每一區，動態化簡與連線
  zones.forEach(zone => {
    const eqName = zone.name;
    const eq = equations[eqName];
    if (!eq) return;

    const midY = (zone.yStart + zone.yEnd) / 2;

    // 情境 A: 常數 0
    if (eq.algebraic === "0") {
      const gndWire = createSVGElement("path", {
        d: `M ${ffX - 30} ${zone.targetY} L ${ffX} ${zone.targetY}`,
        stroke: "#94a3b8",
        "stroke-width": "2",
        fill: "none"
      });
      wiresGroup.appendChild(gndWire);

      // 繪製接地符號
      const gndSym = createSVGElement("path", {
        d: `M ${ffX - 35} ${zone.targetY - 5} L ${ffX - 35} ${zone.targetY + 5} M ${ffX - 30} ${zone.targetY} L ${ffX - 35} ${zone.targetY}`,
        stroke: "#64748b",
        "stroke-width": "2"
      });
      gatesGroup.appendChild(gndSym);
      return;
    }

    // 情境 B: 常數 1
    if (eq.algebraic === "1") {
      const vccWire = createSVGElement("path", {
        d: `M ${ffX - 30} ${zone.targetY} L ${ffX} ${zone.targetY}`,
        stroke: "#f59e0b",
        "stroke-width": "2",
        fill: "none"
      });
      wiresGroup.appendChild(vccWire);

      const vccSym = createSVGElement("text", {
        x: ffX - 35,
        y: zone.targetY + 4,
        fill: "#f59e0b",
        "font-size": "10",
        "font-family": "monospace",
        "text-anchor": "end",
        "font-weight": "bold"
      });
      vccSym.textContent = "VCC(1)";
      gatesGroup.appendChild(vccSym);
      return;
    }

    // 解析 SOP 項
    const terms = eq.terms; // 例如 ["Q1", "Q0'X"]

    // 用於記錄要接入 OR 閘的輸入端坐標
    const orInputs = [];

    // 單一 Literal 與 多個 AND 項混合處理
    terms.forEach((term, tIdx) => {
      // 計算該項的垂直擺放位置
      const termY = terms.length === 1 ? midY : zone.yStart + (tIdx + 0.5) * ((zone.yEnd - zone.yStart) / terms.length);

      // 分析該項所包含的 Literals (例: "Q0'X" -> ["Q0'", "X"])
      const literals = [];
      let i = 0;
      while (i < term.length) {
        let name = term[i];
        if (name === "Q" && i + 1 < term.length) {
          name += term[i + 1];
          i += 2;
        } else {
          i++;
        }
        if (i < term.length && term[i] === "'") {
          name += "'";
          i++;
        }
        literals.push(name);
      }

      if (literals.length === 1) {
        // 單一變數：直接接線 (拉到 OR 閘或直接拉到正反器腳位)
        const litName = literals[0];
        const railX = rails[litName];
        if (railX !== undefined) {
          const outX = terms.length === 1 ? ffX : ffX - 100;
          
          // 繪製拉線軌道
          const wirePath = createSVGElement("path", {
            d: `M ${railX} ${termY} L ${outX} ${termY}`,
            stroke: "#3b82f6",
            "stroke-width": "2",
            fill: "none"
          });
          wiresGroup.appendChild(wirePath);

          // 軌道連接點
          const dot = createSVGElement("circle", {
            cx: railX,
            cy: termY,
            r: 3.5,
            fill: "#3b82f6",
            class: "connection-dot"
          });
          wiresGroup.appendChild(dot);

          if (terms.length === 1) {
            // 直接連入 FF
            const finalWire = createSVGElement("path", {
              d: `M ${outX} ${termY} L ${ffX} ${zone.targetY}`,
              stroke: "#3b82f6",
              "stroke-width": "2",
              fill: "none"
            });
            wiresGroup.appendChild(finalWire);
          } else {
            // 記錄為 OR 閘的輸入
            orInputs.push({ x: outX, y: termY });
          }
        }
      } else {
        // 多個變數：建立 AND 閘
        const gateX = ffX - 150;
        const gateY = termY - 15; // 閘高 30，置中

        const andGate = createSVGElement("path", {
          d: GATE_PATHS.AND,
          transform: `translate(${gateX}, ${gateY})`,
          fill: "rgba(30, 30, 46, 0.9)",
          stroke: "#3b82f6",
          "stroke-width": "2",
          "data-equation": eqName,
          "data-type": "AND",
          class: "logic-gate"
        });
        gatesGroup.appendChild(andGate);

        const gateText = createSVGElement("text", {
          x: gateX + 8,
          y: gateY + 18,
          fill: "rgba(255,255,255,0.4)",
          "font-size": "9",
          "font-family": "sans-serif",
          "pointer-events": "none",
          "data-type": "AND"
        });
        gateText.textContent = "&";
        gatesGroup.appendChild(gateText);

        // 連接 AND 閘的輸入端
        literals.forEach((litName, lIdx) => {
          const railX = rails[litName];
          if (railX !== undefined) {
            // 邏輯閘輸入端 Y 點偏置，讓兩根輸入線錯開
            const inputOffset = literals.length === 2 ? (lIdx === 0 ? 8 : 22) : 5 + lIdx * (20 / (literals.length - 1));
            const inputY = gateY + inputOffset;

            const inputWire = createSVGElement("path", {
              d: `M ${railX} ${inputY} L ${gateX} ${inputY}`,
              stroke: "#3b82f6",
              "stroke-width": "2",
              fill: "none"
            });
            wiresGroup.appendChild(inputWire);

            // 連接點
            const dot = createSVGElement("circle", {
              cx: railX,
              cy: inputY,
              r: 3.5,
              fill: "#3b82f6",
              class: "connection-dot"
            });
            wiresGroup.appendChild(dot);
          }
        });

        // 連接 AND 閘的輸出端
        const andOutX = gateX + 30;
        const andOutY = gateY + 15;

        if (terms.length === 1) {
          // 只有一項，AND 閘直接接往 FF
          const finalWire = createSVGElement("path", {
            d: `M ${andOutX} ${andOutY} H ${ffX - 30} V ${zone.targetY} H ${ffX}`,
            stroke: "#3b82f6",
            "stroke-width": "2",
            fill: "none"
          });
          wiresGroup.appendChild(finalWire);
        } else {
          // 多項，拉線到 OR 閘的位置
          const toOrX = ffX - 90;
          const toOrWire = createSVGElement("path", {
            d: `M ${andOutX} ${andOutY} H ${toOrX}`,
            stroke: "#3b82f6",
            "stroke-width": "2",
            fill: "none"
          });
          wiresGroup.appendChild(toOrWire);
          orInputs.push({ x: toOrX, y: andOutY });
        }
      }
    });

    // 如果有多項 (Product Terms)，需要繪製 OR 閘將它們連接
    if (terms.length > 1) {
      const orX = ffX - 80;
      const orY = zone.targetY - 15;

      const orGate = createSVGElement("path", {
        d: GATE_PATHS.OR,
        transform: `translate(${orX}, ${orY})`,
        fill: "rgba(30, 30, 46, 0.9)",
        stroke: "#8b5cf6",
        "stroke-width": "2",
        "data-equation": eqName,
        "data-type": "OR",
        class: "logic-gate"
      });
      gatesGroup.appendChild(orGate);

      const gateText = createSVGElement("text", {
        x: orX + 6,
        y: orY + 18,
        fill: "rgba(255,255,255,0.4)",
        "font-size": "9",
        "font-family": "sans-serif",
        "pointer-events": "none",
        "data-type": "OR"
      });
      gateText.textContent = "≥1";
      gatesGroup.appendChild(gateText);

      // 連接各個 AND 閘 / Literals 到 OR 閘的輸入端
      orInputs.forEach((inPoint, oIdx) => {
        const inputOffset = orInputs.length === 2 ? (oIdx === 0 ? 8 : 22) : 5 + oIdx * (20 / (orInputs.length - 1));
        const inputY = orY + inputOffset;

        const connectWire = createSVGElement("path", {
          // 正交佈線：先橫拉、再縱拉、再連入 OR 閘
          d: `M ${inPoint.x} ${inPoint.y} L ${orX - 10} ${inPoint.y} L ${orX - 10} ${inputY} L ${orX} ${inputY}`,
          stroke: "#3b82f6",
          "stroke-width": "2",
          fill: "none"
        });
        wiresGroup.appendChild(connectWire);
      });

      // OR 閘輸出端連接到 FF
      const orOutX = orX + 30;
      const orOutY = orY + 15;
      const finalWire = createSVGElement("path", {
        d: `M ${orOutX} ${orOutY} H ${ffX}`,
        stroke: "#8b5cf6",
        "stroke-width": "2.5",
        fill: "none",
        class: "or-output-wire"
      });
      wiresGroup.appendChild(finalWire);
    }
  });

  // 5. 繪製輸出信號 Z (外部線路與標籤)
  const zZone = zones.find(z => z.name === "Z");
  if (zZone) {
    const zOutWire = createSVGElement("path", {
      d: `M ${ffX - 50} ${zZone.targetY} L ${width - 80} ${zZone.targetY}`,
      stroke: "#f43f5e",
      "stroke-width": "2.5",
      fill: "none"
    });
    wiresGroup.appendChild(zOutWire);

    // 輸出端 Z 圓點與文字
    const zCircle = createSVGElement("circle", {
      cx: width - 80,
      cy: zZone.targetY,
      r: 4,
      fill: "#f43f5e",
      class: "connection-dot output-dot"
    });
    wiresGroup.appendChild(zCircle);

    const zLabel = createSVGElement("text", {
      x: width - 70,
      y: zZone.targetY + 5,
      fill: "#f43f5e",
      "font-size": "14",
      "font-family": "monospace",
      "font-weight": "bold"
    });
    zLabel.textContent = "Z";
    wiresGroup.appendChild(zLabel);
  }

  // 6. 繪製反饋迴路線 (Feedback Loops)
  // 將正反器輸出的 Q 與 Q' 接回到左側軌道 (Rails)
  const feedbackGroup = createSVGElement("g", { class: "feedback-loops" });
  mainGroup.appendChild(feedbackGroup);

  ffs.forEach((ff, idx) => {
    // Q 反饋 (向上繞行)
    const qOutX = ff.x + ffWidth;
    const qOutY = ff.y + 25;
    const qRailX = rails[`Q${ff.index}`];
    const qUpY = 20 + idx * 15; // 錯開高度避免重疊

    const qPath = createSVGElement("path", {
      d: `M ${qOutX} ${qOutY} L ${qOutX + 25 + idx * 15} ${qOutY} L ${qOutX + 25 + idx * 15} ${qUpY} L ${qRailX} ${qUpY} L ${qRailX} ${qOutY}`,
      stroke: "#10b981",
      "stroke-width": "2",
      fill: "none",
      "stroke-dasharray": "none",
      class: "feedback-wire"
    });
    feedbackGroup.appendChild(qPath);

    // 反饋連接點 (與軌道相接處)
    const qDot = createSVGElement("circle", {
      cx: qRailX,
      cy: qOutY,
      r: 3.5,
      fill: "#10b981",
      class: "connection-dot feedback-dot"
    });
    feedbackGroup.appendChild(qDot);

    // Q' 反饋 (向下繞行)
    const qPrimeOutX = ff.x + ffWidth;
    const qPrimeOutY = ff.y + 75;
    const qPrimeRailX = rails[`Q${ff.index}'`];
    const qDownY = height - 130 - idx * 15; // 底部高度錯開，適應動態高度

    const qPrimePath = createSVGElement("path", {
      d: `M ${qPrimeOutX} ${qPrimeOutY} L ${qPrimeOutX + 15 + idx * 15} ${qPrimeOutY} L ${qPrimeOutX + 15 + idx * 15} ${qDownY} L ${qPrimeRailX} ${qDownY} L ${qPrimeRailX} ${qPrimeOutY}`,
      stroke: "#10b981",
      "stroke-width": "2",
      fill: "none",
      "stroke-dasharray": "3 2", // 虛線表示反向
      class: "feedback-wire"
    });
    feedbackGroup.appendChild(qPrimePath);

    const qPrimeDot = createSVGElement("circle", {
      cx: qPrimeRailX,
      cy: qPrimeOutY,
      r: 3.5,
      fill: "#10b981",
      class: "connection-dot feedback-dot"
    });
    feedbackGroup.appendChild(qPrimeDot);
  });
}

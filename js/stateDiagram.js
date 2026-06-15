/**
 * 狀態轉移圖 (State Diagram) SVG 繪圖引擎
 */

const SVG_NS = "http://www.w3.org/2000/svg";

function createSVG(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  Object.keys(attrs).forEach(key => {
    el.setAttribute(key, attrs[key]);
  });
  return el;
}

export function renderStateDiagram(svgContainer, solvedData, modelType, transitions, states, mooreOutputs) {
  svgContainer.innerHTML = "";

  const width = 1000;
  const height = 550;
  svgContainer.setAttribute("viewBox", `0 0 ${width} ${height}`);

  // 建立主要分組
  const mainGroup = createSVG("g", { id: "circuit-main-group" });
  svgContainer.appendChild(mainGroup);

  // 1. 定義箭頭 Marker
  let defs = createSVG("defs");
  mainGroup.appendChild(defs);

  const createMarker = (id, color) => {
    const marker = createSVG("marker", {
      id: id,
      viewBox: "0 0 10 10",
      refX: "8", // 箭頭尖端位置
      refY: "5",
      markerWidth: "7",
      markerHeight: "7",
      orient: "auto-start-reverse"
    });
    const path = createSVG("path", {
      d: "M 0 1.5 L 9 5 L 0 8.5 Z",
      fill: color
    });
    marker.appendChild(path);
    defs.appendChild(marker);
  };

  createMarker("arrow-x0", "#3b82f6"); // x=0 使用藍色箭頭
  createMarker("arrow-x1", "#f59e0b"); // x=1 使用橘黃色箭頭

  // 2. 計算節點座標
  const numStates = states.length;
  const cx = width / 2;
  const cy = height / 2;
  const R = 180; // 排列圓半徑
  const nodeRadius = 38; // 狀態節點半徑

  const nodeCoords = {};
  states.forEach((state, i) => {
    const theta = (i * 2 * Math.PI) / numStates - Math.PI / 2;
    nodeCoords[state] = {
      x: cx + R * Math.cos(theta),
      y: cy + R * Math.sin(theta),
      angle: theta
    };
  });

  // 3. 繪製轉移弧線
  const wiresGroup = createSVG("g", { id: "diag-arrows" });
  mainGroup.appendChild(wiresGroup);

  transitions.forEach(t => {
    const fromName = t.presentState;
    const toName = t.nextState;
    const xVal = t.x;
    
    // 如果該狀態不存在於目前的狀態清單中，跳過
    if (!nodeCoords[fromName] || !nodeCoords[toName]) return;

    const from = nodeCoords[fromName];
    const to = nodeCoords[toName];
    const color = xVal === 0 ? "#3b82f6" : "#f59e0b";
    const markerId = xVal === 0 ? "url(#arrow-x0)" : "url(#arrow-x1)";
    const labelText = modelType === "Mealy" ? `${xVal}/${t.z}` : `${xVal}`;

    if (fromName === toName) {
      // 情境 A: 自己轉移到自己 (Self-loop)
      // 沿著狀態節點的外徑方向向外畫一個圓弧
      const angle = from.angle;
      const loopSize = 35;
      
      // 起點與終點 (在節點圓周上錯開角度)
      const startAngle = angle - 0.25;
      const endAngle = angle + 0.25;

      const sx = from.x + nodeRadius * Math.cos(startAngle);
      const sy = from.y + nodeRadius * Math.sin(startAngle);
      const ex = from.x + nodeRadius * Math.cos(endAngle);
      const ey = from.y + nodeRadius * Math.sin(endAngle);

      // 控制點：往外拉
      const cp1x = from.x + (nodeRadius + loopSize * 1.8) * Math.cos(startAngle - 0.2);
      const cp1y = from.y + (nodeRadius + loopSize * 1.8) * Math.sin(startAngle - 0.2);
      const cp2x = from.x + (nodeRadius + loopSize * 1.8) * Math.cos(endAngle + 0.2);
      const cp2y = from.y + (nodeRadius + loopSize * 1.8) * Math.sin(endAngle + 0.2);

      const pathStr = `M ${sx} ${sy} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${ex} ${ey}`;
      
      const path = createSVG("path", {
        d: pathStr,
        stroke: color,
        "stroke-width": "2",
        fill: "none",
        "marker-end": markerId
      });
      wiresGroup.appendChild(path);

      // 標籤位置
      const lx = from.x + (nodeRadius + loopSize * 1.5) * Math.cos(angle);
      const ly = from.y + (nodeRadius + loopSize * 1.5) * Math.sin(angle) + 4;

      const text = createSVG("text", {
        x: lx,
        y: ly,
        fill: color,
        "font-size": "13",
        "font-family": "monospace",
        "font-weight": "bold",
        "text-anchor": "middle"
      });
      text.textContent = labelText;
      wiresGroup.appendChild(text);

    } else {
      // 情境 B: 轉移到其他節點
      // 繪製帶有弧度的二次貝氏曲線，避免 AB 與 BA 線條重疊
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const ux = dx / dist;
      const uy = dy / dist;

      // 法向量 (垂直向量) 用於控制偏移與彎曲
      const nx = -uy;
      const ny = ux;

      const offsetDist = 8; // 側向偏移距離，讓去回線錯開
      const curveHeight = 25; // 彎曲弧度高度

      // 起終點微調 (移到圓周上，並往外偏一點點避免重疊)
      const sx = from.x + nodeRadius * ux + offsetDist * nx;
      const sy = from.y + nodeRadius * uy + offsetDist * ny;
      const ex = to.x - nodeRadius * ux + offsetDist * nx;
      const ey = to.y - nodeRadius * uy + offsetDist * ny;

      // 控制點
      const cpx = (sx + ex) / 2 + curveHeight * nx;
      const cpy = (sy + ey) / 2 + curveHeight * ny;

      const pathStr = `M ${sx} ${sy} Q ${cpx} ${cpy} ${ex} ${ey}`;

      const path = createSVG("path", {
        d: pathStr,
        stroke: color,
        "stroke-width": "2",
        fill: "none",
        "marker-end": markerId
      });
      wiresGroup.appendChild(path);

      // 計算標籤位置 (曲線中點偏上)
      const t = 0.5;
      const lx = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cpx + t * t * ex + 10 * nx;
      const ly = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cpy + t * t * ey + 10 * ny + 4;

      const text = createSVG("text", {
        x: lx,
        y: ly,
        fill: color,
        "font-size": "13",
        "font-family": "monospace",
        "font-weight": "bold",
        "text-anchor": "middle"
      });
      text.textContent = labelText;
      wiresGroup.appendChild(text);
    }
  });

  // 4. 繪製狀態節點 (放後面確保蓋在箭頭線上方)
  const nodesGroup = createSVG("g", { id: "diag-nodes" });
  mainGroup.appendChild(nodesGroup);

  states.forEach(state => {
    const coord = nodeCoords[state];
    
    // 圓形外圈 (Cyberpunk 霓虹風)
    const circle = createSVG("circle", {
      cx: coord.x,
      cy: coord.y,
      r: nodeRadius,
      fill: "#080b11",
      stroke: "#10b981",
      "stroke-width": "2.5",
      filter: "drop-shadow(0 0 6px rgba(16, 185, 129, 0.4))",
      style: "cursor: pointer;"
    });
    nodesGroup.appendChild(circle);

    // 狀態名稱文字
    const nameText = createSVG("text", {
      x: coord.x,
      y: modelType === "Moore" ? coord.y - 6 : coord.y + 5,
      fill: "#f8fafc",
      "font-size": "15",
      "font-weight": "bold",
      "text-anchor": "middle",
      "font-family": "sans-serif",
      style: "pointer-events: none;"
    });
    nameText.textContent = state;
    nodesGroup.appendChild(nameText);

    // 如果是 Moore 機器，繪製狀態內斜線與輸出值 (例: A/0)
    if (modelType === "Moore") {
      // 繪製圓內的橫線/斜線
      const divider = createSVG("line", {
        x1: coord.x - nodeRadius + 8,
        y1: coord.y + 2,
        x2: coord.x + nodeRadius - 8,
        y2: coord.y + 2,
        stroke: "rgba(255, 255, 255, 0.15)",
        "stroke-width": "1"
      });
      nodesGroup.appendChild(divider);

      const outTextVal = mooreOutputs[state] !== undefined ? mooreOutputs[state] : 0;
      const outText = createSVG("text", {
        x: coord.x,
        y: coord.y + 16,
        fill: "#f43f5e", // 紅色輸出標示
        "font-size": "11",
        "font-weight": "bold",
        "text-anchor": "middle",
        "font-family": "monospace",
        style: "pointer-events: none;"
      });
      outText.textContent = `z=${outTextVal}`;
      nodesGroup.appendChild(outText);
    }
  });

  // 5. 左下角繪製圖例 (Legend)
  const legendGroup = createSVG("g", { transform: "translate(30, 500)" });
  mainGroup.appendChild(legendGroup);

  const drawLegendItem = (y, color, text) => {
    const line = createSVG("line", {
      x1: 0,
      y1: y,
      x2: 30,
      y2: y,
      stroke: color,
      "stroke-width": "2"
    });
    const textNode = createSVG("text", {
      x: 38,
      y: y + 4,
      fill: "#cbd5e1",
      "font-size": "12",
      "font-family": "sans-serif"
    });
    textNode.textContent = text;
    legendGroup.appendChild(line);
    legendGroup.appendChild(textNode);
  };

  drawLegendItem(0, "#3b82f6", "輸入 X = 0 的轉移路徑");
  drawLegendItem(20, "#f59e0b", "輸入 X = 1 的轉移路徑");
}

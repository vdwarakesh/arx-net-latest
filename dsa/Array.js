// dsa/Array.js
// Parses user input from containerEl.userInput, draws an Array on the container's canvas using D3.js,
// and provides right-click dynamic add/delete and drag-to-reorder interactions.

import * as d3Module from './d3.js';
const d3 = window.d3 || d3Module;

// ========== Hyperparameters ==========
export const ARRAY_HYPERPARAMETERS = {
  MIN_BAR_HEIGHT_RATIO: 0.10, // Least element is 10% of the canvas height
  MAX_BAR_HEIGHT_RATIO: 0.30, // Max element is 30% of the canvas height (reaches 30% limit from 60% baseline)
  TOP_LIMIT_RATIO: 0.30,      // Top of the tallest bar sits at 30% from the top of the canvas
  BOTTOM_BASELINE_RATIO: 0.60,// Baseline of all bars sits at 60% from the top of the canvas
  HORIZONTAL_SPAN_RATIO: 0.70,// Array spans up to 70% of the canvas width
  MAX_BAR_WIDTH: 68,          // Maximum width of a single bar in world px
  MIN_BAR_WIDTH: 24,          // Minimum width of a single bar in world px
  BAR_PADDING: 0.22,          // Padding ratio between bars (for d3.scaleBand)
  FONT_FAMILY: "'Adwaita Sans', -apple-system, BlinkMacSystemFont, sans-serif",
};

function recomputeNumericMagnitudes(items) {
  const allNumbers = items.length > 0 && items.every((d) => d.isNumber);
  items.forEach((d, idx) => {
    if (allNumbers || d.isNumber) {
      d.numericValue = Number(d.value);
    } else {
      const strVal = String(d.value);
      d.numericValue = strVal.length + (strVal.charCodeAt(0) || 0) / 255;
    }
    d.index = idx;
  });
  return items;
}

export function parseSingleToken(rawVal) {
  const trimmed = String(rawVal ?? '').trim();
  const num = Number(trimmed);
  const isNumber = trimmed !== '' && !Number.isNaN(num) && Number.isFinite(num);
  return {
    raw: trimmed,
    value: isNumber ? num : trimmed,
    isNumber,
  };
}

/**
 * Parses flexible array input formats:
 * - Space-separated: "1 2 3"
 * - Comma-separated: "1,2,3"
 * - Bracketed or mixed: "[1, 2, 3]", "(1 2 3)", "{1,2,3 1 2 3"
 * - Strings & quoted tokens: "apple, banana, 'cherry pie'"
 */
export function parseArrayInput(rawInput) {
  if (rawInput === null || rawInput === undefined) return [];
  let str = String(rawInput).trim();
  if (!str) return [];

  str = str.replace(/^[\[\(\{\s]+|[\]\)\}\s]+$/g, '').trim();
  if (!str) return [];

  const tokenRegex = /"([^"]*)"|'([^']*)'|([^,\s\[\]\(\)\{\}]+)/g;
  const items = [];
  let match;

  while ((match = tokenRegex.exec(str)) !== null) {
    const quoted = match[1] !== undefined ? match[1] : match[2];
    const unquoted = match[3];
    const rawToken = quoted !== undefined ? quoted : unquoted;

    if (quoted !== undefined) {
      items.push({ raw: rawToken, value: rawToken, isNumber: false });
    } else {
      items.push(parseSingleToken(rawToken));
    }
  }

  return recomputeNumericMagnitudes(items);
}

function syncArrayDataToContainer(containerEl, items) {
  recomputeNumericMagnitudes(items);
  containerEl._arrayData = items;
  const serialized = items.map((d) => d.raw).join(', ');
  containerEl.userInput = serialized;
  containerEl.setAttribute('userInput', serialized);
  if (typeof window.updateDsHeaderWarningState === 'function') {
    window.updateDsHeaderWarningState();
  }
}

export function getContainerArrayData(containerEl) {
  if (!containerEl._arrayData) {
    const rawInput = containerEl.userInput ?? containerEl.getAttribute('userInput') ?? '';
    containerEl._arrayData = parseArrayInput(rawInput);
  }
  return containerEl._arrayData;
}

/**
 * Draws the array onto the canvas inside `containerEl` using D3 scales.
 */
export function drawArray(containerEl, camera = null, customHyperparams = {}) {
  if (!containerEl) return;

  const hp = { ...ARRAY_HYPERPARAMETERS, ...customHyperparams };
  const canvas = containerEl.querySelector('canvas.ds-grid-canvas') || containerEl.querySelector('canvas');
  if (!canvas) return;

  const data = getContainerArrayData(containerEl);
  containerEl._barHitBoxes = [];
  if (data.length === 0) return;

  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  if (w <= 0 || h <= 0) return;

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const ctx = canvas.getContext('2d');

  const rootStyle = getComputedStyle(document.documentElement);
  const barFill = rootStyle.getPropertyValue('--ds-primary').trim();
  const textBright = rootStyle.getPropertyValue('--text-bright').trim();
  const textDark = rootStyle.getPropertyValue('--text-dark').trim();

  const cam = camera || containerEl._camera || { x: 0, y: 0, z: 1 };
  const useWorldOrigin = Boolean(camera || containerEl._camera);

  if (!containerEl._baseViewport || containerEl._baseViewport.w === 0) {
    containerEl._baseViewport = { w, h };
    containerEl._worldOrigin = {
      x: (w / (2 * cam.z)) - cam.x,
      y: (h / (2 * cam.z)) - cam.y,
    };
  }
  const baseW = useWorldOrigin ? containerEl._baseViewport.w : w;
  const baseH = useWorldOrigin ? containerEl._baseViewport.h : h;
  const originX = useWorldOrigin && containerEl._worldOrigin ? containerEl._worldOrigin.x : 0;
  const originY = useWorldOrigin && containerEl._worldOrigin ? containerEl._worldOrigin.y : 0;

  const minBarH = baseH * hp.MIN_BAR_HEIGHT_RATIO;
  const maxBarH = baseH * hp.MAX_BAR_HEIGHT_RATIO;
  const baselineY = useWorldOrigin
    ? originY - (baseH / 2) + (baseH * hp.BOTTOM_BASELINE_RATIO)
    : (baseH * hp.BOTTOM_BASELINE_RATIO);

  const [minVal, maxVal] = d3.extent(data, (d) => d.numericValue);
  const heightScale = d3.scaleLinear()
    .domain(minVal === maxVal ? [minVal - 1, maxVal + 1] : [minVal, maxVal])
    .range([minBarH, maxBarH]);

  const maxSpanW = baseW * hp.HORIZONTAL_SPAN_RATIO;
  const idealTotalW = Math.min(maxSpanW, data.length * (hp.MAX_BAR_WIDTH / (1 - hp.BAR_PADDING)));
  const totalW = Math.max(idealTotalW, data.length * hp.MIN_BAR_WIDTH);

  const startX = useWorldOrigin ? (originX - totalW / 2) : ((baseW - totalW) / 2);
  const endX = startX + totalW;

  const xScale = d3.scaleBand()
    .domain(d3.range(data.length))
    .range([startX, endX])
    .paddingInner(hp.BAR_PADDING)
    .paddingOuter(hp.BAR_PADDING / 2);

  const barWidth = xScale.bandwidth();
  const stepX = xScale.step();

  containerEl._arrayLayoutMeta = { startX, stepX, barWidth, baselineY };

  ctx.save();
  if (useWorldOrigin) {
    ctx.setTransform(
      cam.z * dpr,
      0,
      0,
      cam.z * dpr,
      cam.x * cam.z * dpr,
      cam.y * cam.z * dpr
    );
  } else {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const dragState = containerEl._dragState;

  data.forEach((d, i) => {
    const isDraggingThis = dragState && dragState.index === i;
    const barH = minVal === maxVal ? maxBarH : heightScale(d.numericValue);
    const x = isDraggingThis ? (dragState.worldX - barWidth / 2) : xScale(i);
    const y = baselineY - barH;

    // Save world-space hitbox for right-click and drag hit-testing
    containerEl._barHitBoxes.push({
      index: i,
      x: xScale(i),
      y,
      w: barWidth,
      h: barH,
    });

    // Check if an algorithm simulation is currently highlighting this bar
    const simState = containerEl._simState;
    const isCurrentBar = simState && simState.activeIndex === i;
    const isFoundBar = simState && simState.foundIndex === i;
    const isCheckedBar = simState && Array.isArray(simState.checkedIndices) && simState.checkedIndices.includes(i);

    let currentFill = barFill;
    let currentBorder = '#00000000';
    let currentAlpha = isDraggingThis ? 0.98 : 0.86;

    if (isFoundBar) {
      currentFill = '#12a67c'; // Green when target is found
      currentBorder = '#5cbd6e';
      currentAlpha = 1;
    } else if (isCurrentBar) {
      currentFill = '#f1ac4b'; // Amber/Gold when currently inspecting i
      currentBorder = '#ffffff';
      currentAlpha = 1;
    } else if (isCheckedBar) {
      currentAlpha = 0.42; // Dimmed after being checked and not matching
    }

    // 1. Sharp Rectangular Bar (no border-radius)
    ctx.beginPath();
    ctx.rect(x, y, barWidth, barH);
    ctx.fillStyle = currentFill;
    ctx.globalAlpha = currentAlpha;
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.lineWidth = (isDraggingThis || isCurrentBar || isFoundBar) ? 2.4 : 1.5;
    ctx.strokeStyle = currentBorder;
    ctx.stroke();

    // 2. Value Label (placed near the bottom inside the bar, right above the baseline)
    const valFontSize = 20;
    ctx.font = `700 ${valFontSize}px ${hp.FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const valX = x + barWidth / 2;
    const valY = baselineY - 20;

    ctx.fillStyle = textDark;
    ctx.fillText(String(d.value), valX, valY);

    // 3. Index Label (placed directly below the baseline, right below the value)
    const idxFontSize = 20;
    ctx.font = `700 ${idxFontSize}px ${hp.FONT_FAMILY}`;
    ctx.fillStyle = textBright;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(i), valX, baselineY + 20);
  });

  ctx.restore();
}

/**
 * Attaches right-click context menu (via FloatingWindow) and drag-to-reorder to an Array container.
 */
export function setupArrayInteractions(containerEl, requestRender) {
  const canvas = containerEl.querySelector('canvas');
  if (!canvas || containerEl._arrayInteractionsBound) return;
  containerEl._arrayInteractionsBound = true;

  let modal = null;
  const getModal = (title) => {
    if (!modal && window.FloatingWindow) {
      modal = new window.FloatingWindow(title);
    }
    if (modal) {
      const titleSpan = modal.overlay.querySelector('.modal-header span');
      if (titleSpan) titleSpan.textContent = title;
    }
    return modal;
  };

  const screenToWorld = (clientX, clientY) => {
    const r = canvas.getBoundingClientRect();
    const sx = clientX - r.left;
    const sy = clientY - r.top;
    const cam = containerEl._camera || { x: 0, y: 0, z: 1 };
    return {
      x: sx / cam.z - cam.x,
      y: sy / cam.z - cam.y,
    };
  };

  const hitTestBar = (wx, wy) => {
    const boxes = containerEl._barHitBoxes || [];
    for (let i = boxes.length - 1; i >= 0; i--) {
      const b = boxes[i];
      // Include the index label area just below the bar for easy clicking
      if (wx >= b.x && wx <= b.x + b.w && wy >= b.y && wy <= b.y + b.h + 26) {
        return b.index;
      }
    }
    return -1;
  };

  // Helper to open the second floating window for inputting values (with a Back button)
  const openValueInputModal = (title, placeholder, buttonText, onSubmit, onBack) => {
    const win = getModal(title);
    if (!win) return;

    win.setContent(`
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        <input type="text" id="arr-fw-val" class="param-input-field" placeholder="${placeholder}" />
        <div style="display: flex; gap: 0.4rem;">
          <button type="button" id="arr-fw-back" class="vscode-btn-secondary" style="flex: 1;">Back</button>
          <button type="button" id="arr-fw-submit" class="vscode-btn-secondary" style="flex: 2;">${buttonText}</button>
        </div>
      </div>
    `);
    win.open();

    const inputEl = win.body.querySelector('#arr-fw-val');
    const handleConfirm = () => {
      const raw = inputEl.value.trim();
      if (!raw) return;
      onSubmit(raw);
      win.close();
      requestRender();
    };

    win.body.querySelector('#arr-fw-submit').onclick = handleConfirm;
    win.body.querySelector('#arr-fw-back').onclick = () => {
      if (onBack) onBack();
    };
    inputEl.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') handleConfirm();
    });
    setTimeout(() => inputEl.focus(), 20);
  };

  // Step 1A: Options menu when right-clicking empty canvas space
  const openCanvasOptionsMenu = (data) => {
    const win = getModal('Array - Options');
    if (!win) return;

    win.setContent(`
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        <button type="button" id="arr-opt-add" class="vscode-btn-secondary" style="width: 100%;">Add element</button>
      </div>
    `);
    win.open();

    win.body.querySelector('#arr-opt-add').onclick = () => {
      // Step 2: Settings window for "Add element"
      openValueInputModal(
        'Array - Add Element',
        'Enter value (or space/comma separated values)',
        'Add',
        (raw) => {
          const newTokens = parseArrayInput(raw);
          data.push(...newTokens);
          syncArrayDataToContainer(containerEl, data);
        },
        () => openCanvasOptionsMenu(data)
      );
    };
  };

  // Step 1B: Options menu when right-clicking an existing array element
  const openElementOptionsMenu = (data, hitIdx) => {
    const targetItem = data[hitIdx];
    const win = getModal(`Element [${hitIdx}] (${targetItem.value}) - Options`);
    if (!win) return;

    win.setContent(`
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        <button type="button" id="arr-opt-left" class="vscode-btn-secondary" style="width: 100%;">Add to left</button>
        <button type="button" id="arr-opt-right" class="vscode-btn-secondary" style="width: 100%;">Add to right</button>
        <button type="button" id="arr-opt-del" class="vscode-btn-secondary" style="width: 100%; color: #f87777;">Delete element</button>
      </div>
    `);
    win.open();

    win.body.querySelector('#arr-opt-left').onclick = () => {
      // Step 2: Settings window for "Add to left"
      openValueInputModal(
        `Element [${hitIdx}] - Add to Left`,
        'Enter value (or space/comma separated values)',
        'Add to left',
        (raw) => {
          const newTokens = parseArrayInput(raw);
          data.splice(hitIdx, 0, ...newTokens);
          syncArrayDataToContainer(containerEl, data);
        },
        () => openElementOptionsMenu(data, hitIdx)
      );
    };

    win.body.querySelector('#arr-opt-right').onclick = () => {
      // Step 2: Settings window for "Add to right"
      openValueInputModal(
        `Element [${hitIdx}] - Add to Right`,
        'Enter value (or space/comma separated values)',
        'Add to right',
        (raw) => {
          const newTokens = parseArrayInput(raw);
          data.splice(hitIdx + 1, 0, ...newTokens);
          syncArrayDataToContainer(containerEl, data);
        },
        () => openElementOptionsMenu(data, hitIdx)
      );
    };

    win.body.querySelector('#arr-opt-del').onclick = () => {
      data.splice(hitIdx, 1);
      syncArrayDataToContainer(containerEl, data);
      win.close();
      requestRender();
    };
  };

  // 1. Right-Click Context Menu Listener
  canvas.addEventListener('contextmenu', (e) => {
    if (window.isSimulating) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    const worldPt = screenToWorld(e.clientX, e.clientY);
    const hitIdx = hitTestBar(worldPt.x, worldPt.y);
    const data = getContainerArrayData(containerEl);

    if (hitIdx === -1) {
      openCanvasOptionsMenu(data);
    } else {
      openElementOptionsMenu(data, hitIdx);
    }
  });

  // 2. Left-Click Drag on an Element -> Reorder Array
  canvas.addEventListener('pointerdown', (e) => {
    if (window.isSimulating) return;
    if (e.button !== 0 || e.shiftKey) return;
    const worldPt = screenToWorld(e.clientX, e.clientY);
    const hitIdx = hitTestBar(worldPt.x, worldPt.y);
    if (hitIdx === -1) return;

    // Stop camera double-click pan from hijacking bar dragging
    e.stopImmediatePropagation();
    try { canvas.setPointerCapture(e.pointerId); } catch { }

    containerEl._dragState = {
      pointerId: e.pointerId,
      index: hitIdx,
      worldX: worldPt.x,
    };
    canvas.style.cursor = 'grabbing';
    requestRender();
  }, { capture: true });

  canvas.addEventListener('pointermove', (e) => {
    const drag = containerEl._dragState;
    if (!drag || drag.pointerId !== e.pointerId) return;
    e.stopImmediatePropagation();

    const worldPt = screenToWorld(e.clientX, e.clientY);
    drag.worldX = worldPt.x;

    const data = getContainerArrayData(containerEl);
    const boxes = containerEl._barHitBoxes || [];
    if (boxes.length > 1) {
      // Find closest slot center to swap into
      let targetIdx = drag.index;
      for (let i = 0; i < boxes.length; i++) {
        const center = boxes[i].x + boxes[i].w / 2;
        if (i < drag.index && worldPt.x < center) {
          targetIdx = i;
          break;
        }
        if (i > drag.index && worldPt.x > center) {
          targetIdx = i;
        }
      }

      if (targetIdx !== drag.index) {
        const [moved] = data.splice(drag.index, 1);
        data.splice(targetIdx, 0, moved);
        drag.index = targetIdx;
        syncArrayDataToContainer(containerEl, data);
      }
    }

    requestRender();
  }, { capture: true });

  const endDrag = (e) => {
    const drag = containerEl._dragState;
    if (!drag || drag.pointerId !== e.pointerId) return;
    containerEl._dragState = null;
    canvas.style.cursor = '';
    requestRender();
  };

  canvas.addEventListener('pointerup', endDrag, { capture: true });
  canvas.addEventListener('pointercancel', endDrag, { capture: true });
}

export default drawArray;
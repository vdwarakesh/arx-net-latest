import * as d3Module from './d3.js';
const d3 = window.d3 || d3Module;

// ========== Hyperparameters ==========
export const ARRAY_HYPERPARAMETERS = {
  MIN_BAR_HEIGHT_RATIO: 0.10, // Least element is 10% of the canvas height
  MAX_BAR_HEIGHT_RATIO: 0.30, // Max element is 30% of the canvas height (spans from 60% up to 30% of screen)
  TOP_LIMIT_RATIO: 0.30,      // Top of the tallest bar sits at 30% from the top of the canvas
  BOTTOM_BASELINE_RATIO: 0.60,// Baseline of all bars sits at 60% from the top of the canvas
  HORIZONTAL_SPAN_RATIO: 0.70,// Array spans up to 70% of the canvas width
  MAX_BAR_WIDTH: 64,          // Maximum width of a single bar in world px
  MIN_BAR_WIDTH: 18,          // Minimum width of a single bar in world px
  BAR_PADDING: 0.25,          // Padding ratio between bars (for d3.scaleBand)
  CORNER_RADIUS: 4,           // Rounded top corners of each bar
  FONT_FAMILY: "'Adwaita Sans', -apple-system, BlinkMacSystemFont, sans-serif",
};

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

  // Strip leading and trailing brackets: [, ], (, ), {, }
  str = str.replace(/^[\[\(\{\s]+|[\]\)\}\s]+$/g, '').trim();
  if (!str) return [];

  // Match quoted strings OR tokens separated by commas, whitespace, or stray brackets
  const tokenRegex = /"([^"]*)"|'([^']*)'|([^,\s\[\]\(\)\{\}]+)/g;
  const items = [];
  let match;

  while ((match = tokenRegex.exec(str)) !== null) {
    const quoted = match[1] !== undefined ? match[1] : match[2];
    const unquoted = match[3];
    const rawToken = quoted !== undefined ? quoted : unquoted;

    if (quoted !== undefined) {
      // Explicitly quoted value is always kept as a string
      items.push({
        raw: rawToken,
        value: rawToken,
        isNumber: false,
      });
    } else {
      const num = Number(rawToken);
      if (rawToken !== '' && !Number.isNaN(num) && Number.isFinite(num)) {
        items.push({
          raw: rawToken,
          value: num,
          isNumber: true,
        });
      } else {
        items.push({
          raw: rawToken,
          value: rawToken,
          isNumber: false,
        });
      }
    }
  }

  // Compute numeric magnitudes so both numbers and strings can be scaled with D3
  const allNumbers = items.length > 0 && items.every((d) => d.isNumber);
  items.forEach((d, idx) => {
    if (allNumbers) {
      d.numericValue = d.value;
    } else if (d.isNumber) {
      d.numericValue = d.value;
    } else {
      // For strings, use string length or character code sum for relative bar height
      const strVal = String(d.value);
      d.numericValue = strVal.length + (strVal.charCodeAt(0) || 0) / 255;
    }
    d.index = idx;
  });

  return items;
}

/**
 * Draws the parsed array onto the canvas inside `containerEl` using D3 scales.
 * Works seamlessly with the standalone infinite grid camera (if present on containerObj).
 *
 * @param {HTMLElement} containerEl - The .ds-container-instance element
 * @param {Object} [camera] - Optional camera { x, y, z } for world-space pan/zoom rendering
 * @param {Object} [customHyperparams] - Optional overrides for ARRAY_HYPERPARAMETERS
 */
export function drawArray(containerEl, camera = null, customHyperparams = {}) {
  if (!containerEl) return;

  const hp = { ...ARRAY_HYPERPARAMETERS, ...customHyperparams };
  const canvas = containerEl.querySelector('canvas.ds-grid-canvas') || containerEl.querySelector('canvas');
  if (!canvas) return;

  const rawInput = containerEl.userInput ?? containerEl.getAttribute('userInput') ?? '';
  const data = parseArrayInput(rawInput);
  if (data.length === 0) return;

  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  if (w <= 0 || h <= 0) return;

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const ctx = canvas.getContext('2d');

  // Read theme colors from document CSS variables
  const rootStyle = getComputedStyle(document.documentElement);
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const barFill = rootStyle.getPropertyValue('--accent-primary').trim() || (isLight ? '#005fb8' : '#0078d4');
  const barBorder = rootStyle.getPropertyValue('--accent-hover').trim() || (isLight ? '#0258a8' : '#1084df');
  const textBright = rootStyle.getPropertyValue('--text-bright').trim() || (isLight ? '#1e1e1e' : '#ffffff');
  const textMuted = rootStyle.getPropertyValue('--text-muted').trim() || (isLight ? '#616161' : '#858585');

  // Determine the coordinate space:
  // When a camera is provided (with initial camera.x = w/2, camera.y = h/2),
  // world origin (0, 0) is at the initial center of the canvas.
  // So the initial screen rect in world coordinates spans [-w/2, w/2] and [-h/2, h/2].
  const cam = camera || containerEl._camera || { x: 0, y: 0, z: 1 };
  const useWorldOrigin = Boolean(camera || containerEl._camera);

  // Store initial viewport dimensions on containerEl so zooming doesn't distort world proportions
  if (!containerEl._baseViewport || containerEl._baseViewport.w === 0) {
    containerEl._baseViewport = { w, h };
  }
  const baseW = useWorldOrigin ? containerEl._baseViewport.w : w;
  const baseH = useWorldOrigin ? containerEl._baseViewport.h : h;

  // Vertical layout in the 30% - 60% band of the screen:
  // Baseline sits at 60% of screen height; tallest bar (30% height) reaches 30% of screen height;
  // smallest bar is 10% of screen height (reaches 50% of screen height).
  const minBarH = baseH * hp.MIN_BAR_HEIGHT_RATIO;
  const maxBarH = baseH * hp.MAX_BAR_HEIGHT_RATIO;
  const baselineY = useWorldOrigin
    ? (-baseH / 2) + (baseH * hp.BOTTOM_BASELINE_RATIO)
    : (baseH * hp.BOTTOM_BASELINE_RATIO);

  // D3 Linear Scale for bar heights (maps [minVal, maxVal] -> [10% height, 30% height])
  const [minVal, maxVal] = d3.extent(data, (d) => d.numericValue);
  const heightScale = d3.scaleLinear()
    .domain(minVal === maxVal ? [minVal - 1, maxVal + 1] : [minVal, maxVal])
    .range([minBarH, maxBarH]);

  // Horizontal layout centered on the canvas using D3 Band Scale
  const maxSpanW = baseW * hp.HORIZONTAL_SPAN_RATIO;
  const idealTotalW = Math.min(maxSpanW, data.length * (hp.MAX_BAR_WIDTH / (1 - hp.BAR_PADDING)));
  const totalW = Math.max(idealTotalW, data.length * hp.MIN_BAR_WIDTH);

  const startX = useWorldOrigin ? (-totalW / 2) : ((baseW - totalW) / 2);
  const endX = startX + totalW;

  const xScale = d3.scaleBand()
    .domain(d3.range(data.length))
    .range([startX, endX])
    .paddingInner(hp.BAR_PADDING)
    .paddingOuter(hp.BAR_PADDING / 2);

  const barWidth = xScale.bandwidth();

  ctx.save();
  if (useWorldOrigin) {
    // Apply camera transform so the array pans and zooms with the infinite grid
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

  // Draw each bar, value label, and index label
  data.forEach((d, i) => {
    const barH = minVal === maxVal ? maxBarH : heightScale(d.numericValue);
    const x = xScale(i);
    const y = baselineY - barH;
    const r = Math.min(hp.CORNER_RADIUS, barWidth / 2, barH / 2);

    // 1. Bar Fill & Stroke
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, barWidth, barH, [r, r, 2, 2]);
    } else {
      ctx.rect(x, y, barWidth, barH);
    }
    ctx.fillStyle = barFill;
    ctx.globalAlpha = 0.85;
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = barBorder;
    ctx.stroke();

    // 2. Value Label (above the bar)
    const fontSize = Math.max(10, Math.min(14, barWidth * 0.42));
    ctx.font = `600 ${fontSize}px ${hp.FONT_FAMILY}`;
    ctx.fillStyle = textBright;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(String(d.value), x + barWidth / 2, y - 6);

    // 3. Index Label (below the 60% baseline)
    const idxFontSize = Math.max(9, Math.min(12, barWidth * 0.36));
    ctx.font = `500 ${idxFontSize}px ${hp.FONT_FAMILY}`;
    ctx.fillStyle = textMuted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(i), x + barWidth / 2, baselineY + 8);
  });

  ctx.restore();
}

export default drawArray;
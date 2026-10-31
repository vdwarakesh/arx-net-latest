// data-structures/Graph.js

const textMeasurementContext = document.createElement('canvas').getContext('2d');

const NODE_MIN_WIDTH = 60;
const NODE_HEIGHT = 60;
const NODE_PADDING_X = 20;
const NODE_CORNER_RADIUS = 30;
const EDGE_HIT_BUFFER_WIDTH = 20;
const EDGE_STROKE_WIDTH = 4;
const NODE_FONT = 'bold 25px sans-serif';
const EDGE_LABEL_FONT = 'bold 18px sans-serif';

// ============================================================================
// 1. NODE SIZING & POSITIONING
// ============================================================================

function measureNodeLabelWidth(text, font = NODE_FONT) {
  textMeasurementContext.font = font;
  return textMeasurementContext.measureText(String(text)).width;
}

function calculateNodeWidth(nodeData) {
  const displayText = nodeData.label !== undefined ? nodeData.label : nodeData.id;
  return Math.max(NODE_MIN_WIDTH, measureNodeLabelWidth(displayText) + NODE_PADDING_X * 2);
}

// ============================================================================
// 2. EDGE GEOMETRY & ALIGNMENT (SELF-LOOPS, BIDIRECTIONAL ARCS, STRAIGHT LINES)
// ============================================================================

function calculateRectBorderIntersection(centerX, centerY, halfWidth, halfHeight, targetX, targetY, cornerRadius) {
  const deltaX = targetX - centerX;
  const deltaY = targetY - centerY;
  if (deltaX === 0 && deltaY === 0) return { x: centerX, y: centerY };

  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  const unitX = deltaX / distance;
  const unitY = deltaY / distance;

  const scaleX = deltaX !== 0 ? halfWidth / Math.abs(deltaX) : Infinity;
  const scaleY = deltaY !== 0 ? halfHeight / Math.abs(deltaY) : Infinity;

  // Cap at 1 so we never overshoot past the other node's center
  const borderScale = Math.min(scaleX, scaleY, 1);
  const flatIntersectionX = deltaX * borderScale;
  const flatIntersectionY = deltaY * borderScale;

  const clampedRadius = Math.min(cornerRadius || 0, halfWidth, halfHeight);
  if (clampedRadius <= 0) {
    return { x: centerX + flatIntersectionX, y: centerY + flatIntersectionY };
  }

  const innerHalfWidth = halfWidth - clampedRadius;
  const innerHalfHeight = halfHeight - clampedRadius;
  const hitVerticalEdge = scaleX <= scaleY;
  const isInCornerZone = hitVerticalEdge
    ? Math.abs(flatIntersectionY) > innerHalfHeight
    : Math.abs(flatIntersectionX) > innerHalfWidth;

  if (!isInCornerZone) {
    return { x: centerX + flatIntersectionX, y: centerY + flatIntersectionY };
  }

  const cornerCenterX = Math.sign(deltaX) * innerHalfWidth;
  const cornerCenterY = Math.sign(deltaY) * innerHalfHeight;
  const dotProduct = unitX * cornerCenterX + unitY * cornerCenterY;
  const distanceSquaredDiff = cornerCenterX * cornerCenterX + cornerCenterY * cornerCenterY - clampedRadius * clampedRadius;
  const rayDistance = Math.min(dotProduct + Math.sqrt(Math.max(dotProduct * dotProduct - distanceSquaredDiff, 0)), distance);

  return { x: centerX + unitX * rayDistance, y: centerY + unitY * rayDistance };
}

function calculateEdgePathAndLabelPosition(edgeData) {
  const BIDIRECTIONAL_OFFSET = -8;

  // Case 1: Self-loop edge
  if (edgeData.selfLoop) {
    const nodeX = edgeData.source.x;
    const nodeY = edgeData.source.y;
    const loopRadius = 50;
    const offsetX = 0;
    const offsetY = -35;

    const startX = nodeX + offsetX;
    const startY = nodeY + offsetY - loopRadius;

    return {
      svgPath: `M${startX},${startY} a${loopRadius},${loopRadius} 0 1,1 0,${2 * loopRadius} a${loopRadius},${loopRadius} 0 1,1 0,${-2 * loopRadius}`,
      labelX: nodeX + offsetX - 5,
      labelY: nodeY - 85,
      arrowX: startX,
      arrowY: startY,
      arrowAngle: 0,
      isSelfLoop: true,
      bounds: {
        minX: nodeX + offsetX - loopRadius,
        maxX: nodeX + offsetX + loopRadius,
        minY: nodeY + offsetY - loopRadius,
        maxY: nodeY + offsetY + loopRadius
      }
    };
  }

  // Case 2: Curved bidirectional edge
  if (edgeData.bidirectional) {
    const sourceHalfWidth = calculateNodeWidth(edgeData.source) / 2;
    const sourceHalfHeight = NODE_HEIGHT / 2;
    const targetHalfWidth = calculateNodeWidth(edgeData.target) / 2;
    const targetHalfHeight = NODE_HEIGHT / 2;

    const startPoint = calculateRectBorderIntersection(
      edgeData.source.x, edgeData.source.y, sourceHalfWidth, sourceHalfHeight,
      edgeData.target.x, edgeData.target.y, NODE_CORNER_RADIUS
    );
    const endPoint = calculateRectBorderIntersection(
      edgeData.target.x, edgeData.target.y, targetHalfWidth, targetHalfHeight,
      edgeData.source.x, edgeData.source.y, NODE_CORNER_RADIUS
    );

    const centerDeltaX = edgeData.target.x - edgeData.source.x;
    const centerDeltaY = edgeData.target.y - edgeData.source.y;
    const centerDistance = Math.sqrt(centerDeltaX * centerDeltaX + centerDeltaY * centerDeltaY) || 1;
    const arcRadius = centerDistance * 1.2;

    const perpendicularOffsetX = (-centerDeltaY / centerDistance) * BIDIRECTIONAL_OFFSET;
    const perpendicularOffsetY = (centerDeltaX / centerDistance) * BIDIRECTIONAL_OFFSET;
    startPoint.x += perpendicularOffsetX;
    startPoint.y += perpendicularOffsetY;
    endPoint.x += perpendicularOffsetX;
    endPoint.y += perpendicularOffsetY;

    const chordDeltaX = endPoint.x - startPoint.x;
    const chordDeltaY = endPoint.y - startPoint.y;
    const chordLength = Math.sqrt(chordDeltaX * chordDeltaX + chordDeltaY * chordDeltaY) || 1;
    const midPointX = (startPoint.x + endPoint.x) / 2;
    const midPointY = (startPoint.y + endPoint.y) / 2;
    const sagittaHeight = Math.sqrt(Math.max(arcRadius * arcRadius - (chordLength / 2) * (chordLength / 2), 0));

    // Compute exact circle center for sweep-flag=1 to orient the canvas arrowhead tangent
    const normalX = -chordDeltaY / chordLength;
    const normalY = chordDeltaX / chordLength;
    const circleCenterX = midPointX + normalX * sagittaHeight;
    const circleCenterY = midPointY + normalY * sagittaHeight;
    const radialX = endPoint.x - circleCenterX;
    const radialY = endPoint.y - circleCenterY;
    const arrowAngle = Math.atan2(radialX, -radialY);

    const labelX = midPointX + (arcRadius - sagittaHeight) * (chordDeltaY / chordLength);
    const labelY = midPointY - (arcRadius - sagittaHeight) * (chordDeltaX / chordLength);

    return {
      svgPath: `M${startPoint.x},${startPoint.y}A${arcRadius},${arcRadius} 0 0,1 ${endPoint.x},${endPoint.y}`,
      labelX,
      labelY,
      arrowX: endPoint.x,
      arrowY: endPoint.y,
      arrowAngle,
      isSelfLoop: false,
      bounds: {
        minX: Math.min(startPoint.x, endPoint.x, labelX),
        maxX: Math.max(startPoint.x, endPoint.x, labelX),
        minY: Math.min(startPoint.y, endPoint.y, labelY),
        maxY: Math.max(startPoint.y, endPoint.y, labelY)
      }
    };
  }

  // Case 3: Standard straight edge
  const targetHalfWidth = calculateNodeWidth(edgeData.target) / 2;
  const targetHalfHeight = NODE_HEIGHT / 2;
  const endPoint = calculateRectBorderIntersection(
    edgeData.target.x, edgeData.target.y, targetHalfWidth, targetHalfHeight,
    edgeData.source.x, edgeData.source.y, NODE_CORNER_RADIUS
  );

  const arrowAngle = Math.atan2(endPoint.y - edgeData.source.y, endPoint.x - edgeData.source.x);

  return {
    svgPath: `M${edgeData.source.x},${edgeData.source.y}L${endPoint.x},${endPoint.y}`,
    labelX: (edgeData.source.x + endPoint.x) / 2,
    labelY: (edgeData.source.y + endPoint.y) / 2,
    arrowX: endPoint.x,
    arrowY: endPoint.y,
    arrowAngle,
    isSelfLoop: false,
    bounds: {
      minX: Math.min(edgeData.source.x, endPoint.x),
      maxX: Math.max(edgeData.source.x, endPoint.x),
      minY: Math.min(edgeData.source.y, endPoint.y),
      maxY: Math.max(edgeData.source.y, endPoint.y)
    }
  };
}

// ============================================================================
// 3. CIRCULAR LAYOUT & CROSSING MINIMIZATION
// ============================================================================

export function applyCircularNodeLayout(nodes, canvasWidth, canvasHeight, edges = []) {
  if (!nodes || nodes.length === 0) return;

  const getNodeId = node => node.id !== undefined ? node.id : node.label || node.name;
  const getEndpointId = endpoint => typeof endpoint === 'object' ? getNodeId(endpoint) : endpoint;

  const circularSlotsByNodeIndex = computeCrossingMinimizedCircularOrder(nodes, edges, getNodeId, getEndpointId);
  const nodeCount = nodes.length;
  const MIN_NODE_GAP = 200;

  const totalCircumferenceNeeded = nodes.reduce((sum, node) => sum + calculateNodeWidth(node) + MIN_NODE_GAP, 0);
  const circleRadius = nodeCount === 1 ? 0 : Math.max(150, totalCircumferenceNeeded / (2 * Math.PI));
  const angleStep = (2 * Math.PI) / Math.max(1, nodeCount);

  nodes.forEach((node, index) => {
    const slotIndex = circularSlotsByNodeIndex[index];
    node.x = canvasWidth / 2 + circleRadius * Math.cos(slotIndex * angleStep);
    node.y = canvasHeight / 2 + circleRadius * Math.sin(slotIndex * angleStep);
  });
}

function computeCrossingMinimizedCircularOrder(nodes, edges, getNodeId, getEndpointId, maxIterations = 20000) {
  const nodeCount = nodes.length;
  if (nodeCount < 4 || edges.length === 0) return nodes.map((_, i) => i);

  const nodeIndexById = new Map(nodes.map((node, index) => [getNodeId(node), index]));
  const adjacencyList = Array.from({ length: nodeCount }, () => []);
  const uniqueEdgePairs = [];
  const seenEdgeKeys = new Set();

  edges.forEach(edge => {
    const sourceIdx = nodeIndexById.get(getEndpointId(edge.source));
    const targetIdx = nodeIndexById.get(getEndpointId(edge.target));
    if (sourceIdx === undefined || targetIdx === undefined || sourceIdx === targetIdx) return;

    const edgeKey = sourceIdx < targetIdx ? `${sourceIdx},${targetIdx}` : `${targetIdx},${sourceIdx}`;
    if (seenEdgeKeys.has(edgeKey)) return;

    seenEdgeKeys.add(edgeKey);
    uniqueEdgePairs.push([sourceIdx, targetIdx]);
    adjacencyList[sourceIdx].push(targetIdx);
    adjacencyList[targetIdx].push(sourceIdx);
  });

  // Initial ordering via BFS starting from highest-degree nodes
  const nodesSortedByDegree = [...Array(nodeCount).keys()].sort((a, b) => adjacencyList[b].length - adjacencyList[a].length);
  const visitedNodes = new Array(nodeCount).fill(false);
  const initialNodeOrder = [];

  for (const startNodeIdx of nodesSortedByDegree) {
    if (visitedNodes[startNodeIdx]) continue;
    const bfsQueue = [startNodeIdx];
    visitedNodes[startNodeIdx] = true;

    while (bfsQueue.length > 0) {
      const currentNodeIdx = bfsQueue.shift();
      initialNodeOrder.push(currentNodeIdx);
      for (const neighborIdx of adjacencyList[currentNodeIdx]) {
        if (!visitedNodes[neighborIdx]) {
          visitedNodes[neighborIdx] = true;
          bfsQueue.push(neighborIdx);
        }
      }
    }
  }

  const slotByNodeIndex = new Array(nodeCount);
  initialNodeOrder.forEach((nodeIndex, slot) => { slotByNodeIndex[nodeIndex] = slot; });

  const countChordCrossings = () => {
    let crossings = 0;
    for (let i = 0; i < uniqueEdgePairs.length; i++) {
      let [slotA, slotB] = [slotByNodeIndex[uniqueEdgePairs[i][0]], slotByNodeIndex[uniqueEdgePairs[i][1]]];
      if (slotA > slotB) [slotA, slotB] = [slotB, slotA];

      for (let j = i + 1; j < uniqueEdgePairs.length; j++) {
        let [slotC, slotD] = [slotByNodeIndex[uniqueEdgePairs[j][0]], slotByNodeIndex[uniqueEdgePairs[j][1]]];
        if (slotC > slotD) [slotC, slotD] = [slotD, slotC];

        if ((slotA < slotC && slotC < slotB && slotB < slotD) || (slotC < slotA && slotA < slotD && slotD < slotB)) {
          crossings++;
        }
      }
    }
    return crossings;
  };

  // Simulated annealing over pairwise slot swaps
  let currentCrossings = countChordCrossings();
  let minCrossings = currentCrossings;
  let bestSlotAssignment = slotByNodeIndex.slice();
  let temperature = 2.0;
  const coolingFactor = Math.pow(0.01 / 2.0, 1 / maxIterations);

  for (let iteration = 0; iteration < maxIterations && minCrossings > 0; iteration++) {
    const nodeIdxA = Math.floor(Math.random() * nodeCount);
    let nodeIdxB = Math.floor(Math.random() * (nodeCount - 1));
    if (nodeIdxB >= nodeIdxA) nodeIdxB++;

    [slotByNodeIndex[nodeIdxA], slotByNodeIndex[nodeIdxB]] = [slotByNodeIndex[nodeIdxB], slotByNodeIndex[nodeIdxA]];
    const candidateCrossings = countChordCrossings();
    const crossingDelta = candidateCrossings - currentCrossings;

    if (crossingDelta <= 0 || Math.random() < Math.exp(-crossingDelta / temperature)) {
      currentCrossings = candidateCrossings;
      if (currentCrossings < minCrossings) {
        minCrossings = currentCrossings;
        bestSlotAssignment = slotByNodeIndex.slice();
      }
    } else {
      // Revert swap
      [slotByNodeIndex[nodeIdxA], slotByNodeIndex[nodeIdxB]] = [slotByNodeIndex[nodeIdxB], slotByNodeIndex[nodeIdxA]];
    }
    temperature *= coolingFactor;
  }

  return bestSlotAssignment;
}

// ============================================================================
// 4. GRAPH DATA PARSING & STATE MANAGEMENT
// ============================================================================

function resolveGraphTypeFlags(dsType = '') {
  const lower = dsType.toLowerCase();
  const isDirected = lower.includes('directed') && !lower.includes('undirected');
  const isWeighted = lower.includes('weighted') && !lower.includes('unweighted');
  return { isDirected, isWeighted };
}

function refreshEdgeFlags(graphData) {
  const { nodes, edges, isDirected } = graphData;
  const nodeByIdMap = new Map(nodes.map(n => [String(n.id), n]));

  edges.forEach(edge => {
    const sId = typeof edge.source === 'object' ? String(edge.source.id) : String(edge.source);
    const tId = typeof edge.target === 'object' ? String(edge.target.id) : String(edge.target);
    edge.source = nodeByIdMap.get(sId) || edge.source;
    edge.target = nodeByIdMap.get(tId) || edge.target;
  });

  const edgeLookupSet = new Set(
    edges.map(e => `${typeof e.source === 'object' ? e.source.id : e.source}-${typeof e.target === 'object' ? e.target.id : e.target}`)
  );

  edges.forEach(edge => {
    const sId = typeof edge.source === 'object' ? edge.source.id : edge.source;
    const tId = typeof edge.target === 'object' ? edge.target.id : edge.target;
    edge.selfLoop = (sId === tId);
    edge.bidirectional = Boolean(isDirected && !edge.selfLoop && edgeLookupSet.has(`${tId}-${sId}`));
  });
}

function parseGraphInput(rawInput, dsType = 'Graph') {
  const { isDirected: typeDirected, isWeighted: typeWeighted } = resolveGraphTypeFlags(dsType);
  let isDirected = typeDirected;
  let isWeighted = typeWeighted;

  const text = (rawInput || '').trim();
  const nodesMap = new Map();
  const edges = [];

  const ensureNode = (idStr) => {
    const cleanId = String(idStr).trim();
    if (!cleanId) return null;
    if (!nodesMap.has(cleanId)) {
      nodesMap.set(cleanId, { id: cleanId, label: cleanId, x: 0, y: 0 });
    }
    return nodesMap.get(cleanId);
  };

  if (text) {
    // Supports JSON input or comma/semicolon/newline separated edge tokens:
    // e.g. "A-B, B-C:5, C->A" or "1 2, 2 3, 3 1" or single nodes "A, B, C"
    const tokens = text.split(/[,;\n]+/).map(t => t.trim()).filter(Boolean);
    for (const token of tokens) {
      const arrowMatch = token.match(/^(.+?)\s*(->|<->|--|-)\s*(.+?)(?:\s*[:=]\s*([+-]?\d+(?:\.\d+)?))?$/);
      if (arrowMatch) {
        const [, uRaw, op, vRaw, wRaw] = arrowMatch;
        if (op === '->' || op === '<->') isDirected = true;
        if (wRaw !== undefined) isWeighted = true;

        const uNode = ensureNode(uRaw);
        const vNode = ensureNode(vRaw);
        if (uNode && vNode) {
          const weight = wRaw !== undefined ? Number(wRaw) : 1;
          edges.push({ source: uNode, target: vNode, weight });
          if (op === '<->' && uNode.id !== vNode.id) {
            edges.push({ source: vNode, target: uNode, weight });
          }
        }
        continue;
      }

      const parts = token.split(/\s+/);
      if (parts.length >= 2) {
        const uNode = ensureNode(parts[0]);
        const vNode = ensureNode(parts[1]);
        const hasWeight = parts.length >= 3 && !Number.isNaN(Number(parts[2]));
        if (hasWeight) isWeighted = true;
        if (uNode && vNode) {
          edges.push({
            source: uNode,
            target: vNode,
            weight: hasWeight ? Number(parts[2]) : 1
          });
        }
      } else if (parts.length === 1) {
        ensureNode(parts[0]);
      }
    }
  }

  const nodes = Array.from(nodesMap.values());
  const graphData = { nodes, edges, isDirected, isWeighted };
  refreshEdgeFlags(graphData);
  return graphData;
}

export function getContainerGraphData(containerEl) {
  if (!containerEl) return { nodes: [], edges: [], isDirected: false, isWeighted: false };

  const rawInput = containerEl.getAttribute('userInput') || containerEl.userInput || '';
  const dsType = containerEl.dataset.dsType || 'Graph';

  if (!containerEl._graphData || containerEl._lastParsedGraphInput !== rawInput) {
    const parsed = parseGraphInput(rawInput, dsType);
    const canvas = containerEl.querySelector('canvas');
    const w = (canvas && canvas.clientWidth) ? canvas.clientWidth : 800;
    const h = (canvas && canvas.clientHeight) ? canvas.clientHeight : 600;

    applyCircularNodeLayout(parsed.nodes, w, h, parsed.edges);
    containerEl._graphData = parsed;
    containerEl._lastParsedGraphInput = rawInput;
  }

  return containerEl._graphData;
}

export function syncGraphDataToContainer(containerEl, graphData) {
  if (!containerEl || !graphData) return;
  refreshEdgeFlags(graphData);

  const connectedNodeIds = new Set();
  const edgeTokens = graphData.edges.map(e => {
    const u = typeof e.source === 'object' ? e.source.id : e.source;
    const v = typeof e.target === 'object' ? e.target.id : e.target;
    connectedNodeIds.add(String(u));
    connectedNodeIds.add(String(v));
    const op = graphData.isDirected ? '->' : '-';
    const wSuffix = (graphData.isWeighted && e.weight !== undefined) ? `:${e.weight}` : '';
    return `${u}${op}${v}${wSuffix}`;
  });

  const isolatedTokens = graphData.nodes
    .filter(n => !connectedNodeIds.has(String(n.id)))
    .map(n => String(n.id));

  const serialized = [...edgeTokens, ...isolatedTokens].join(', ');
  containerEl._graphData = graphData;
  containerEl._lastParsedGraphInput = serialized;
  containerEl.userInput = serialized;
  containerEl.setAttribute('userInput', serialized);

  if (typeof window.updateDsHeaderWarningState === 'function') {
    window.updateDsHeaderWarningState();
  }
  if (typeof window.updateMetadataUI === 'function') {
    window.updateMetadataUI();
  }
}

// ============================================================================
// 5. CORE CANVAS GRAPH RENDERING PIPELINE
// ============================================================================

function resolveThemeColors() {
  const rootStyles = getComputedStyle(document.documentElement);
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  return {
    nodeFill: rootStyles.getPropertyValue('--ds-bar-fill').trim() || '#42baff',
    nodeStroke: rootStyles.getPropertyValue('--ds-bar-stroke').trim() || '#1e1e1e',
    nodeDragFill: '#ff9800',
    nodeCurrentFill: rootStyles.getPropertyValue('--ds-current-fill').trim() || '#f59e0b',
    nodeFoundFill: rootStyles.getPropertyValue('--ds-found-fill').trim() || '#12a67c',
    edgeStroke: isLight ? '#334155' : '#ffffff',
    edgeHoverStroke: '#ff5252',
    nodeTextColor: isLight ? '#0f172a' : '#ffffff',
    weightBgColor: rootStyles.getPropertyValue('--bg-elevated').trim() || (isLight ? '#f8fafc' : '#1e293b')
  };
}

function drawDirectedArrowhead(ctx, x, y, angle, isSelfLoop, color) {
  // Matches SVG marker viewBox="0 -5 10 10", path="M0,-5 L10,0 L0,5", markerWidth=5, strokeWidth=4 (scale = 2)
  const scale = 2;
  const refX = isSelfLoop ? 4 : 9;
  const refY = isSelfLoop ? -0.5 : 0;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.translate(-refX, -refY);

  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.lineTo(10, 0);
  ctx.lineTo(0, 5);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

export function drawGraph(containerEl, camera = { x: 0, y: 0, z: 1 }) {
  if (!containerEl) return;
  const canvas = containerEl.querySelector('canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const graphData = getContainerGraphData(containerEl);
  const { nodes, edges, isDirected, isWeighted } = graphData;

  refreshEdgeFlags(graphData);

  const colors = resolveThemeColors();
  const hoveredEdge = containerEl._hoveredEdge || null;
  const draggedNode = containerEl._dragState ? containerEl._dragState.node : null;
  const simStep = containerEl._simStep || null;

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.scale(camera.z, camera.z);
  ctx.translate(camera.x, camera.y);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const expandBounds = (x1, y1, x2, y2) => {
    if (x1 < minX) minX = x1;
    if (y1 < minY) minY = y1;
    if (x2 > maxX) maxX = x2;
    if (y2 > maxY) maxY = y2;
  };

  // 1. Render visible edges & cache Path2D objects for 20px hit-buffer detection
  const renderedEdges = [];
  for (const edge of edges) {
    if (!edge.source || !edge.target) continue;
    const geom = calculateEdgePathAndLabelPosition(edge);
    const path2D = new Path2D(geom.svgPath);
    edge._path2D = path2D;
    edge._geom = geom;

    const isHovered = (hoveredEdge === edge);
    const strokeColor = isHovered ? colors.edgeHoverStroke : colors.edgeStroke;

    ctx.save();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = EDGE_STROKE_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(path2D);
    ctx.restore();

    if (isDirected) {
      drawDirectedArrowhead(ctx, geom.arrowX, geom.arrowY, geom.arrowAngle, geom.isSelfLoop, strokeColor);
    }

    if (geom.bounds) {
      expandBounds(geom.bounds.minX - 25, geom.bounds.minY - 25, geom.bounds.maxX + 25, geom.bounds.maxY + 25);
    }
    renderedEdges.push({ edge, geom, isHovered });
  }

  // 2. Render nodes (rounded rectangles) and node labels
  const nodeHitBoxes = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const w = calculateNodeWidth(node);
    const h = NODE_HEIGHT;
    const x = node.x - w / 2;
    const y = node.y - h / 2;
    node._width = w;
    node._height = h;

    let fillColor = colors.nodeFill;
    if (draggedNode === node) {
      fillColor = colors.nodeDragFill;
    } else if (simStep) {
      const nodeIdStr = String(node.id);
      if (String(simStep.foundNodeId) === nodeIdStr || simStep.foundIndex === i) {
        fillColor = colors.nodeFoundFill;
      } else if (String(simStep.activeNodeId) === nodeIdStr || simStep.activeIndex === i) {
        fillColor = colors.nodeCurrentFill;
      }
    }

    ctx.save();
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, NODE_CORNER_RADIUS);
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = colors.nodeStroke;
    ctx.stroke();

    // Node Label
    const displayText = String(node.label !== undefined ? node.label : node.id);
    ctx.font = NODE_FONT;
    ctx.fillStyle = colors.nodeTextColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayText, node.x, node.y);
    ctx.restore();

    nodeHitBoxes.push({ index: i, node, x, y, w, h });
    expandBounds(x - 20, y - 20, x + w + 20, y + h + 20);
  }

  // 3. Render edge weight labels on top
  if (isWeighted) {
    for (const { edge, geom, isHovered } of renderedEdges) {
      if (edge.weight === undefined || edge.weight === null) continue;
      const weightText = String(edge.weight);

      ctx.save();
      ctx.font = EDGE_LABEL_FONT;
      const textWidth = ctx.measureText(weightText).width;
      const padX = 7;
      const pillW = textWidth + padX * 2;
      const pillH = 26;

      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(geom.labelX - pillW / 2, geom.labelY - pillH / 2, pillW, pillH, 6);
      } else {
        ctx.rect(geom.labelX - pillW / 2, geom.labelY - pillH / 2, pillW, pillH);
      }
      ctx.fillStyle = colors.weightBgColor;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = isHovered ? colors.edgeHoverStroke : colors.edgeStroke;
      ctx.stroke();

      ctx.fillStyle = isHovered ? colors.edgeHoverStroke : colors.nodeTextColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(weightText, geom.labelX, geom.labelY);
      ctx.restore();
    }
  }

  ctx.restore();

  containerEl._nodeHitBoxes = nodeHitBoxes;
  if (minX !== Infinity) {
    containerEl._structureBounds = { minX, minY, maxX, maxY };
  } else {
    containerEl._structureBounds = null;
  }
}

// ============================================================================
// 6. CANVAS INTERACTION HANDLERS (NODE DRAGGING & 20PX EDGE HOVER BUFFER)
// ============================================================================

export function setupGraphInteractions(containerEl, requestRender) {
  if (!containerEl) return;
  const canvas = containerEl.querySelector('canvas');
  if (!canvas) return;

  const hitTestCtx = document.createElement('canvas').getContext('2d');

  const screenToWorld = (clientX, clientY) => {
    const rect = canvas.getBoundingClientRect();
    const cam = containerEl._camera || { x: 0, y: 0, z: 1 };
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return {
      x: sx / cam.z - cam.x,
      y: sy / cam.z - cam.y
    };
  };

  const hitTestNode = (wx, wy) => {
    const boxes = containerEl._nodeHitBoxes || [];
    for (let i = boxes.length - 1; i >= 0; i--) {
      const b = boxes[i];
      const dx = Math.abs(wx - b.node.x);
      const dy = Math.abs(wy - b.node.y);
      const halfW = b.w / 2;
      const halfH = b.h / 2;

      if (dx > halfW || dy > halfH) continue;

      const r = Math.min(NODE_CORNER_RADIUS, halfW, halfH);
      const innerW = halfW - r;
      const innerH = halfH - r;
      if (dx <= innerW || dy <= innerH) return b.node;

      const cornerDx = dx - innerW;
      const cornerDy = dy - innerH;
      if (cornerDx * cornerDx + cornerDy * cornerDy <= r * r) {
        return b.node;
      }
    }
    return null;
  };

  const hitTestEdge = (wx, wy) => {
    const graphData = getContainerGraphData(containerEl);
    const edges = graphData.edges || [];
    hitTestCtx.save();
    hitTestCtx.setTransform(1, 0, 0, 1, 0, 0);
    hitTestCtx.lineWidth = EDGE_HIT_BUFFER_WIDTH;
    hitTestCtx.lineCap = 'round';
    hitTestCtx.lineJoin = 'round';

    for (let i = edges.length - 1; i >= 0; i--) {
      const edge = edges[i];
      if (edge._path2D && hitTestCtx.isPointInStroke(edge._path2D, wx, wy)) {
        hitTestCtx.restore();
        return edge;
      }
    }
    hitTestCtx.restore();
    return null;
  };

  // 1. Node Dragging (Left-Click) - Disabled during active simulation so camera pan/zoom still works
  canvas.addEventListener('pointerdown', (e) => {
    if (window.isSimulating) return;
    if (e.button !== 0 || e.shiftKey) return;

    const worldPt = screenToWorld(e.clientX, e.clientY);
    const hitNode = hitTestNode(worldPt.x, worldPt.y);
    if (!hitNode) return;

    e.stopImmediatePropagation();
    try { canvas.setPointerCapture(e.pointerId); } catch {}

    containerEl._dragState = {
      pointerId: e.pointerId,
      node: hitNode,
      offsetX: hitNode.x - worldPt.x,
      offsetY: hitNode.y - worldPt.y
    };
    containerEl._hoveredEdge = null;
    canvas.style.cursor = 'grabbing';
    requestRender();
  }, { capture: true });

  // 2. Drag Move + Hover Highlighting on Nodes & Edges
  canvas.addEventListener('pointermove', (e) => {
    const worldPt = screenToWorld(e.clientX, e.clientY);
    const dragState = containerEl._dragState;

    if (dragState && dragState.pointerId === e.pointerId) {
      e.stopImmediatePropagation();
      dragState.node.x = worldPt.x + dragState.offsetX;
      dragState.node.y = worldPt.y + dragState.offsetY;
      canvas.style.cursor = 'grabbing';
      requestRender();
      return;
    }

    if (window.isSimulating) return;

    const hitNode = hitTestNode(worldPt.x, worldPt.y);
    if (hitNode) {
      if (containerEl._hoveredEdge) {
        containerEl._hoveredEdge = null;
        requestRender();
      }
      canvas.style.cursor = 'grab';
      return;
    }

    const hitEdge = hitTestEdge(worldPt.x, worldPt.y);
    if (hitEdge !== containerEl._hoveredEdge) {
      containerEl._hoveredEdge = hitEdge;
      requestRender();
    }
    canvas.style.cursor = hitEdge ? 'pointer' : '';
  }, { capture: true });

  const endNodeDrag = (e) => {
    const dragState = containerEl._dragState;
    if (!dragState || dragState.pointerId !== e.pointerId) return;
    e.stopImmediatePropagation();
    try { canvas.releasePointerCapture(e.pointerId); } catch {}
    containerEl._dragState = null;
    canvas.style.cursor = 'grab';
    requestRender();
  };

  canvas.addEventListener('pointerup', endNodeDrag, { capture: true });
  canvas.addEventListener('pointercancel', endNodeDrag, { capture: true });

  canvas.addEventListener('pointerleave', () => {
    if (containerEl._hoveredEdge) {
      containerEl._hoveredEdge = null;
      requestRender();
    }
  });

  // 3. Context Menu Hook (Ready for your custom Graph options menus)
  canvas.addEventListener('contextmenu', (e) => {
    if (window.isSimulating) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof window.showSimulationRunningWarning === 'function') {
        window.showSimulationRunningWarning();
      }
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    const worldPt = screenToWorld(e.clientX, e.clientY);
    const hitNode = hitTestNode(worldPt.x, worldPt.y);
    const hitEdge = hitNode ? null : hitTestEdge(worldPt.x, worldPt.y);

    // Expose hit targets for the upcoming context menu implementation
    containerEl._lastContextHit = { hitNode, hitEdge, worldPt };
  });
}

// Standardized Dynamic Module Exports
export {
  drawGraph as draw,
  setupGraphInteractions as setupInteractions,
  getContainerGraphData as getData
};
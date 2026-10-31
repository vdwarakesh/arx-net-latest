// data-structures/Tree.js

const textMeasurementContext = document.createElement('canvas').getContext('2d');

const NODE_MIN_WIDTH = 60;
const NODE_HEIGHT = 60;
const NODE_PADDING_X = 20;
const NODE_CORNER_RADIUS = 30;
const EDGE_HIT_BUFFER_WIDTH = 20;
const EDGE_STROKE_WIDTH = 4;
const NODE_FONT = 'bold 25px sans-serif';

// Logical layout multipliers (converted from structural slots/depths during layout)
const HORIZONTAL_SLOT_SPACING = 55;
const VERTICAL_DEPTH_SPACING = 130;
const SINGLE_CHILD_BINARY_OFFSET = 0.65;

// ============================================================================
// 1. NODE SIZING & BORDER INTERSECTION GEOMETRY
// ============================================================================

function measureNodeLabelWidth(text, font = NODE_FONT) {
  textMeasurementContext.font = font;
  return textMeasurementContext.measureText(String(text)).width;
}

function calculateNodeWidth(nodeData) {
  const displayText = nodeData.label !== undefined ? nodeData.label : nodeData.value;
  return Math.max(NODE_MIN_WIDTH, measureNodeLabelWidth(displayText) + NODE_PADDING_X * 2);
}

function calculateRectBorderIntersection(centerX, centerY, halfWidth, halfHeight, targetX, targetY, cornerRadius) {
  const deltaX = targetX - centerX;
  const deltaY = targetY - centerY;
  if (deltaX === 0 && deltaY === 0) return { x: centerX, y: centerY };

  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  const unitX = deltaX / distance;
  const unitY = deltaY / distance;

  const scaleX = deltaX !== 0 ? halfWidth / Math.abs(deltaX) : Infinity;
  const scaleY = deltaY !== 0 ? halfHeight / Math.abs(deltaY) : Infinity;

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

function calculateTreeEdgeGeometry(edgeData) {
  const sourceNode = edgeData.source;
  const targetNode = edgeData.target;

  const sourceHalfWidth = calculateNodeWidth(sourceNode) / 2;
  const sourceHalfHeight = NODE_HEIGHT / 2;
  const targetHalfWidth = calculateNodeWidth(targetNode) / 2;
  const targetHalfHeight = NODE_HEIGHT / 2;

  const startPoint = calculateRectBorderIntersection(
    sourceNode.x, sourceNode.y, sourceHalfWidth, sourceHalfHeight,
    targetNode.x, targetNode.y, NODE_CORNER_RADIUS
  );

  const endPoint = calculateRectBorderIntersection(
    targetNode.x, targetNode.y, targetHalfWidth, targetHalfHeight,
    sourceNode.x, sourceNode.y, NODE_CORNER_RADIUS
  );

  const svgPath = `M${startPoint.x},${startPoint.y}L${endPoint.x},${endPoint.y}`;

  return {
    svgPath,
    startPoint,
    endPoint,
    bounds: {
      minX: Math.min(startPoint.x, endPoint.x),
      maxX: Math.max(startPoint.x, endPoint.x),
      minY: Math.min(startPoint.y, endPoint.y),
      maxY: Math.max(startPoint.y, endPoint.y)
    }
  };
}

// ============================================================================
// 2. ATTRIBUTE-DRIVEN HIERARCHICAL TREE LAYOUT
// ============================================================================

export function applyHierarchicalTreeLayout(treeData, canvasWidth = 800, canvasHeight = 600) {
  const { nodes, root, isBinary } = treeData;
  if (!nodes || nodes.length === 0) return;

  // Determine roots (supports single root or forest of disconnected subtrees)
  const roots = [];
  if (root) roots.push(root);
  for (const n of nodes) {
    if (!n.parent && !roots.includes(n)) {
      roots.push(n);
    }
  }
  if (roots.length === 0 && nodes.length > 0) {
    roots.push(nodes[0]);
  }

  // Pass 1: Compute logical subtree span (in abstract slot units) based on node attributes
  const visitedPass1 = new Set();
  const computeSubtreeSpan = (node, depth = 0) => {
    if (!node || visitedPass1.has(node.id)) return 0;
    visitedPass1.add(node.id);

    node.depth = depth;
    const nodeBaseSpan = Math.max(1.2, calculateNodeWidth(node) / HORIZONTAL_SLOT_SPACING);

    if (isBinary) {
      const leftSpan = node.left ? computeSubtreeSpan(node.left, depth + 1) : 0;
      const rightSpan = node.right ? computeSubtreeSpan(node.right, depth + 1) : 0;

      if (node.left && node.right) {
        node._subtreeSpan = Math.max(nodeBaseSpan, leftSpan + rightSpan + 0.8);
      } else if (node.left || node.right) {
        const childSpan = leftSpan || rightSpan;
        node._subtreeSpan = Math.max(nodeBaseSpan, childSpan + SINGLE_CHILD_BINARY_OFFSET);
      } else {
        node._subtreeSpan = nodeBaseSpan;
      }
      return node._subtreeSpan;
    }

    // N-ary tree span calculation via node.children
    const children = (node.children || []).filter(Boolean);
    if (children.length === 0) {
      node._subtreeSpan = nodeBaseSpan;
      return node._subtreeSpan;
    }

    let childrenTotalSpan = 0;
    children.forEach((child, idx) => {
      childrenTotalSpan += computeSubtreeSpan(child, depth + 1);
      if (idx > 0) childrenTotalSpan += 0.6;
    });

    node._subtreeSpan = Math.max(nodeBaseSpan, childrenTotalSpan);
    return node._subtreeSpan;
  };

  let totalForestSpan = 0;
  roots.forEach((r, idx) => {
    totalForestSpan += computeSubtreeSpan(r, 0);
    if (idx > 0) totalForestSpan += 1.5;
  });

  // Pass 2: Assign logical horizontal `slot` attribute from parent attributes (left / right / children)
  const visitedPass2 = new Set();
  const assignLogicalSlots = (node, centerSlot) => {
    if (!node || visitedPass2.has(node.id)) return;
    visitedPass2.add(node.id);

    node.slot = centerSlot;

    if (isBinary) {
      const leftChild = node.left;
      const rightChild = node.right;

      if (leftChild && rightChild) {
        const totalChildrenSpan = leftChild._subtreeSpan + rightChild._subtreeSpan + 0.8;
        const leftEdge = centerSlot - totalChildrenSpan / 2;
        assignLogicalSlots(leftChild, leftEdge + leftChild._subtreeSpan / 2);
        assignLogicalSlots(rightChild, leftEdge + leftChild._subtreeSpan + 0.8 + rightChild._subtreeSpan / 2);
      } else if (leftChild && !rightChild) {
        // Strictly place single left child to the left of its parent
        const offset = Math.max(SINGLE_CHILD_BINARY_OFFSET, leftChild._subtreeSpan / 2);
        assignLogicalSlots(leftChild, centerSlot - offset);
      } else if (!leftChild && rightChild) {
        // Strictly place single right child to the right of its parent
        const offset = Math.max(SINGLE_CHILD_BINARY_OFFSET, rightChild._subtreeSpan / 2);
        assignLogicalSlots(rightChild, centerSlot + offset);
      }
      return;
    }

    // N-ary children slot assignment
    const children = (node.children || []).filter(Boolean);
    if (children.length === 0) return;

    const totalChildrenSpan = children.reduce((acc, c) => acc + c._subtreeSpan, 0) + 0.6 * (children.length - 1);
    let cursorSlot = centerSlot - totalChildrenSpan / 2;

    for (const child of children) {
      const childCenter = cursorSlot + child._subtreeSpan / 2;
      assignLogicalSlots(child, childCenter);
      cursorSlot += child._subtreeSpan + 0.6;
    }
  };

  let rootCursor = -totalForestSpan / 2;
  for (const r of roots) {
    const rCenter = rootCursor + r._subtreeSpan / 2;
    assignLogicalSlots(r, rCenter);
    rootCursor += r._subtreeSpan + 1.5;
  }

  // Pass 3: Project logical (slot, depth) attributes into centered world coordinates
  let maxDepth = 0;
  for (const node of nodes) {
    if ((node.depth || 0) > maxDepth) maxDepth = node.depth || 0;
  }

  const totalTreeHeight = maxDepth * VERTICAL_DEPTH_SPACING;
  const originX = canvasWidth / 2;
  const originY = (canvasHeight - totalTreeHeight) / 2;

  for (const node of nodes) {
    node.x = originX + (node.slot || 0) * HORIZONTAL_SLOT_SPACING;
    node.y = originY + (node.depth || 0) * VERTICAL_DEPTH_SPACING;
  }
}

// ============================================================================
// 3. TREE DATA PARSING & STRUCTURAL SYNCHRONIZATION
// ============================================================================

function rebuildTreeEdgesFromAttributes(treeData) {
  const { nodes, isBinary } = treeData;
  const edges = [];

  for (const node of nodes) {
    if (isBinary) {
      if (node.left) {
        node.left.parent = node;
        node.left.branchRole = 'left';
        edges.push({ source: node, target: node.left, branchRole: 'left' });
      }
      if (node.right) {
        node.right.parent = node;
        node.right.branchRole = 'right';
        edges.push({ source: node, target: node.right, branchRole: 'right' });
      }
      // Keep children array synced for uniform traversal
      node.children = [node.left, node.right].filter(Boolean);
    } else {
      node.children = (node.children || []).filter(Boolean);
      for (const child of node.children) {
        child.parent = node;
        child.branchRole = 'child';
        edges.push({ source: node, target: child, branchRole: 'child' });
      }
    }
  }

  treeData.edges = edges;
  treeData.root = nodes.find(n => !n.parent) || nodes[0] || null;
}

function parseTreeInput(rawInput, dsType = 'Tree') {
  const lowerType = dsType.toLowerCase();
  const isNaryByType = lowerType.includes('n-ary') || lowerType.includes('trie') || lowerType.includes('general');
  let isBinary = !isNaryByType;

  const text = (rawInput || '').trim();
  if (!text) {
    return { nodes: [], edges: [], root: null, isBinary };
  }

  const hasExplicitLinks = text.includes('->') || text.includes('--');

  // Mode A: Explicit Parent->Child links (e.g. "1->2:L, 1->3:R" or "A->B, A->C, A->D")
  if (hasExplicitLinks) {
    const nodesMap = new Map();
    const ensureNode = (rawToken) => {
      const clean = String(rawToken).trim();
      if (!clean) return null;
      if (!nodesMap.has(clean)) {
        const num = Number(clean);
        nodesMap.set(clean, {
          id: clean,
          value: clean,
          label: clean,
          numericValue: Number.isFinite(num) ? num : clean.charCodeAt(0) || 0,
          left: null,
          right: null,
          children: [],
          parent: null,
          branchRole: null,
          depth: 0,
          slot: 0,
          x: 0,
          y: 0
        });
      }
      return nodesMap.get(clean);
    };

    const tokens = text.split(/[,;\n]+/).map(t => t.trim()).filter(Boolean);
    for (const token of tokens) {
      const match = token.match(/^(.+?)\s*(?:->|--)\s*(.+?)(?:\s*[:=]\s*([LlRr]))?$/);
      if (match) {
        const [, parentRaw, childRaw, sideRaw] = match;
        const pNode = ensureNode(parentRaw);
        const cNode = ensureNode(childRaw);
        if (!pNode || !cNode || pNode === cNode) continue;

        cNode.parent = pNode;
        const side = sideRaw ? sideRaw.toUpperCase() : null;

        if (side === 'L') {
          pNode.left = cNode;
          cNode.branchRole = 'left';
        } else if (side === 'R') {
          pNode.right = cNode;
          cNode.branchRole = 'right';
        } else {
          if (isBinary) {
            if (!pNode.left) {
              pNode.left = cNode;
              cNode.branchRole = 'left';
            } else if (!pNode.right) {
              pNode.right = cNode;
              cNode.branchRole = 'right';
            } else {
              // Automatically promote to N-ary if more than 2 children are attached
              isBinary = false;
              pNode.children = [pNode.left, pNode.right, cNode];
              pNode.left = null;
              pNode.right = null;
            }
          } else {
            pNode.children.push(cNode);
            cNode.branchRole = 'child';
          }
        }
      } else {
        ensureNode(token);
      }
    }

    const nodes = Array.from(nodesMap.values());
    const treeData = { nodes, edges: [], root: null, isBinary };
    rebuildTreeEdgesFromAttributes(treeData);
    return treeData;
  }

  // Mode B: Level-Order Array (LeetCode format: "1, 2, 3, null, 4, 5")
  const tokens = text.split(/[\s,;]+/).map(t => t.trim()).filter(Boolean);
  const isNullToken = (tok) => /^(null|none|nil|_|-)$/i.test(tok);

  const nodes = [];
  const createLevelNode = (rawVal, idx) => {
    const num = Number(rawVal);
    const node = {
      id: `node_${idx}`,
      value: rawVal,
      label: rawVal,
      numericValue: Number.isFinite(num) ? num : rawVal.charCodeAt(0) || 0,
      left: null,
      right: null,
      children: [],
      parent: null,
      branchRole: 'root',
      depth: 0,
      slot: 0,
      x: 0,
      y: 0
    };
    nodes.push(node);
    return node;
  };

  if (tokens.length === 0 || isNullToken(tokens[0])) {
    return { nodes: [], edges: [], root: null, isBinary: true };
  }

  const root = createLevelNode(tokens[0], 0);
  const queue = [root];
  let i = 1;

  while (queue.length > 0 && i < tokens.length) {
    const parentNode = queue.shift();

    // Left Child Attribute
    if (i < tokens.length) {
      const leftTok = tokens[i++];
      if (!isNullToken(leftTok)) {
        const leftNode = createLevelNode(leftTok, i - 1);
        leftNode.parent = parentNode;
        leftNode.branchRole = 'left';
        parentNode.left = leftNode;
        queue.push(leftNode);
      }
    }

    // Right Child Attribute
    if (i < tokens.length) {
      const rightTok = tokens[i++];
      if (!isNullToken(rightTok)) {
        const rightNode = createLevelNode(rightTok, i - 1);
        rightNode.parent = parentNode;
        rightNode.branchRole = 'right';
        parentNode.right = rightNode;
        queue.push(rightNode);
      }
    }
  }

  const treeData = { nodes, edges: [], root, isBinary: true };
  rebuildTreeEdgesFromAttributes(treeData);
  return treeData;
}

export function serializeTreeToLevelOrder(treeData) {
  if (!treeData || !treeData.root) return '';

  if (!treeData.isBinary) {
    return treeData.edges
      .map(e => `${e.source.value}->${e.target.value}`)
      .join(', ');
  }

  const result = [];
  const queue = [treeData.root];

  while (queue.length > 0) {
    const curr = queue.shift();
    if (!curr) {
      result.push('null');
    } else {
      result.push(String(curr.value));
      queue.push(curr.left || null);
      queue.push(curr.right || null);
    }
  }

  while (result.length > 0 && result[result.length - 1] === 'null') {
    result.pop();
  }

  return result.join(', ');
}

export function getContainerTreeData(containerEl) {
  if (!containerEl) return { nodes: [], edges: [], root: null, isBinary: true };

  const rawInput = containerEl.getAttribute('userInput') || containerEl.userInput || '';
  const dsType = containerEl.dataset.dsType || 'Tree';

  if (!containerEl._treeData || containerEl._lastParsedTreeInput !== rawInput) {
    const parsed = parseTreeInput(rawInput, dsType);
    const canvas = containerEl.querySelector('canvas');
    const w = (canvas && canvas.clientWidth) ? canvas.clientWidth : 800;
    const h = (canvas && canvas.clientHeight) ? canvas.clientHeight : 600;

    applyHierarchicalTreeLayout(parsed, w, h);
    containerEl._treeData = parsed;
    containerEl._lastParsedTreeInput = rawInput;
  }

  return containerEl._treeData;
}

export function syncTreeDataToContainer(containerEl, treeData, recomputeLayout = true) {
  if (!containerEl || !treeData) return;

  rebuildTreeEdgesFromAttributes(treeData);

  if (recomputeLayout) {
    const canvas = containerEl.querySelector('canvas');
    const w = (canvas && canvas.clientWidth) ? canvas.clientWidth : 800;
    const h = (canvas && canvas.clientHeight) ? canvas.clientHeight : 600;
    applyHierarchicalTreeLayout(treeData, w, h);
  }

  const serialized = serializeTreeToLevelOrder(treeData);
  containerEl._treeData = treeData;
  containerEl._lastParsedTreeInput = serialized;
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
// 4. CORE CANVAS TREE RENDERING PIPELINE
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
    nodeTextColor: isLight ? '#0f172a' : '#ffffff'
  };
}

export function drawTree(containerEl, camera = { x: 0, y: 0, z: 1 }) {
  if (!containerEl) return;
  const canvas = containerEl.querySelector('canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const treeData = getContainerTreeData(containerEl);
  const { nodes, edges } = treeData;

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

  // 1. Draw parent-child edges (clipped to rounded-rect borders)
  for (const edge of edges) {
    if (!edge.source || !edge.target) continue;
    const geom = calculateTreeEdgeGeometry(edge);
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

    if (geom.bounds) {
      expandBounds(geom.bounds.minX - 20, geom.bounds.minY - 20, geom.bounds.maxX + 20, geom.bounds.maxY + 20);
    }
  }

  // 2. Draw tree nodes and labels
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
      const nodeValStr = String(node.value);
      if (
        String(simStep.foundNodeId) === nodeIdStr ||
        String(simStep.foundValue) === nodeValStr ||
        simStep.foundIndex === i
      ) {
        fillColor = colors.nodeFoundFill;
      } else if (
        String(simStep.activeNodeId) === nodeIdStr ||
        String(simStep.activeValue) === nodeValStr ||
        simStep.activeIndex === i
      ) {
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

    // Node Value Label
    const displayText = String(node.label !== undefined ? node.label : node.value);
    ctx.font = NODE_FONT;
    ctx.fillStyle = colors.nodeTextColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayText, node.x, node.y);
    ctx.restore();

    nodeHitBoxes.push({ index: i, node, x, y, w, h });
    expandBounds(x - 20, y - 20, x + w + 20, y + h + 20);
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
// 5. CANVAS INTERACTION HANDLERS (NODE DRAGGING & 20PX EDGE HOVER BUFFER)
// ============================================================================

export function setupTreeInteractions(containerEl, requestRender) {
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
    const treeData = getContainerTreeData(containerEl);
    const edges = treeData.edges || [];
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

  // 1. Node Dragging (Left-Click) - Disabled during simulation so camera pan/zoom works
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

  // 3. Context Menu Hook (Exposes hitNode, hitEdge, and worldPt for upcoming menus)
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

    containerEl._lastContextHit = { hitNode, hitEdge, worldPt };
  });
}

// Standardized Dynamic Module Exports
export {
  drawTree as draw,
  setupTreeInteractions as setupInteractions,
  getContainerTreeData as getData
};
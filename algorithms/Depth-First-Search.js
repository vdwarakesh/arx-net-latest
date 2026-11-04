import { getContainerGraphData } from '../data-structures/Graph.js';
import { tracePythonAlgorithm } from '../js/pyodide-runner.js';

export async function depthFirstSearch(containerEl, rawKwargs = {}) {
  const graphData = getContainerGraphData(containerEl);
  const { nodes, edges, isDirected } = graphData;

  const adjList = {};
  const nodeLabels = {};

  nodes.forEach((n) => {
    const idStr = String(n.id);
    adjList[idStr] = [];
    nodeLabels[idStr] = String(n.label !== undefined ? n.label : n.id);
  });

  edges.forEach((e) => {
    const u = String(typeof e.source === 'object' ? e.source.id : e.source);
    const v = String(typeof e.target === 'object' ? e.target.id : e.target);
    if (adjList[u] && !adjList[u].includes(v)) {
      adjList[u].push(v);
    }
    if (!isDirected && u !== v && adjList[v] && !adjList[v].includes(u)) {
      adjList[v].push(u);
    }
  });

  const res = await fetch('algorithms/Depth-First-Search.py');
  const pythonCode = await res.text();

  const { steps: pyFrames, error } = await tracePythonAlgorithm({
    dsCategory: 'graph',
    pythonCode,
    funcName: 'depth_first_search',
    dsData: adjList,
    nodeLabels,
    rawKwargs,
  });

  const steps = [];
  const fullExplanationLines = [];

  pyFrames.forEach((frame, idx) => {
    const pyLine = frame.line;
    const sv = frame.stateVars || {};
    const vis = frame.visual;

    let stepDescription = `Line ${pyLine}`;
    if (frame.event === 'return') {
      stepDescription = `DFS complete! Traversal order: [${(sv.return || []).join(', ')}].`;
    } else if (pyLine === 2) {
      stepDescription = `Checking if graph is empty`;
    } else if (pyLine === 4) {
      stepDescription = `Checking if start_node was provided`;
    } else if (pyLine === 5) {
      stepDescription = `Defaulting start_node to first node in graph`;
    } else if (pyLine === 8) {
      stepDescription = `Initializing visited list`;
    } else if (pyLine === 9) {
      stepDescription = `Initializing stack with start_node: [${(sv.stack || []).join(', ')}]`;
    } else if (pyLine === 10) {
      stepDescription = `Initializing empty traversal order list`;
    } else if (pyLine === 11) {
      stepDescription = `Checking if stack has nodes remaining (stack: [${(sv.stack || []).join(', ')}])`;
    } else if (pyLine === 12) {
      stepDescription = `Popped node '${sv.node}' from top of stack`;
    } else if (pyLine === 13) {
      stepDescription = `Checking if node '${sv.node}' has been visited`;
    } else if (pyLine === 14) {
      stepDescription = `Marking node '${sv.node}' as visited`;
    } else if (pyLine === 15) {
      stepDescription = `Visiting node '${sv.node}' — order is now [${(sv.order || []).join(', ')}]`;
    } else if (pyLine === 16) {
      stepDescription = `Fetching neighbors of node '${sv.node}'`;
    } else if (pyLine === 17) {
      stepDescription = `Inspecting neighbor '${sv.neighbor}'`;
    } else if (pyLine === 18) {
      stepDescription = `Checking if neighbor '${sv.neighbor}' has been visited`;
    } else if (pyLine === 19) {
      stepDescription = `Pushing neighbor '${sv.neighbor}' onto stack`;
    } else if (pyLine === 20) {
      stepDescription = `Stack is empty. Returning DFS traversal order.`;
    }

    fullExplanationLines.push(`Step ${idx + 1}: ${stepDescription}`);

    steps.push({
      lines: { Python: { active: String(pyLine) } },
      activeLineKey: 'active',
      activeIndex: -1,
      foundIndex: -1,
      checkedIndices: [],
      activeNodeId: vis.activeNodeId,
      foundNodeId: null,
      visitedNodes: vis.visitedNodes,
      activeEdge: vis.activeEdge,
      visitedEdges: vis.visitedEdges,
      traversal: vis.traversal,
      stateVars: sv,
      stepDescription,
    });
  });

  if (error) {
    const errLine = error.line || (pyFrames.length ? pyFrames[pyFrames.length - 1].line : 1);
    const lastStep = steps[steps.length - 1];
    const errDesc = `${error.type}: ${error.message}`;

    fullExplanationLines.push(`Error (Line ${errLine}): ${errDesc}`);

    steps.push({
      lines: { Python: { active: String(errLine) } },
      activeLineKey: 'active',
      activeIndex: -1,
      foundIndex: -1,
      checkedIndices: [],
      activeNodeId: lastStep ? lastStep.activeNodeId : null,
      foundNodeId: null,
      visitedNodes: lastStep ? lastStep.visitedNodes : [],
      activeEdge: null,
      visitedEdges: lastStep ? lastStep.visitedEdges : [],
      traversal: lastStep ? lastStep.traversal : [],
      stateVars: { ...(lastStep ? lastStep.stateVars : {}), error: `${error.type}: ${error.message}` },
      stepDescription: errDesc,
      isError: true,
    });
  }

  return { steps, fullExplanationLines, error };
}
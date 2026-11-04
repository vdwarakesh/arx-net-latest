import { getContainerGraphData } from '../data-structures/Graph.js';
import { tracePythonAlgorithm } from '../js/pyodide-runner.js';

export async function dijkstrasAlgorithm(containerEl, rawKwargs = {}) {
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
    const w = e.weight ?? 1;
    if (adjList[u] && !adjList[u].some(([nb]) => nb === v)) {
      adjList[u].push([v, w]);
    }
    if (!isDirected && u !== v && adjList[v] && !adjList[v].some(([nb]) => nb === u)) {
      adjList[v].push([u, w]);
    }
  });

  const res = await fetch('algorithms/Dijkstras-Algorithm.py');
  const pythonCode = await res.text();

  const { steps: pyFrames, error } = await tracePythonAlgorithm({
    dsCategory: 'graph',
    pythonCode,
    funcName: 'dijkstras_algorithm',
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
      stepDescription = `Dijkstra's complete! Shortest distances computed.`;
    } else if (pyLine === 2) {
      stepDescription = `Checking if graph is empty`;
    } else if (pyLine === 4) {
      stepDescription = `Checking if start_node was provided`;
    } else if (pyLine === 5) {
      stepDescription = `Defaulting start_node to first node`;
    } else if (pyLine === 8) {
      stepDescription = `Initializing distances dictionary with infinity`;
    } else if (pyLine === 9) {
      stepDescription = `Setting distance to start_node to 0`;
    } else if (pyLine === 10) {
      stepDescription = `Initializing parent tracking dictionary`;
    } else if (pyLine === 11) {
      stepDescription = `Initializing priority queue pq with (0, start_node)`;
    } else if (pyLine === 12) {
      stepDescription = `Initializing visited set`;
    } else if (pyLine === 13) {
      stepDescription = `Checking if priority queue pq is non-empty`;
    } else if (pyLine === 14) {
      stepDescription = `Popped node '${sv.node}' with distance ${sv.current_distance} from priority queue`;
    } else if (pyLine === 15) {
      stepDescription = `Checking if node '${sv.node}' has already been visited`;
    } else if (pyLine === 17) {
      stepDescription = `Marking node '${sv.node}' as visited`;
    } else if (pyLine === 19) {
      stepDescription = `Inspecting neighbor '${sv.neighbor}' with edge weight ${sv.weight}`;
    } else if (pyLine === 20) {
      stepDescription = `Calculating new tentative distance: ${sv.distance}`;
    } else if (pyLine === 21) {
      stepDescription = `Comparing new distance ${sv.distance} with previous shortest distance`;
    } else if (pyLine === 22) {
      stepDescription = `Updating shorter distance for node '${sv.neighbor}' to ${sv.distance}`;
    } else if (pyLine === 23) {
      stepDescription = `Updating parent of '${sv.neighbor}' to '${sv.node}'`;
    } else if (pyLine === 24) {
      stepDescription = `Pushing updated distance and node onto priority queue`;
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
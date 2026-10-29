import { getContainerArrayData } from '../data-structures/Array.js';
import { tracePythonArrayAlgorithm } from '../js/pyodide-runner.js';

export async function linearSearch(containerEl, rawKwargs = {}) {
  const data = getContainerArrayData(containerEl);
  const arrValues = data.map((d) => d.value);

  const res = await fetch('algorithms/Linear-Search.py');
  const pythonCode = await res.text();

  const { steps: pyFrames, error } = await tracePythonArrayAlgorithm(
    pythonCode,
    'linear_search',
    arrValues,
    rawKwargs
  );

  const steps = [];
  const fullExplanationLines = [];

  pyFrames.forEach((frame, idx) => {
    const pyLine = frame.line;
    const sv = frame.stateVars || {};
    const vis = frame.visual;

    let stepDescription = `Line ${pyLine}`;
    if (frame.event === 'return') {
      stepDescription =
        vis.foundIndex >= 0
          ? `Target found at index ${vis.foundIndex}! Returning ${sv.return}.`
          : `Target not found in array. Returning ${sv.return}.`;
    } else if (pyLine === 2) {
      stepDescription = `Loop iteration: i = ${sv.i}`;
    } else if (pyLine === 3) {
      stepDescription = `Comparing arr[${sv.i}] (${sv[`arr[${sv.i}]`]}) with target`;
    } else if (pyLine === 4) {
      stepDescription = `Match found at index ${sv.i}! Preparing to return ${sv.i}.`;
    } else if (pyLine === 5) {
      stepDescription = `Loop finished without a match. Preparing to return -1.`;
    }

    fullExplanationLines.push(`Step ${idx + 1}: ${stepDescription}`);

    steps.push({
      lines: {
        Python: { active: String(pyLine) },
      },
      activeLineKey: 'active',
      activeIndex: vis.activeIndex,
      foundIndex: vis.foundIndex,
      checkedIndices: vis.checkedIndices,
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
      lines: {
        Python: { active: String(errLine) },
      },
      activeLineKey: 'active',
      activeIndex: lastStep ? lastStep.activeIndex : -1,
      foundIndex: -1,
      checkedIndices: lastStep ? lastStep.checkedIndices : [],
      traversal: lastStep ? lastStep.traversal : [],
      stateVars: {
        ...(lastStep ? lastStep.stateVars : {}),
        error: `${error.type}: ${error.message}`,
      },
      stepDescription: errDesc,
      isError: true,
    });
  }

  return { steps, fullExplanationLines, error };
}
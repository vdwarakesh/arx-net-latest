// dsa/Linear-Search.js
import { getContainerArrayData, parseSingleToken } from './Array.js';
import { tracePythonArrayAlgorithm } from '../js/pyodide-runner.js';

// Maps Python line numbers in dsa/Linear-Search.py to C++ and Java line numbers
const PY_LINE_TO_OTHER_LANGS = {
  1: { Python: '1', 'C++': '1', Java: '2' },
  2: { Python: '2', 'C++': '2', Java: '3' },
  3: { Python: '3', 'C++': '3', Java: '4' },
  4: { Python: '4', 'C++': '4', Java: '5' },
  5: { Python: '5', 'C++': '7', Java: '8' },
};

export async function generateLinearSearchSteps(containerEl, rawTarget, selectedLang = 'Python') {
  const data = getContainerArrayData(containerEl);
  const parsedTarget = parseSingleToken(rawTarget);
  const targetVal = parsedTarget.value;
  const arrValues = data.map((d) => d.value);

  // 1. Fetch the clean Python file displayed in the editor
  const res = await fetch('dsa/Linear-Search.py');
  const pythonCode = await res.text();

  // 2. Execute in Pyodide with VisualArray proxy
  const pyFrames = await tracePythonArrayAlgorithm(
    pythonCode,
    'linear_search',
    arrValues,
    targetVal
  );

  // 3. Map Python's emitted frames to the UI playback format
  const steps = [];
  const fullExplanationLines = [];

  pyFrames.forEach((frame, idx) => {
    const pyLine = frame.line;
    const sv = frame.stateVars || {};
    const vis = frame.visual;

    let stepDescription = `Line ${pyLine}`;
    if (frame.event === 'return') {
      stepDescription = vis.foundIndex >= 0
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
        Python: { active: PY_LINE_TO_OTHER_LANGS[pyLine]?.Python || String(pyLine) },
        'C++':  { active: PY_LINE_TO_OTHER_LANGS[pyLine]?.['C++'] || String(pyLine) },
        Java:   { active: PY_LINE_TO_OTHER_LANGS[pyLine]?.Java || String(pyLine) },
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

  return { steps, fullExplanationLines, selectedLang };
}
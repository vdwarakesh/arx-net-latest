// dsa/Linear-Search.js
import { getContainerArrayData, parseSingleToken } from './Array.js';
import { tracePythonExecution } from '../js/pyodide-runner.js';

// Maps Python line numbers from dsa/Linear-Search.py to C++ and Java equivalents
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

  // 1. Fetch the actual Python source file
  const res = await fetch('dsa/Linear-Search.py');
  const pythonCode = await res.text();

  // 2. Run it in Pyodide and get the real frame-by-frame trace
  const rawTrace = await tracePythonExecution(pythonCode, 'linear_search', arrValues, targetVal);

  // 3. Transform the raw Python frames into your UI's step format
  const steps = [];
  const fullExplanationLines = [];
  const visitedMap = new Map(); // index -> value
  const checkedSet = new Set();

  rawTrace.forEach((frame, idx) => {
    const pyLine = frame.line;
    const locals = frame.locals || {};
    const currentI = typeof locals.i === 'number' ? locals.i : -1;
    const isReturn = frame.event === 'return';

    // Track visited indices whenever `i` is in bounds
    if (currentI >= 0 && currentI < arrValues.length) {
      visitedMap.set(currentI, arrValues[currentI]);
      // Any index visited before currentI has been checked
      for (const prevIdx of visitedMap.keys()) {
        if (prevIdx !== currentI) checkedSet.add(prevIdx);
      }
    }

    let foundIndex = -1;
    if (isReturn && typeof frame.returnVal === 'number' && frame.returnVal >= 0) {
      foundIndex = frame.returnVal;
    }

    // Build clean state variables object directly from Python's locals!
    const stateVars = { ...locals };
    if (currentI >= 0 && currentI < arrValues.length) {
      stateVars[`arr[${currentI}]`] = arrValues[currentI];
    }
    if (isReturn) {
      stateVars['return'] = frame.returnVal;
    }

    // Build human-readable step description from the real state
    let desc = `Executing line ${pyLine}`;
    if (pyLine === 2) {
      desc = `Loop header: i = ${currentI >= 0 ? currentI : 'starting'}`;
    } else if (pyLine === 3 && currentI >= 0) {
      desc = `Checking if arr[${currentI}] (${arrValues[currentI]}) == target (${targetVal})`;
    } else if (isReturn) {
      desc = foundIndex >= 0
        ? `Target found! Python returned index ${foundIndex}.`
        : `Finished loop. Python returned ${frame.returnVal}.`;
    }

    fullExplanationLines.push(`Step ${idx + 1} (Line ${pyLine}): ${desc}`);

    steps.push({
      lines: {
        Python: { active: PY_LINE_TO_OTHER_LANGS[pyLine]?.Python || String(pyLine) },
        'C++':  { active: PY_LINE_TO_OTHER_LANGS[pyLine]?.['C++'] || String(pyLine) },
        Java:   { active: PY_LINE_TO_OTHER_LANGS[pyLine]?.Java || String(pyLine) },
      },
      activeLineKey: 'active',
      activeIndex: foundIndex >= 0 ? foundIndex : currentI,
      foundIndex,
      checkedIndices: [...checkedSet],
      traversal: Array.from(visitedMap.entries()).map(([index, value]) => ({ index, value })),
      stateVars,
      stepDescription: desc,
    });
  });

  return { steps, fullExplanationLines, selectedLang };
}
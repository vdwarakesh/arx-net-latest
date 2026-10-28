// dsa/Linear-Search.js
import { getContainerArrayData, parseSingleToken } from './Array.js';

// Line mappings for each step type across Python, C++, and Java
export const LINEAR_SEARCH_LINES = {
  Python: {
    init: '1',
    loop: '2',
    compare: '3',
    found: '4',
    notFound: '5',
  },
  'C++': {
    init: '1',
    loop: '2',
    compare: '3',
    found: '4',
    notFound: '7',
  },
  Java: {
    init: '2',
    loop: '3',
    compare: '4',
    found: '5',
    notFound: '8',
  },
};

/**
 * Generates the complete step-by-step execution trace for Linear Search.
 *
 * @param {HTMLElement} containerEl - Active Array .ds-container-instance
 * @param {string|number} rawTarget - Target value from the Settings parameter input
 * @param {string} selectedLang - 'Python' | 'C++' | 'Java'
 */
export function generateLinearSearchSteps(containerEl, rawTarget, selectedLang = 'Python') {
  const data = getContainerArrayData(containerEl);
  const parsedTarget = parseSingleToken(rawTarget);
  const targetVal = parsedTarget.value;
  const arrValues = data.map((d) => d.value);

  const steps = [];
  const fullExplanationLines = [];
  const visitedIndices = [];

  if (arrValues.length === 0) {
    fullExplanationLines.push('Array is empty. Target cannot be found (returns -1).');
    steps.push({
      lines: LINEAR_SEARCH_LINES,
      activeLineKey: 'notFound',
      activeIndex: -1,
      foundIndex: -1,
      checkedIndices: [],
      traversal: [],
      stateVars: {
        target: targetVal,
        'len(arr)': 0,
        return: -1,
      },
      stepDescription: 'Array is empty. Returning -1.',
    });
    return { steps, fullExplanationLines, selectedLang };
  }

  // Step 0: Function Entry
  fullExplanationLines.push(
    `Starting Linear Search for target = ${JSON.stringify(targetVal)} in [${arrValues.join(', ')}].`
  );
  steps.push({
    lines: LINEAR_SEARCH_LINES,
    activeLineKey: 'init',
    activeIndex: -1,
    foundIndex: -1,
    checkedIndices: [],
    traversal: [],
    stateVars: {
      target: targetVal,
      i: 'uninitialized',
      'len(arr)': arrValues.length,
    },
    stepDescription: `Initialize Linear Search with target = ${targetVal}.`,
  });

  let foundAt = -1;

  for (let i = 0; i < arrValues.length; i++) {
    const currentVal = arrValues[i];
    visitedIndices.push({ index: i, value: currentVal });

    // Step A: Loop header (for i in range / for int i = 0...)
    fullExplanationLines.push(`Iteration i = ${i}: Inspecting index ${i} (arr[${i}] = ${currentVal}).`);
    steps.push({
      lines: LINEAR_SEARCH_LINES,
      activeLineKey: 'loop',
      activeIndex: i,
      foundIndex: -1,
      checkedIndices: visitedIndices.slice(0, -1).map((v) => v.index),
      traversal: [...visitedIndices],
      stateVars: {
        target: targetVal,
        i,
        [`arr[${i}]`]: currentVal,
      },
      stepDescription: `Loop iteration i = ${i}: move pointer to index ${i}.`,
    });

    // Step B: Comparison (if arr[i] == target)
    const isMatch = String(currentVal) === String(targetVal);
    fullExplanationLines.push(
      `  Compare arr[${i}] (${currentVal}) == target (${targetVal}) -> ${isMatch ? 'True (Match!)' : 'False'}.`
    );
    steps.push({
      lines: LINEAR_SEARCH_LINES,
      activeLineKey: 'compare',
      activeIndex: i,
      foundIndex: -1,
      checkedIndices: visitedIndices.slice(0, -1).map((v) => v.index),
      traversal: [...visitedIndices],
      stateVars: {
        target: targetVal,
        i,
        [`arr[${i}]`]: currentVal,
        [`arr[${i}] == target`]: isMatch ? 'True' : 'False',
      },
      stepDescription: `Compare arr[${i}] (${currentVal}) with target (${targetVal}): ${isMatch ? 'Equal' : 'Not equal'}.`,
    });

    // Step C: Target Found (return i)
    if (isMatch) {
      foundAt = i;
      fullExplanationLines.push(`Target ${targetVal} found at index ${i}! Returning ${i}.`);
      steps.push({
        lines: LINEAR_SEARCH_LINES,
        activeLineKey: 'found',
        activeIndex: i,
        foundIndex: i,
        checkedIndices: visitedIndices.slice(0, -1).map((v) => v.index),
        traversal: [...visitedIndices],
        stateVars: {
          target: targetVal,
          i,
          [`arr[${i}]`]: currentVal,
          return: i,
        },
        stepDescription: `Target ${targetVal} found at index ${i}! Returning ${i}.`,
      });
      break;
    }
  }

  // Step D: Target Not Found (return -1)
  if (foundAt === -1) {
    fullExplanationLines.push(
      `Reached end of array without finding ${targetVal}. Returning -1.`
    );
    steps.push({
      lines: LINEAR_SEARCH_LINES,
      activeLineKey: 'notFound',
      activeIndex: -1,
      foundIndex: -1,
      checkedIndices: visitedIndices.map((v) => v.index),
      traversal: [...visitedIndices],
      stateVars: {
        target: targetVal,
        i: arrValues.length,
        return: -1,
      },
      stepDescription: `Target ${targetVal} not found in array. Returning -1.`,
    });
  }

  return { steps, fullExplanationLines, selectedLang };
}
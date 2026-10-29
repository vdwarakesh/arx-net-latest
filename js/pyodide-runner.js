// js/pyodide-runner.js

// Spawn the background worker immediately when this file is imported
const worker = new Worker('js/pyodide-worker.js');

let messageIdCounter = 0;
const pendingResolves = new Map();

// Listen for results coming back from the background thread
worker.onmessage = (event) => {
  const { id, result } = event.data;
  if (pendingResolves.has(id)) {
    pendingResolves.get(id)(result);
    pendingResolves.delete(id);
  }
};

export function warmUpPyodide() {
  // Tell the worker to cache the standard library modules
  worker.postMessage({ id: -1, type: 'warmup' });
}

/**
 * Sends the Python code to the Web Worker for execution.
 * Does not block the main UI thread.
 */
export function tracePythonArrayAlgorithm(
  pythonCode,
  funcName,
  arrValues,
  rawKwargs = {},
  maxSteps = 2500
) {
  return new Promise((resolve) => {
    const id = messageIdCounter++;
    pendingResolves.set(id, resolve);

    // If the user clicks "Run" before the worker finishes booting, queues the message and execute it when ready.
    worker.postMessage({
      id,
      type: 'run',
      pythonCode,
      funcName,
      arrValues,
      rawKwargs,
      maxSteps
    });
  });
}
// js/pyodide-worker.js

// 1. Load Pyodide from the CDN into the worker thread
importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js');

// 2. Start booting Pyodide immediately in the background
let pyodideReadyPromise = loadPyodide();

// 3. Fetch python script once so it's ready when needed
let tracerScriptPromise = fetch('../python/pyodide-worker.py').then(res => {
    if (!res.ok) {
        throw new Error(`Failed to load pyodide-worker.py (Status: ${res.status})`);
    }
    return res.text();
});

self.onmessage = async (event) => {
    const {
        id,
        type,
        dsCategory,
        pythonCode,
        funcName,
        dsData,
        nodeLabels,
        rawKwargs,
        simMode,
        userChoices,
        maxSteps,
    } = event.data;

    if (type === 'warmup') {
        try {
            const py = await pyodideReadyPromise;
            await py.runPythonAsync(`
import sys
import json
import inspect
import traceback
import ast
import math
import heapq
from collections import deque, OrderedDict
            `);
            self.postMessage({ id, status: 'ready' });
        } catch (err) {
            console.error('Worker warm-up failed:', err);
        }
        return;
    }

    if (type === 'run') {
        try {
            // Wait for Pyodide and the external Python script to finish loading
            const [py, tracerScript] = await Promise.all([
                pyodideReadyPromise, 
                tracerScriptPromise
            ]);

            py.globals.set('_user_code', pythonCode);
            py.globals.set('_func_name', funcName);
            py.globals.set('_ds_category', dsCategory || 'sequence');
            py.globals.set('_ds_payload_json', JSON.stringify(dsData ?? []));
            py.globals.set('_node_labels_json', JSON.stringify(nodeLabels || {}));
            py.globals.set('_raw_kwargs_json', JSON.stringify(rawKwargs || {}));
            py.globals.set('_sim_mode', simMode || 'auto');
            py.globals.set('_user_choices_json', JSON.stringify(userChoices || []));
            py.globals.set('_MAX_STEPS', maxSteps || 2500);

            // Execute the fetched python string
            const rawJson = await py.runPythonAsync(tracerScript);
            
            self.postMessage({ id, result: JSON.parse(rawJson) });
        } catch (fatalErr) {
            self.postMessage({
                id,
                result: {
                    steps: [],
                    error: {
                        type: 'RuntimeError',
                        message: fatalErr.message || String(fatalErr),
                        line: null,
                    },
                },
            });
        }
    }
};
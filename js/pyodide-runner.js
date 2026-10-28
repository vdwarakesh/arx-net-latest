// js/pyodide-runner.js
let pyodideInstance = null;
let pyodideReadyPromise = null;

/**
 * Lazily initializes Pyodide once and caches the instance.
 */
export async function getPyodide() {
  if (pyodideInstance) return pyodideInstance;
  if (!pyodideReadyPromise) {
    pyodideReadyPromise = window.loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/',
    }).then((py) => {
      pyodideInstance = py;
      return py;
    });
  }
  return pyodideReadyPromise;
}

/**
 * Executes a Python algorithm string with sys.settrace() and returns a step-by-step trace.
 *
 * @param {string} pythonCode - The raw Python code (e.g. from dsa/Linear-Search.py)
 * @param {string} funcName - Name of the Python function to call (e.g. 'linear_search')
 * @param {Array} arrValues - The array values from your canvas container
 * @param {*} targetVal - The target parameter from your Settings input
 */
export async function tracePythonExecution(pythonCode, funcName, arrValues, targetVal) {
  const py = await getPyodide();

  // Pass inputs safely into Python's global scope
  py.globals.set('_user_code', pythonCode);
  py.globals.set('_func_name', funcName);
  py.globals.set('_input_arr', py.toPy(arrValues));
  py.globals.set('_input_target', py.toPy(targetVal));

  // Python script that compiles the code, hooks sys.settrace, and serializes every step to JSON
  const tracerScript = `
import sys
import json
import copy

_trace_steps = []

def _serialize_val(v):
    if isinstance(v, (int, float, bool, str)) or v is None:
        return v
    if isinstance(v, (list, tuple)):
        return [_serialize_val(x) for x in v]
    if isinstance(v, dict):
        return {str(k): _serialize_val(val) for k, val in v.items()}
    return repr(v)

def _tracer(frame, event, arg):
    # Only trace inside our dynamically executed algorithm file
    if frame.f_code.co_filename != '<algorithm>':
        return _tracer

    if event in ('line', 'return'):
        local_vars = {}
        for k, v in frame.f_locals.items():
            if not k.startswith('_'):
                local_vars[k] = _serialize_val(v)

        step_info = {
            'event': event,
            'line': frame.f_lineno,
            'locals': local_vars,
            'returnVal': _serialize_val(arg) if event == 'return' else None
        }
        _trace_steps.append(step_info)

    return _tracer

# 1. Compile and load the algorithm into an isolated namespace
_ns = {}
_compiled = compile(_user_code, '<algorithm>', 'exec')
exec(_compiled, _ns)

_fn = _ns[_func_name]

# 2. Run the function under sys.settrace
sys.settrace(_tracer)
try:
    _result = _fn(copy.deepcopy(_input_arr), _input_target)
finally:
    sys.settrace(None)

json.dumps(_trace_steps)
  `;

  const rawJson = await py.runPythonAsync(tracerScript);
  return JSON.parse(rawJson);
}
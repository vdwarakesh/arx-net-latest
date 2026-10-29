// js/pyodide-runner.js
let pyodideInstance = null;
let pyodideReadyPromise = null;

export async function getPyodide() {
  if (pyodideInstance) return pyodideInstance;
  if (!pyodideReadyPromise) {
    pyodideReadyPromise = (async () => {
        pyodideInstance = await window.loadPyodide({
          indexURL: 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/',
        });
      
      return pyodideInstance;
    })();
  }
  return pyodideReadyPromise;
}

/**
 * Executes a Python algorithm using a VisualArray proxy and sys.settrace().
 * Automatically tracks array accesses for visual highlighting and filters out input constants.
 */
export async function tracePythonArrayAlgorithm(pythonCode, funcName, arrValues, targetVal) {
  const py = await getPyodide();

  py.globals.set('_user_code', pythonCode);
  py.globals.set('_func_name', funcName);
  py.globals.set('_raw_arr', py.toPy(arrValues));
  py.globals.set('_input_target', py.toPy(targetVal));

  const tracerScript = `
import sys
import json
import inspect

_trace_steps = []

class VisualArray(list):
    def __init__(self, iterable):
        super().__init__(iterable)
        self.active_index = -1
        self.checked_indices = []
        self.traversal = []
        self._visited_set = set()

    def _record_access(self, idx):
        if isinstance(idx, int) and 0 <= idx < len(self):
            # Move previous active index into checked_indices
            if self.active_index != -1 and self.active_index != idx:
                if self.active_index not in self.checked_indices:
                    self.checked_indices.append(self.active_index)
            self.active_index = idx
            if idx not in self._visited_set:
                self._visited_set.add(idx)
                self.traversal.append({'index': idx, 'value': super().__getitem__(idx)})

    def __getitem__(self, idx):
        self._record_access(idx)
        return super().__getitem__(idx)

    def __setitem__(self, idx, val):
        self._record_access(idx)
        return super().__setitem__(idx, val)

def _serialize(v):
    if isinstance(v, (int, float, bool, str)) or v is None:
        return v
    if isinstance(v, (list, tuple)):
        return [_serialize(x) for x in v]
    if isinstance(v, dict):
        return {str(k): _serialize(val) for k, val in v.items()}
    return repr(v)

# 1. Compile the clean algorithm file
_ns = {}
exec(compile(_user_code, '<algorithm>', 'exec'), _ns)
_fn = _ns[_func_name]

# 2. Identify function parameters (e.g. 'arr', 'target') so we exclude constants from State Variables
_param_names = set(inspect.signature(_fn).parameters.keys())
_visual_arr = VisualArray(_raw_arr)

def _tracer(frame, event, arg):
    if frame.f_code.co_filename != '<algorithm>':
        return _tracer

    if event in ('line', 'return'):
        # Extract only dynamic local variables (ignores 'arr', 'target', and private vars)
        state_vars = {}
        for k, v in frame.f_locals.items():
            if not k.startswith('_') and k not in _param_names:
                state_vars[k] = _serialize(v)

        # If 'i' is in scope and in bounds, also peek at arr[i] without triggering proxy side-effects
        if 'i' in state_vars and isinstance(state_vars['i'], int):
            idx = state_vars['i']
            if 0 <= idx < len(_visual_arr):
                # Highlight the bar as soon as the loop sets 'i'
                _visual_arr._record_access(idx)
                state_vars[f'arr[{idx}]'] = _serialize(list.__getitem__(_visual_arr, idx))

        found_index = -1
        if event == 'return':
            ret_val = _serialize(arg)
            state_vars['return'] = ret_val
            if isinstance(ret_val, int) and 0 <= ret_val < len(_visual_arr):
                found_index = ret_val
            else:
                # Returning -1 (not found): mark the last active element as checked
                if _visual_arr.active_index != -1 and _visual_arr.active_index not in _visual_arr.checked_indices:
                    _visual_arr.checked_indices.append(_visual_arr.active_index)
                _visual_arr.active_index = -1

        _trace_steps.append({
            'event': event,
            'line': frame.f_lineno,
            'stateVars': state_vars,
            'visual': {
                'activeIndex': found_index if found_index >= 0 else _visual_arr.active_index,
                'foundIndex': found_index,
                'checkedIndices': list(_visual_arr.checked_indices),
                'traversal': list(_visual_arr.traversal),
            }
        })

    return _tracer

sys.settrace(_tracer)
try:
    _fn(_visual_arr, _input_target)
finally:
    sys.settrace(None)

json.dumps(_trace_steps)
  `;

  const rawJson = await py.runPythonAsync(tracerScript);
  return JSON.parse(rawJson);
}
// js/pyodide-runner.js
let pyodideInstance = null;
let pyodideReadyPromise = null;

export async function getPyodide() {
    if (pyodideInstance) return pyodideInstance;
    if (!pyodideReadyPromise) {
        pyodideReadyPromise = (async () => {
            try {
                pyodideInstance = await window.loadPyodide({ indexURL: './js/' });
            } catch {
                pyodideInstance = await window.loadPyodide({
                    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/',
                });
            }
            return pyodideInstance;
        })();
    }
    return pyodideReadyPromise;
}

/**
 * Pre-loads Pyodide and imports standard library modules in the background.
 */
export async function warmUpPyodide() {
    try {
        const py = await getPyodide();
        await py.runPythonAsync(`
import sys
import json
import inspect
import traceback
    `);
        console.log("Pyodide warmed up and ready.");
    } catch (err) {
        console.error("Pyodide warm-up failed:", err);
    }
}

/**
 * Executes a Python algorithm using a VisualArray proxy and sys.settrace().
 * Protected against infinite loops, deep recursion, and runtime exceptions.
 *
 * @returns {Promise<{ steps: Array, error: { type: string, message: string, line: number|null } | null }>}
 */
export async function tracePythonArrayAlgorithm(
    pythonCode,
    funcName,
    arrValues,
    targetVal,
    maxSteps = 2500
) {
    const py = await getPyodide();

    py.globals.set('_user_code', pythonCode);
    py.globals.set('_func_name', funcName);
    py.globals.set('_raw_arr', py.toPy(arrValues));
    py.globals.set('_input_target', py.toPy(targetVal));
    py.globals.set('_MAX_STEPS', maxSteps);

    const tracerScript = `
import sys
import json
import inspect
import traceback

_trace_steps = []
_error_info = None
_step_count = 0

class _StepLimitExceeded(Exception):
    pass

class VisualArray(list):
    def __init__(self, iterable):
        super().__init__(iterable)
        self.active_index = -1
        self.checked_indices = []
        self.traversal = []
        self._visited_set = set()

    def _record_access(self, idx):
        if isinstance(idx, int) and 0 <= idx < len(self):
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

def _extract_algo_line(exc_tb):
    """Finds the last line number inside <algorithm> from a traceback."""
    tb_list = traceback.extract_tb(exc_tb)
    for frame_summary in reversed(tb_list):
        if frame_summary.filename == '<algorithm>':
            return frame_summary.lineno
    return _trace_steps[-1]['line'] if _trace_steps else None

try:
    # 1. Compile and execute the algorithm definition
    _ns = {}
    exec(compile(_user_code, '<algorithm>', 'exec'), _ns)

    if _func_name not in _ns:
        raise NameError(f"Function '{_func_name}' was not found in the algorithm file.")

    _fn = _ns[_func_name]
    _param_names = set(inspect.signature(_fn).parameters.keys())
    _visual_arr = VisualArray(_raw_arr)

    def _tracer(frame, event, arg):
        global _step_count
        if frame.f_code.co_filename != '<algorithm>':
            return _tracer

        if event in ('line', 'return'):
            _step_count += 1
            if _step_count > _MAX_STEPS:
                raise _StepLimitExceeded(
                    f"Execution exceeded {_MAX_STEPS} steps (possible infinite loop)."
                )

            state_vars = {}
            for k, v in frame.f_locals.items():
                if not k.startswith('_') and k not in _param_names:
                    state_vars[k] = _serialize(v)

            if 'i' in state_vars and isinstance(state_vars['i'], int):
                idx = state_vars['i']
                if 0 <= idx < len(_visual_arr):
                    _visual_arr._record_access(idx)
                    state_vars[f'arr[{idx}]'] = _serialize(list.__getitem__(_visual_arr, idx))

            found_index = -1
            if event == 'return':
                ret_val = _serialize(arg)
                state_vars['return'] = ret_val
                if isinstance(ret_val, int) and 0 <= ret_val < len(_visual_arr):
                    found_index = ret_val
                else:
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

    # 2. Lower recursion limit so infinite recursion fails quickly
    _old_rec_limit = sys.getrecursionlimit()
    sys.setrecursionlimit(250)

    sys.settrace(_tracer)
    try:
        _fn(_visual_arr, _input_target)
    finally:
        sys.settrace(None)
        sys.setrecursionlimit(_old_rec_limit)

except _StepLimitExceeded as e:
    _error_info = {
        'type': 'InfiniteLoopError',
        'message': str(e),
        'line': _trace_steps[-1]['line'] if _trace_steps else 1
    }
except RecursionError:
    _, _, _tb = sys.exc_info()
    _error_info = {
        'type': 'RecursionError',
        'message': 'Maximum recursion depth exceeded (possible infinite recursion).',
        'line': _extract_algo_line(_tb)
    }
except SyntaxError as e:
    _error_info = {
        'type': 'SyntaxError',
        'message': f"{e.msg} (line {e.lineno})",
        'line': e.lineno
    }
except Exception as e:
    _, _, _tb = sys.exc_info()
    _error_info = {
        'type': type(e).__name__,
        'message': str(e),
        'line': _extract_algo_line(_tb)
    }

json.dumps({
    'steps': _trace_steps,
    'error': _error_info
})
  `;

    try {
        const rawJson = await py.runPythonAsync(tracerScript);
        return JSON.parse(rawJson);
    } catch (fatalErr) {
        return {
            steps: [],
            error: {
                type: 'RuntimeError',
                message: fatalErr.message || String(fatalErr),
                line: null,
            },
        };
    }
}
// js/pyodide-worker.js

// 1. Load Pyodide from the CDN into the worker thread (Using the real stable version)
importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js');

// 2. Start booting Pyodide immediately in the background
let pyodideReadyPromise = loadPyodide();

self.onmessage = async (event) => {
  const { id, type, pythonCode, funcName, arrValues, adjList, nodeLabels, rawKwargs, maxSteps } = event.data;

  if (type === 'warmup') {
    try {
      const py = await pyodideReadyPromise;
      await py.runPythonAsync(`
import sys
import json
import inspect
import traceback
import ast
      `);
      self.postMessage({ id, status: 'ready' });
    } catch (err) {
      console.error('Worker warm-up failed:', err);
    }
    return;
  }

  if (type === 'run') {
    try {
      const py = await pyodideReadyPromise;

      py.globals.set('_user_code', pythonCode);
      py.globals.set('_func_name', funcName);
      py.globals.set('_raw_arr', py.toPy(arrValues));
      py.globals.set('_raw_kwargs_json', JSON.stringify(rawKwargs || {}));
      py.globals.set('_MAX_STEPS', maxSteps || 2500);

      const tracerScript = `
import sys
import json
import inspect
import traceback
import ast

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
    tb_list = traceback.extract_tb(exc_tb)
    for frame_summary in reversed(tb_list):
        if frame_summary.filename == '<algorithm>':
            return frame_summary.lineno
    return _trace_steps[-1]['line'] if _trace_steps else None

try:
    _ns = {}
    exec(compile(_user_code, '<algorithm>', 'exec'), _ns)

    if _func_name not in _ns:
        raise NameError(f"Function '{_func_name}' was not found in the algorithm file.")

    _fn = _ns[_func_name]
    _param_names = set(inspect.signature(_fn).parameters.keys())
    _visual_arr = VisualArray(_raw_arr)

    _raw_kwargs = json.loads(_raw_kwargs_json)
    _eval_kwargs = {}
    for _k, _v_str in _raw_kwargs.items():
        try:
            _eval_kwargs[_k] = ast.literal_eval(_v_str)
        except (ValueError, SyntaxError):
            _eval_kwargs[_k] = _v_str

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

    _old_rec_limit = sys.getrecursionlimit()
    sys.setrecursionlimit(250)

    sys.settrace(_tracer)
    try:
        _fn(_visual_arr, **_eval_kwargs)
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
        'message': 'Maximum recursion depth exceeded.',
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
      
      const rawJson = await py.runPythonAsync(tracerScript);
      self.postMessage({ id, result: JSON.parse(rawJson) });
    } catch (fatalErr) {
      self.postMessage({
        id,
        result: {
          steps: [],
          error: { type: 'RuntimeError', message: fatalErr.message || String(fatalErr), line: null }
        }
      });
    }
  }

  if (type === 'run_graph') {
    try {
      const py = await pyodideReadyPromise;

      py.globals.set('_user_code', pythonCode);
      py.globals.set('_func_name', funcName);
      py.globals.set('_raw_adj_json', JSON.stringify(adjList || {}));
      py.globals.set('_node_labels_json', JSON.stringify(nodeLabels || {}));
      py.globals.set('_raw_kwargs_json', JSON.stringify(rawKwargs || {}));
      py.globals.set('_MAX_STEPS', maxSteps || 2500);

      const tracerScript = `
import sys
import json
import inspect
import traceback
import ast

_trace_steps = []
_error_info = None
_step_count = 0

class _StepLimitExceeded(Exception):
    pass

_raw_adj = json.loads(_raw_adj_json)
_node_labels = json.loads(_node_labels_json)

# Map display labels to canonical node keys first, then fallback to internal IDs
_label_to_key = {}
for _k in _node_labels.keys():
    _label_to_key[str(_k)] = str(_k)
for _k, _lbl in _node_labels.items():
    _label_to_key[str(_lbl)] = str(_k)

class VisualGraph(dict):
    def __init__(self, adj):
        super().__init__(adj)
        self.active_node = None
        self.visited_nodes = []
        self.traversal = []
        self._visited_set = set()
        self.active_edge = None
        self.visited_edges = []

    def record_visit(self, node_key):
        s_key = str(node_key)
        if s_key not in self:
            return
        if self.active_node is not None and self.active_node != s_key:
            if self.active_node not in self.visited_nodes:
                self.visited_nodes.append(self.active_node)
        self.active_node = s_key
        if s_key not in self._visited_set:
            self._visited_set.add(s_key)
            self.traversal.append({
                'index': s_key,
                'value': _node_labels.get(s_key, s_key),
                'subLabel': f"ID {s_key}"
            })

def _serialize(v,vg=None):
    if isinstance(v, (int, float, bool, str)) or v is None:
        return v
    if isinstance(v, (list, tuple, set)):
        return [_serialize(x) for x in v]
    if isinstance(v, dict):
        return {str(k): _serialize(val) for k, val in v.items()}
    return repr(v)

def _extract_algo_line(exc_tb):
    tb_list = traceback.extract_tb(exc_tb)
    for frame_summary in reversed(tb_list):
        if frame_summary.filename == '<algorithm>':
            return frame_summary.lineno
    return _trace_steps[-1]['line'] if _trace_steps else None

try:
    _ns = {}
    exec(compile(_user_code, '<algorithm>', 'exec'), _ns)

    if _func_name not in _ns:
        raise NameError(f"Function '{_func_name}' was not found in the algorithm file.")

    _fn = _ns[_func_name]
    _param_names = set(inspect.signature(_fn).parameters.keys())
    _visual_graph = VisualGraph(_raw_adj)

    _raw_kwargs = json.loads(_raw_kwargs_json)
    _eval_kwargs = {}
    for _k, _v_str in _raw_kwargs.items():
        try:
            _val = ast.literal_eval(_v_str)
        except (ValueError, SyntaxError):
            _val = _v_str
        if _k == 'start_node' and _val is not None:
            _s = str(_val).strip()
            if _s in _label_to_key:
                _val = _label_to_key[_s]
        _eval_kwargs[_k] = _val

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

            loc = frame.f_locals
            state_vars = {}
            for k, v in loc.items():
                if not k.startswith('_') and k not in _param_names:
                    if k in ('node', 'neighbor', 'start_node') and v is not None:
                        state_vars[k] = _node_labels.get(str(v), v)
                    elif k in ('queue', 'visited') and isinstance(v, (list, tuple, set)):
                        state_vars[k] = [_node_labels.get(str(x), x) for x in v]
                    else:
                        state_vars[k] = _serialize(v)

            curr_node = str(loc['node']) if 'node' in loc and loc['node'] is not None else None
            curr_neighbor = str(loc['neighbor']) if 'neighbor' in loc and loc['neighbor'] is not None else None

            if curr_node is not None and curr_node in _visual_graph:
                _visual_graph.record_visit(curr_node)

            if curr_node is not None and curr_neighbor is not None:
                _visual_graph.active_edge = [curr_node, curr_neighbor]
                # If neighbor was just added to visited/queue, mark edge as traversed
                if 'visited' in loc and curr_neighbor in [str(x) for x in loc['visited']]:
                    edge_pair = [curr_node, curr_neighbor]
                    if edge_pair not in _visual_graph.visited_edges:
                        _visual_graph.visited_edges.append(edge_pair)
            else:
                _visual_graph.active_edge = None

            if event == 'return':
                ret_val = _serialize(arg)
                state_vars['return'] = ret_val
                if _visual_graph.active_node is not None and _visual_graph.active_node not in _visual_graph.visited_nodes:
                    _visual_graph.visited_nodes.append(_visual_graph.active_node)
                _visual_graph.active_node = None
                _visual_graph.active_edge = None

            _trace_steps.append({
                'event': event,
                'line': frame.f_lineno,
                'stateVars': state_vars,
                'visual': {
                    'activeNodeId': _visual_graph.active_node,
                    'visitedNodes': list(_visual_graph.visited_nodes),
                    'activeEdge': _visual_graph.active_edge,
                    'visitedEdges': list(_visual_graph.visited_edges),
                    'traversal': list(_visual_graph.traversal),
                }
            })

        return _tracer

    _old_rec_limit = sys.getrecursionlimit()
    sys.setrecursionlimit(250)

    sys.settrace(_tracer)
    try:
        _fn(_visual_graph, **_eval_kwargs)
    finally:
        sys.settrace(None)
        sys.setrecursionlimit(_old_rec_limit)

except _StepLimitExceeded as e:
    _error_info = {
        'type': 'InfiniteLoopError',
        'message': str(e),
        'line': _trace_steps[-1]['line'] if _trace_steps else 1
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

      const rawJson = await py.runPythonAsync(tracerScript);
      self.postMessage({ id, result: JSON.parse(rawJson) });
    } catch (fatalErr) {
      self.postMessage({
        id,
        result: {
          steps: [],
          error: { type: 'RuntimeError', message: fatalErr.message || String(fatalErr), line: null }
        }
      });
    }
  }
};
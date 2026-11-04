// js/pyodide-worker.js

// 1. Load Pyodide from the CDN into the worker thread
importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js');

// 2. Start booting Pyodide immediately in the background
let pyodideReadyPromise = loadPyodide();

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
      py.globals.set('_ds_category', dsCategory || 'sequence');
      py.globals.set('_ds_payload_json', JSON.stringify(dsData ?? []));
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
_pending_steps = {}

class _StepLimitExceeded(Exception):
    pass

_payload = json.loads(_ds_payload_json)
_node_labels = json.loads(_node_labels_json)

# Map display labels to canonical node keys first, then fallback to internal IDs
_label_to_key = {}
for _k in _node_labels.keys():
    _label_to_key[str(_k)] = str(_k)
for _k, _lbl in _node_labels.items():
    _label_to_key[str(_lbl)] = str(_k)


# ============================================================================
# 1. GENERIC PROXY DATA STRUCTURES (ZERO HARDCODED VARIABLE NAMES)
# ============================================================================

class _NodeId(str):
    """String subclass tagging graph/tree node IDs so _serialize automatically
    converts them to display labels regardless of variable or container name."""
    pass


class VisualSequence(list):
    """Generic proxy for Array, Dynamic Array, Static Array, Stack, Queue, String, etc."""
    def __init__(self, iterable, param_name='arr'):
        super().__init__(iterable)
        self.param_name = param_name
        self.active_index = -1
        self.checked_indices = []
        self.traversal = []
        self._visited_set = set()
        self.recent_accesses = {}

    def on_step_start(self):
        self.recent_accesses.clear()

    def _record_access(self, idx):
        if isinstance(idx, int) and not isinstance(idx, bool) and 0 <= idx < len(self):
            if self.active_index != -1 and self.active_index != idx:
                if self.active_index not in self.checked_indices:
                    self.checked_indices.append(self.active_index)
            self.active_index = idx
            val = super().__getitem__(idx)
            self.recent_accesses[f"{self.param_name}[{idx}]"] = val
            if idx not in self._visited_set:
                self._visited_set.add(idx)
                self.traversal.append({'index': idx, 'value': val})

    def __getitem__(self, idx):
        if isinstance(idx, slice):
            start, stop, step = idx.indices(len(self))
            for i in range(start, stop, step):
                self._record_access(i)
            return super().__getitem__(idx)
        self._record_access(idx)
        return super().__getitem__(idx)

    def __setitem__(self, idx, val):
        if not isinstance(idx, slice):
            self._record_access(idx)
        return super().__setitem__(idx, val)

    def on_line_fallback(self, assigned_vars, frame_locals):
        """If a line assigned an integer index (e.g. 'for k in range(...)' or 'mid = ...')
        without indexing the list yet, highlight that index automatically."""
        if not self.recent_accesses:
            for var_val in assigned_vars:
                if isinstance(var_val, int) and not isinstance(var_val, bool) and 0 <= var_val < len(self):
                    self._record_access(var_val)
                    break

    def enhance_state_vars(self, state_vars):
        for expr_str, val in self.recent_accesses.items():
            state_vars[expr_str] = _serialize(val)

    def on_return(self, ret_val):
        found_idx = -1
        if isinstance(ret_val, int) and not isinstance(ret_val, bool) and 0 <= ret_val < len(self):
            found_idx = ret_val
        else:
            if self.active_index != -1 and self.active_index not in self.checked_indices:
                self.checked_indices.append(self.active_index)
            self.active_index = -1
        return self.snapshot(found_idx)

    def snapshot(self, found_index=-1):
        return {
            'activeIndex': found_index if found_index >= 0 else self.active_index,
            'foundIndex': found_index,
            'checkedIndices': list(self.checked_indices),
            'traversal': list(self.traversal),
        }


class _GraphNeighborList(list):
    """Wraps a node's adjacency list so iterating over graph[u] automatically
    tracks active edges and traversal edges without checking variable names."""
    def __init__(self, graph, source_key, neighbors):
        super().__init__(neighbors)
        self._graph = graph
        self._source = source_key

    def __iter__(self):
        for nb in super().__iter__():
            self._graph._on_edge_inspect(self._source, nb)
            yield nb
        self._graph.active_edge = None


class VisualGraph(dict):
    """Generic proxy for Graph, Directed Graph, Weighted Graph, Tree, etc."""
    def __init__(self, raw_adj):
        wrapped = {}
        for k, neighbors in raw_adj.items():
            uk = _NodeId(k)
            nb_list = []
            for nb in neighbors:
                if isinstance(nb, (list, tuple)) and len(nb) >= 2:
                    nb_list.append((_NodeId(nb[0]), nb[1]))
                else:
                    nb_list.append(_NodeId(nb))
            wrapped[uk] = nb_list
        super().__init__(wrapped)

        self.active_node = None
        self.visited_nodes = []
        self.traversal = []
        self._visited_set = set()
        self.active_edge = None
        self.visited_edges = []

    def on_step_start(self):
        pass

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

    def _on_edge_inspect(self, u_key, v_entry):
        u_str = str(u_key)
        v_str = str(v_entry[0]) if isinstance(v_entry, tuple) else str(v_entry)
        self.record_visit(u_str)
        self.active_edge = [u_str, v_str]

    def _promote_discovered_edges(self, frame_locals):
        """Whenever an inspected neighbor v is stored into any collection
        (e.g., queue, stack, visited set, parent dict), mark edge (u, v) as traversed."""
        if not self.active_edge:
            return
        u_str, v_str = self.active_edge
        for val in frame_locals.values():
            if isinstance(val, (list, tuple, set)):
                if any(str(x) == v_str for x in val):
                    pair = [u_str, v_str]
                    if pair not in self.visited_edges:
                        self.visited_edges.append(pair)
                    break
            elif isinstance(val, dict) and not isinstance(val, VisualGraph):
                if any(str(x) == v_str for x in val.keys()):
                    pair = [u_str, v_str]
                    if pair not in self.visited_edges:
                        self.visited_edges.append(pair)
                    break

    def __getitem__(self, key):
        s_key = _NodeId(str(key))
        if s_key in self:
            self.record_visit(s_key)
            return _GraphNeighborList(self, s_key, super().__getitem__(s_key))
        return super().__getitem__(key)

    def get(self, key, default=None):
        s_key = _NodeId(str(key))
        if s_key in self:
            return self[s_key]
        return default

    def __iter__(self):
        for k in super().__iter__():
            yield _NodeId(k)

    def keys(self):
        return [_NodeId(k) for k in super().keys()]

    def on_line_fallback(self, assigned_vars, frame_locals):
        for val in assigned_vars:
            if isinstance(val, _NodeId) and str(val) in self:
                self.record_visit(str(val))
                break
        self._promote_discovered_edges(frame_locals)

    def enhance_state_vars(self, state_vars):
        pass

    def on_return(self, ret_val):
        if self.active_node is not None and self.active_node not in self.visited_nodes:
            self.visited_nodes.append(self.active_node)
        self.active_node = None
        self.active_edge = None
        return self.snapshot()

    def snapshot(self):
        return {
            'activeIndex': -1,
            'foundIndex': -1,
            'checkedIndices': [],
            'activeNodeId': self.active_node,
            'foundNodeId': None,
            'visitedNodes': list(self.visited_nodes),
            'activeEdge': self.active_edge,
            'visitedEdges': list(self.visited_edges),
            'traversal': list(self.traversal),
        }


# Registry mapping dsCategory -> Proxy Factory
_PROXY_REGISTRY = {
    'sequence': lambda payload, first_param: VisualSequence(payload, first_param),
    'graph': lambda payload, first_param: VisualGraph(payload),
}


def _serialize(v):
    if isinstance(v, _NodeId):
        return _node_labels.get(str(v), str(v))
    if isinstance(v, (int, float, bool, str)) or v is None:
        return v
    if isinstance(v, (list, tuple, set)):
        return [_serialize(x) for x in v]
    if isinstance(v, dict):
        return {str(_serialize(k)): _serialize(val) for k, val in v.items()}
    return repr(v)


def _build_line_assigned_names(code_str):
    """Parses the Python AST once to map each line number to the variable names
    assigned or iterated on that line."""
    line_map = {}
    try:
        tree = ast.parse(code_str)
        for node in ast.walk(tree):
            targets = []
            if isinstance(node, (ast.For, ast.AsyncFor)):
                targets.append(node.target)
            elif isinstance(node, ast.Assign):
                targets.extend(node.targets)
            elif isinstance(node, ast.AugAssign):
                targets.append(node.target)
            if targets and hasattr(node, 'lineno'):
                names = []
                for t in targets:
                    for sub in ast.walk(t):
                        if isinstance(sub, ast.Name) and isinstance(sub.ctx, ast.Store):
                            names.append(sub.id)
                if names:
                    line_map.setdefault(node.lineno, []).extend(names)
    except Exception:
        pass
    return line_map


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
    _sig_params = list(inspect.signature(_fn).parameters.keys())
    _param_names = set(_sig_params)
    _first_param = _sig_params[0] if _sig_params else 'data'
    _line_targets = _build_line_assigned_names(_user_code)

    _factory = _PROXY_REGISTRY.get(_ds_category, _PROXY_REGISTRY['sequence'])
    _visual_ds = _factory(_payload, _first_param)

    _raw_kwargs = json.loads(_raw_kwargs_json)
    _eval_kwargs = {}
    for _k, _v_str in _raw_kwargs.items():
        try:
            _val = ast.literal_eval(_v_str)
        except (ValueError, SyntaxError):
            _val = _v_str
        if _ds_category == 'graph' and _val is not None:
            _s = str(_val).strip()
            if _s in _label_to_key:
                _val = _NodeId(_label_to_key[_s])
        _eval_kwargs[_k] = _val

    def _build_state_vars(frame, executed_lineno):
        loc = frame.f_locals
        assigned_names = _line_targets.get(executed_lineno, [])
        assigned_vals = [loc[name] for name in assigned_names if name in loc]
        _visual_ds.on_line_fallback(assigned_vals, loc)

        state_vars = {}
        for k, v in loc.items():
            if not k.startswith('_') and k not in _param_names:
                state_vars[k] = _serialize(v)

        _visual_ds.enhance_state_vars(state_vars)
        return state_vars

    def _tracer(frame, event, arg):
        global _step_count
        if frame.f_code.co_filename != '<algorithm>':
            return _tracer
        if event not in ('line', 'return'):
            return _tracer

        _step_count += 1
        if _step_count > _MAX_STEPS:
            raise _StepLimitExceeded(
                f"Execution exceeded {_MAX_STEPS} steps (possible infinite loop)."
            )

        fid = id(frame)
        pending = _pending_steps.pop(fid, None)
        executed_line = pending['line'] if pending is not None else frame.f_lineno

        state_vars = _build_state_vars(frame, executed_line)

        if pending is not None and not (event == 'return' and pending['line'] == frame.f_lineno):
            _trace_steps.append({
                'event': 'line',
                'line': pending['line'],
                'stateVars': state_vars,
                'visual': _visual_ds.snapshot(),
            })

        if event == 'line':
            _visual_ds.on_step_start()
            _pending_steps[fid] = {'line': frame.f_lineno}
        else:  # 'return'
            ret_val = _serialize(arg)
            ret_state_vars = dict(state_vars)
            ret_state_vars['return'] = ret_val
            final_visual = _visual_ds.on_return(arg)

            _trace_steps.append({
                'event': 'return',
                'line': frame.f_lineno,
                'stateVars': ret_state_vars,
                'visual': final_visual,
            })

        return _tracer

    _old_rec_limit = sys.getrecursionlimit()
    sys.setrecursionlimit(250)

    sys.settrace(_tracer)
    try:
        _fn(_visual_ds, **_eval_kwargs)
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
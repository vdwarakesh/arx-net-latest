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
            py.globals.set('_sim_mode', simMode || 'auto');
            py.globals.set('_user_choices_json', JSON.stringify(userChoices || []));
            py.globals.set('_MAX_STEPS', maxSteps || 2500);

            const tracerScript = `
import sys
import json
import inspect
import traceback
import ast
import math
from collections import deque

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
# 1. GENERIC PROXY DATA STRUCTURES (WITH EXACT FUTURE-ACCESS TRACKING)
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
        self.traversal = []
        self._visited_set = set()
        self.recent_accesses = {}
        self.step_accessed_indices = set()

    def on_step_start(self):
        self.recent_accesses.clear()
        self.step_accessed_indices.clear()

    def _record_access(self, idx):
        if isinstance(idx, int) and not isinstance(idx, bool) and 0 <= idx < len(self):
            self.active_index = idx
            self.step_accessed_indices.add(idx)
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

    def on_line_fallback(self, loop_target_vars, frame_locals):
        """Only if a line is a 'for <var> in ...' loop header and didn't index
        the array directly on that line, highlight the loop variable's index.
        Ordinary assignments like 'end_index = len(arr) - 1' are ignored."""
        if not self.recent_accesses:
            for var_val in loop_target_vars:
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
        self.active_index = -1
        self.step_accessed_indices.clear()
        return self.snapshot(found_idx)

    def snapshot(self, found_index=-1):
        return {
            'activeIndex': found_index if found_index >= 0 else self.active_index,
            'foundIndex': found_index,
            'checkedIndices': [],  # Populated accurately in post_process_steps
            'traversal': list(self.traversal),
            '_accessed': list(self.step_accessed_indices),
        }

    def finalize_steps(self, trace_steps):
        """Post-processes all recorded steps so an index is marked 'checked'
        ONLY after the final step in the entire execution where it is ever accessed."""
        last_access_step = {}
        first_access_step = {}

        for step_idx, step in enumerate(trace_steps):
            vis = step['visual']
            accessed = vis.pop('_accessed', [])
            if vis['activeIndex'] >= 0 and vis['activeIndex'] not in accessed:
                accessed.append(vis['activeIndex'])
            for arr_idx in accessed:
                if arr_idx not in first_access_step:
                    first_access_step[arr_idx] = step_idx
                last_access_step[arr_idx] = step_idx

        ever_accessed_in_order = sorted(first_access_step.keys(), key=lambda k: first_access_step[k])

        for step_idx, step in enumerate(trace_steps):
            vis = step['visual']
            active = vis['activeIndex']
            found = vis['foundIndex']
            # An element is guaranteed done if it was already accessed earlier
            # and its final access across the entire algorithm was before step_idx
            checked = [
                k for k in ever_accessed_in_order
                if first_access_step[k] < step_idx
                and last_access_step[k] < step_idx
                and k != active
                and k != found
            ]
            vis['checkedIndices'] = checked


_user_choices = list(json.loads(_user_choices_json))

class _WaitForUserChoice(Exception):
    def __init__(self, interaction):
        self.interaction = interaction


class _GraphNeighborList(list):
    """In 'auto' mode, iterates in standard order.
    In 'manual' mode, treats ALL remaining incident edges of the current node
    as choices whenever 2 or more edges remain to be inspected (including edges
    leading to already-visited nodes, so the user can see the algorithm inspect
    and skip visited neighbors or pick unvisited ones)."""
    def __init__(self, graph, source_key, neighbors):
        super().__init__(neighbors)
        self._graph = graph
        self._source = str(source_key)

    def __iter__(self):
        if _sim_mode != 'manual':
            for nb in super().__iter__():
                self._graph._on_edge_inspect(self._source, nb)
                yield nb
            self._graph.active_edge = None
            return

        remaining = list(super().__iter__())
        while remaining:
            # Prompt the user whenever 2 or more incident edges remain to be inspected
            if len(remaining) > 1:
                if _user_choices:
                    chosen_id = str(_user_choices.pop(0))
                    match_idx = next(
                        (i for i, nb in enumerate(remaining)
                         if (str(nb[0]) if isinstance(nb, tuple) else str(nb)) == chosen_id),
                        0
                    )
                    nb = remaining.pop(match_idx)
                else:
                    src_label = _node_labels.get(self._source, self._source)
                    candidates = []
                    for nb in remaining:
                        nb_id = str(nb[0]) if isinstance(nb, tuple) else str(nb)
                        nb_label = _node_labels.get(nb_id, nb_id)
                        candidates.append({
                            'id': nb_id,
                            'label': nb_label,
                            'edge': [self._source, nb_id],
                            'edgeLabel': f"{src_label} → {nb_label}"
                        })
                    raise _WaitForUserChoice({
                        'type': 'select_neighbor',
                        'sourceNodeId': self._source,
                        'candidateNodeIds': [c['id'] for c in candidates],
                        'candidateEdges': [c['edge'] for c in candidates],
                        'candidates': candidates,
                        'title': f"Choose the next neighbor of '{src_label}' to inspect",
                        'reason': (
                            f"Node '{src_label}' has {len(candidates)} remaining incident edges to inspect "
                            f"({', '.join(c['label'] for c in candidates)}). "
                            f"Select any of these neighbors/edges to check whether it has been visited yet:"
                        )
                    })
            else:
                nb = remaining.pop(0)

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
        self.traversal = []
        self._visited_set = set()
        self._discovered_nodes = set()
        self.active_edge = None
        self.visited_edges = []
        self.step_accessed_nodes = set()

    def on_step_start(self):
        self.step_accessed_nodes.clear()

    def record_visit(self, node_key):
        s_key = str(node_key)
        if s_key not in self:
            return
        self.active_node = s_key
        self.step_accessed_nodes.add(s_key)
        self._discovered_nodes.add(s_key)
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
        self.step_accessed_nodes.add(v_str)

    def _promote_discovered_edges(self, frame_locals):
        for val in frame_locals.values():
            if isinstance(val, (list, tuple, set)):
                for item in val:
                    if isinstance(item, _NodeId) or str(item) in self:
                        self._discovered_nodes.add(str(item))
        if not self.active_edge:
            return
        u_str, v_str = self.active_edge
        if v_str in self._discovered_nodes:
            pair = [u_str, v_str]
            if pair not in self.visited_edges:
                self.visited_edges.append(pair)

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

    def on_line_fallback(self, loop_target_vars, frame_locals):
        for val in loop_target_vars:
            if isinstance(val, _NodeId) and str(val) in self:
                self.record_visit(str(val))
                break
        self._promote_discovered_edges(frame_locals)

    def enhance_state_vars(self, state_vars):
        pass

    def on_return(self, ret_val):
        self.active_node = None
        self.active_edge = None
        self.step_accessed_nodes.clear()
        return self.snapshot()

    def snapshot(self):
        active_nodes = []
        if self.active_node is not None:
            active_nodes.append(self.active_node)
        if self.active_edge:
            for endpoint in self.active_edge:
                if endpoint not in active_nodes:
                    active_nodes.append(endpoint)
        return {
            'activeIndex': -1,
            'foundIndex': -1,
            'checkedIndices': [],
            'activeNodeId': self.active_node,
            'activeNodeIds': active_nodes,
            'foundNodeId': None,
            'visitedNodes': [],
            'activeEdge': self.active_edge,
            'visitedEdges': list(self.visited_edges),
            'traversal': list(self.traversal),
            '_accessed': list(self.step_accessed_nodes),
        }

    def finalize_steps(self, trace_steps, is_paused_for_choice=False):
        last_access_step = {}
        first_access_step = {}

        for step_idx, step in enumerate(trace_steps):
            vis = step['visual']
            accessed = vis.pop('_accessed', [])
            if vis['activeNodeId'] is not None and vis['activeNodeId'] not in accessed:
                accessed.append(vis['activeNodeId'])
            for node_id in accessed:
                if node_id not in first_access_step:
                    first_access_step[node_id] = step_idx
                last_access_step[node_id] = step_idx

        ever_accessed_in_order = sorted(first_access_step.keys(), key=lambda k: first_access_step[k])

        for step_idx, step in enumerate(trace_steps):
            vis = step['visual']
            active = vis['activeNodeId']
            active_set = set(str(x) for x in (vis.get('activeNodeIds') or []))
            if active is not None:
                active_set.add(str(active))
            found = vis['foundNodeId']
            visited = [
                k for k in ever_accessed_in_order
                if first_access_step[k] < step_idx
                and (not is_paused_for_choice and last_access_step[k] < step_idx or is_paused_for_choice and k not in active_set)
                and k not in active_set
                and k != found
            ]
            vis['visitedNodes'] = visited

# Registry mapping dsCategory -> Proxy Factory
_PROXY_REGISTRY = {
    'sequence': lambda payload, first_param: VisualSequence(payload, first_param),
    'graph': lambda payload, first_param: VisualGraph(payload),
}


def _serialize(v):
    if isinstance(v, _NodeId):
        return _node_labels.get(str(v), str(v))
    if isinstance(v, bool) or v is None:
        return v
    if isinstance(v, float):
        if math.isinf(v):
            return "∞" if v > 0 else "-∞"
        if math.isnan(v):
            return "NaN"
        return round(v, 4) if v != int(v) else int(v)
    if isinstance(v, (int, str)):
        return v
    if isinstance(v, (list, tuple, set, deque)):
        return [_serialize(x) for x in v]
    if isinstance(v, dict):
        return {str(_serialize(k)): _serialize(val) for k, val in v.items()}
    return repr(v)


def _build_loop_target_names(code_str):
    """Parses the Python AST once to map ONLY 'for' loop lines to their loop
    target variable names (so ordinary assignments like 'end_index = len(arr) - 1'
    never trigger false-positive index visits)."""
    line_map = {}
    try:
        tree = ast.parse(code_str)
        for node in ast.walk(tree):
            if isinstance(node, (ast.For, ast.AsyncFor)) and hasattr(node, 'lineno'):
                names = [
                    sub.id for sub in ast.walk(node.target)
                    if isinstance(sub, ast.Name) and isinstance(sub.ctx, ast.Store)
                ]
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
    _loop_targets = _build_loop_target_names(_user_code)

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
        loop_var_names = _loop_targets.get(executed_lineno, [])
        loop_var_vals = [
            loc[name] for name in loop_var_names
            if name in loc and name not in _param_names
        ]
        _visual_ds.on_line_fallback(loop_var_vals, loc)

        state_vars = {}
        for k, v in loc.items():
            # Hide internal variables, functions/modules, and the primary data structure parameter, but SHOW scalar/optional parameters (like target, start_node, end_index)
            if not k.startswith('_') and k != _first_param and not inspect.isfunction(v) and not inspect.ismodule(v):
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

    # Compute exact checkedIndices / visitedNodes using future-access knowledge
    _visual_ds.finalize_steps(_trace_steps)

except _WaitForUserChoice as pause_exc:
    _visual_ds.finalize_steps(_trace_steps, is_paused_for_choice=True)
    if _trace_steps:
        _trace_steps[-1]['interaction'] = pause_exc.interaction
        
except _StepLimitExceeded as e:
    _visual_ds.finalize_steps(_trace_steps)
    _error_info = {
        'type': 'InfiniteLoopError',
        'message': str(e),
        'line': _trace_steps[-1]['line'] if _trace_steps else 1
    }
except RecursionError:
    _visual_ds.finalize_steps(_trace_steps)
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
    if '_visual_ds' in locals():
        _visual_ds.finalize_steps(_trace_steps)
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
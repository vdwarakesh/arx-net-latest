/* Standalone graph input parser
 *
 * Supports four input formats, auto-detected from the trimmed string:
 *   1. Python edge list:      [(A, B), (B, C, 5), ...]
 *   2. Python adjacency dict: {A: [B, C], B: [(C, 5)]}
 *   3. Adjacency matrix:      [[1,0,4,3,0], [2,1,...], ...] - purely
 *                             numeric rows of equal length; 0 = no edge,
 *                             any other number = weight. Vertices are
 *                             named by their numeric row/column index
 *                             (0, 1, 2, ...). A matrix containing
 *                             anything non-numeric (letters, quoted
 *                             strings, tuples, etc.) is a format error.
 *   4. Simple 2-char format:  "AB5, AC, BC2, D" (single char = lone vertex)
 *
 * No directedness handling and no deduplication is performed here - the
 * caller is responsible for that if needed. Every parser returns a flat
 * array of { source, target, weight } objects (target/weight are null
 * for a lone-vertex declaration).
 */

/* ---------- Entry point ---------- */

function parseEdges(edgesInput) {
    const trimmed = edgesInput.trim();

    if (trimmed.startsWith('{')) {
        return parsePythonAdjacencyDict(trimmed);
    }
    if (trimmed.startsWith('[')) {
        const inner = stripOuter(trimmed, '[', ']');
        if (inner === '') return [];

        const topLevelTokens = tokeniseTopLevel(inner);
        const looksLikeTupleList = topLevelTokens.some(t => t.startsWith('('));
        const looksLikeMatrix = topLevelTokens.some(t => t.startsWith('['));

        if (looksLikeTupleList) return parsePythonEdgeList(trimmed);
        if (looksLikeMatrix) return parseAdjacencyMatrix(trimmed);
        return parseCompactEdges(trimmed);
    }
    return parseCompactEdges(trimmed);
}

/* ---------- Shared helpers ---------- */

function tokeniseTopLevel(input, delimiter = ',') {
    const result = [];
    let depth = 0;
    let current = '';
    for (const char of input) {
        if (char === '(' || char === '[' || char === '{') depth++;
        if (char === ')' || char === ']' || char === '}') depth--;
        if (char === delimiter && depth === 0) {
            if (current.trim()) result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    if (current.trim()) result.push(current.trim());
    return result;
}

function stripOuter(s, open, close) {
    s = s.trim();
    if (s.startsWith(open) && s.endsWith(close)) return s.slice(1, -1).trim();
    return s;
}

function parseNode(token) {
    token = token.trim();
    if ((token.startsWith('"') && token.endsWith('"')) ||
        (token.startsWith("'") && token.endsWith("'"))) {
        return token.slice(1, -1);
    }
    return token; // bare identifier or numeric-looking string
}

function parseWeight(token) {
    if (token === undefined || token === null) return 1;
    const w = parseFloat(token.trim());
    return isNaN(w) ? 1 : w;
}

/* ---------- 1. Python edge list: [(A, B), (B, C, 5)] ---------- */

function parsePythonEdgeList(input) {
    const edges = [];
    const inner = stripOuter(input, '[', ']');
    if (!inner) return edges;

    const tuples = tokeniseTopLevel(inner);

    for (const tuple of tuples) {
        const t = tuple.trim();
        if (!t.startsWith('(')) { console.error('Expected tuple, got:', t); continue; }
        const tupleInner = stripOuter(t, '(', ')');
        const parts = tokeniseTopLevel(tupleInner);

        if (parts.length < 2) { console.error('Edge tuple needs >= 2 elements:', t); continue; }

        const source = parseNode(parts[0]);
        const target = parseNode(parts[1]);
        const weight = parts.length >= 3 ? parseWeight(parts[2]) : 1;

        edges.push({ source, target, weight });
    }

    return edges;
}

/* ---------- 2. Python adjacency dict: {A: [B, C], B: [(C, 5)]} ---------- */

function parseNeighbourEntry(entry) {
    entry = entry.trim();
    if (entry.startsWith('(')) {
        const inner = stripOuter(entry, '(', ')');
        const parts = tokeniseTopLevel(inner);
        if (parts.length >= 2) {
            return { target: parseNode(parts[0]), weight: parseWeight(parts[1]) };
        }
        if (parts.length === 1) {
            return { target: parseNode(parts[0]), weight: 1 };
        }
    }
    return { target: parseNode(entry), weight: 1 };
}

function parsePythonAdjacencyDict(input) {
    const edges = [];
    const inner = stripOuter(input, '{', '}');
    if (!inner) return edges;

    const pairs = tokeniseTopLevel(inner);

    for (const pair of pairs) {
        // Split on the FIRST colon that is at depth 0
        let colonIdx = -1;
        let depth = 0;
        for (let i = 0; i < pair.length; i++) {
            const c = pair[i];
            if (c === '(' || c === '[' || c === '{') depth++;
            if (c === ')' || c === ']' || c === '}') depth--;
            if (c === ':' && depth === 0) { colonIdx = i; break; }
        }
        if (colonIdx === -1) { console.error('Invalid adjacency entry:', pair); continue; }

        const source = parseNode(pair.slice(0, colonIdx).trim());
        const valueStr = pair.slice(colonIdx + 1).trim();

        if (valueStr.startsWith('[')) {
            const listInner = stripOuter(valueStr, '[', ']');
            if (!listInner) continue;
            const neighbours = tokeniseTopLevel(listInner);
            for (const nb of neighbours) {
                const { target, weight } = parseNeighbourEntry(nb);
                edges.push({ source, target, weight });
            }
        } else {
            const { target, weight } = parseNeighbourEntry(valueStr);
            edges.push({ source, target, weight });
        }
    }

    return edges;
}

/* ---------- 3. Adjacency matrix ---------- */
/*
 * Expected input, a list of lists of numbers:
 *   [
 *     [1, 0, 4, 3, 0],
 *     [2, 1, 0, 0, 5],
 *     ...
 *   ]
 *
 * Vertices are named numerically by their row/column index: 0, 1, 2, ...
 * A 0 cell means "no edge"; any other numeric value is the edge weight.
 * Every cell is read (including below the diagonal and the diagonal
 * itself), so a symmetric matrix will produce both i->j and j->i edges.
 *
 * Anything that isn't a clean numeric matrix - letters, quoted strings,
 * nested tuples, ragged/non-square rows, non-numeric cells - is a format
 * error, and this function throws rather than silently guessing.
 */
function parseAdjacencyMatrix(matrixInput) {
    const trimmed = matrixInput.trim();
    const outer = stripOuter(trimmed, '[', ']');
    const rowTokens = tokeniseTopLevel(outer);

    if (rowTokens.length === 0) {
        throw new Error('Invalid adjacency matrix: no rows found.');
    }

    const rows = rowTokens.map(rowToken => {
        const t = rowToken.trim();
        if (!t.startsWith('[') || !t.endsWith(']')) {
            throw new Error(`Invalid adjacency matrix: expected a row like "[1, 0, 2]", got "${t}".`);
        }
        const inner = stripOuter(t, '[', ']');
        const cellTokens = inner === '' ? [] : tokeniseTopLevel(inner);

        return cellTokens.map(cell => {
            const c = cell.trim();
            // Must be a plain number (int or float, optionally negative).
            // Rejects letters, quoted strings, nested brackets/tuples, etc.
            if (!/^-?\d+(\.\d+)?$/.test(c)) {
                throw new Error(`Invalid adjacency matrix: non-numeric value "${c}" found. Only numeric vertices/weights are allowed.`);
            }
            return parseFloat(c);
        });
    });

    const n = rows.length;
    for (const row of rows) {
        if (row.length !== n) {
            throw new Error(`Invalid adjacency matrix: must be square (found ${n} rows but a row with ${row.length} columns).`);
        }
    }

    const edges = [];
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            const value = rows[i][j];
            if (value === 0) continue;
            edges.push({ source: i, target: j, weight: value });
        }
    }

    return edges;
}

/* ---------- 4. Simple 2-char format: "AB5, AC, BC2, D" ---------- */

// "AB5" -> edge A->B weight 5. "AB" -> edge A->B weight 1.
// A single character "D" -> lone vertex declaration (target/weight null).
function parseCompactEdges(edgesInput) {
    const edgeFormat = /^([a-zA-Z0-9])([a-zA-Z0-9])(-?\d*\.?\d*)$/;
    const vertexFormat = /^[a-zA-Z0-9]$/;

    return tokeniseTopLevel(edgesInput).map(edge => {
        edge = edge.trim();
        let source, target, weight;

        if (edgeFormat.test(edge)) {
            const match = edge.match(edgeFormat);
            source = match[1];
            target = match[2];
            weight = parseFloat(match[3]);
            if (isNaN(weight)) weight = 1;
        } else if (vertexFormat.test(edge)) {
            source = edge;
            target = null;
            weight = null;
        } else {
            console.error('Invalid edge format:', edge);
            return null;
        }

        return { source, target, weight };
    }).filter(Boolean);
}

/* ---------- Exports (Node / browser) ---------- */

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        parseEdges,
        parsePythonEdgeList,
        parsePythonAdjacencyDict,
        parseAdjacencyMatrix,
        parseCompactEdges
    };
}
// Draws a Graph's edges, vertices and labels into an SVGWindow,
// and lets vertices be dragged to new positions.
// Call render() again whenever the graph's vertices or edges change.
export class GraphRender {
    constructor(graph, svgWindow) {
        this.graph = graph;
        this.svgWindow = svgWindow;

        // Added after the grid, so everything draws on top of it.
        // Order matters: edges, then vertices, then labels on top.
        this.edgeLayer = svgWindow.viewport
            .append("g")
            .attr("class", "graph-edges");

        this.vertexLayer = svgWindow.viewport
            .append("g")
            .attr("class", "graph-vertices");

        this.labelLayer = svgWindow.viewport
            .append("g")
            .attr("class", "graph-labels");

        this.vertexDrag = this.createVertexDrag();

        this.render();
    }

    // ---------- data ----------

    getVertices() {
        return Array.from(this.graph.vertices.values());
    }

    getEdges() {
        return this.graph.edges;
    }

    // Adjust these to match your Edge class fields.
    getEdgeEnds(edge) {
        const a = edge.source ?? edge.from;
        const b = edge.target ?? edge.to;
        return { x1: a?.x ?? 0, y1: a?.y ?? 0, x2: b?.x ?? 0, y2: b?.y ?? 0 };
    }

    getEdgesTouching(vertex) {
        return this.getEdges().filter(edge =>
            (edge.source ?? edge.from) === vertex ||
            (edge.target ?? edge.to) === vertex
        );
    }

    // Text shown on a vertex. Adjust if your Vertex uses another field.
    getVertexLabel(vertex) {
        return vertex.id;
    }

    // ---------- drawing ----------

    render() {
        this.renderEdges();
        this.renderVertices();
        this.renderLabels();
    }

    renderEdges() {
        this.edgeLayer.selectAll("line")
            .data(this.getEdges())
            .join("line")
            .attr("class", "edge")
            .each((edge, i, elements) => this.positionEdge(edge, elements[i]));
    }

    renderVertices() {
        this.vertexLayer.selectAll("circle")
            .data(this.getVertices())
            .join("circle")
            .attr("class", "vertex")
            .attr("cx", vertex => vertex.x ?? 0)
            .attr("cy", vertex => vertex.y ?? 0)
            .call(this.vertexDrag);
    }

    renderLabels() {
        this.labelLayer.selectAll("text")
            .data(this.getVertices())
            .join("text")
            .attr("class", "vertex-label")
            .attr("x", vertex => vertex.x ?? 0)
            .attr("y", vertex => vertex.y ?? 0)
            .text(vertex => this.getVertexLabel(vertex));
    }

    // ---------- dragging ----------

    createVertexDrag() {
        return d3.drag()
            .on("start", (event, vertex) => {
                event.sourceEvent.stopPropagation(); // don't trigger panning
                d3.select(event.sourceEvent.target).classed("dragging", true);
            })
            .on("drag", (event, vertex) => {
                // Read the pointer directly in the viewport's own coordinate
                // space, so movement tracks the cursor correctly at any zoom level.
                const [x, y] = d3.pointer(event, this.svgWindow.viewport.node());
                vertex.x = x;
                vertex.y = y;
                this.updateVertexPosition(vertex);
            })
            .on("end", (event) => {
                d3.select(event.sourceEvent.target).classed("dragging", false);
            });
    }

    // Moves one vertex's circle, label and connected edges without
    // re-rendering the whole graph.
    updateVertexPosition(vertex) {
        this.vertexLayer.selectAll("circle")
            .filter(d => d === vertex)
            .attr("cx", vertex.x)
            .attr("cy", vertex.y);

        this.labelLayer.selectAll("text")
            .filter(d => d === vertex)
            .attr("x", vertex.x)
            .attr("y", vertex.y);

        this.edgeLayer.selectAll("line")
            .filter(edge => this.getEdgesTouching(vertex).includes(edge))
            .each((edge, i, elements) => this.positionEdge(edge, elements[i]));
    }

    positionEdge(edge, element) {
        const { x1, y1, x2, y2 } = this.getEdgeEnds(edge);
        d3.select(element)
            .attr("x1", x1).attr("y1", y1)
            .attr("x2", x2).attr("y2", y2);
    }

    // ---------- cleanup ----------

    destroy() {
        this.edgeLayer.remove();
        this.vertexLayer.remove();
        this.labelLayer.remove();
    }
}
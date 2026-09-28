// Draws a Graph's edges, vertices and labels into an SVGWindow.
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
            .each((edge, i, elements) => {
                const { x1, y1, x2, y2 } = this.getEdgeEnds(edge);
                d3.select(elements[i])
                    .attr("x1", x1).attr("y1", y1)
                    .attr("x2", x2).attr("y2", y2);
            });
    }

    renderVertices() {
        this.vertexLayer.selectAll("circle")
            .data(this.getVertices())
            .join("circle")
            .attr("class", "vertex")
            .attr("cx", vertex => vertex.x ?? 0)
            .attr("cy", vertex => vertex.y ?? 0);
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

    // ---------- cleanup ----------

    destroy() {
        this.edgeLayer.remove();
        this.vertexLayer.remove();
        this.labelLayer.remove();
    }
}
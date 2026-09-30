const GRID_SIZE = 50;
const FIT_PADDING = 50;
const SCALE_EXTENT = [0.1, 10];
const ZOOM_STEP = 1.2;
const GRID_PATTERN_ID = "graph-grid-pattern";

// Owns the SVG element, the grid, and zoom/pan. Mounts into a Container's
// content area and reads/subscribes to its Grid and Zoom on Focus state -
// it has no header or checkbox code of its own.
// Drawing the graph itself is done by GraphRender, which adds its layers
// to `viewport` so they move and scale together with the grid.
export class SVGWindow {
    // Layer structure:
    //   container.content
    //    └── svg (fixed size, no viewBox)
    //         └── g.viewport    <- d3.zoom writes its transform here
    //              ├── g.graph-grid
    //              └── ...layers added by GraphRender (edges, vertices)
    svg = d3.create("svg").attr("class", "graph-svg");

    viewport = this.svg.append("g").attr("class", "viewport");
    grid = this.viewport.append("g").attr("class", "graph-grid");

    constructor(graph, container) {
        this.graph = graph;
        this.container = container; // a Container instance

        this.zoomOnFocus = container.zoomOnFocus;

        SVGWindow.ensureGridPattern();
        this.drawGrid();
        this.grid.classed("hidden", !container.gridEnabled);

        this.setupZoom();
        this.setupCenterOnDoubleClick();

        // Stored so destroy() can remove exactly these listeners later.
        this.handleGridToggle = event => this.grid.classed("hidden", !event.detail);
        this.handleZoomFocusToggle = event => { this.zoomOnFocus = event.detail; };
        container.addEventListener("gridtoggle", this.handleGridToggle);
        container.addEventListener("zoomfocustoggle", this.handleZoomFocusToggle);

        // Attach after wiring everything up, so the SVG has a real size
        // when we fit the view.
        container.content.appendChild(this.svg.node());
        this.fitToVertices();
    }

    // ---------- helpers ----------

    getVertices() {
        return Array.from(this.graph.vertices.values());
    }

    // Bounding box of the current vertices, or null if there are none.
    getVertexBounds() {
        const vertices = this.getVertices();
        if (vertices.length === 0) { return null; }

        const xs = vertices.map(v => v.x ?? 0);
        const ys = vertices.map(v => v.y ?? 0);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        return {
            minX, maxX, minY, maxY,
            cx: (minX + maxX) / 2,
            cy: (minY + maxY) / 2,
        };
    }

    // ---------- zoom & pan ----------

    setupZoom() {
        let dragging = false;

        this.zoomBehavior = d3.zoom()
            .scaleExtent(SCALE_EXTENT)
            .filter(event =>
                // Wheel zoom is handled separately below, so it can honour
                // the "Zoom on Focus" checkbox instead of always using the pointer.
                event.button === 1 ||
                (event.button === 0 && event.ctrlKey)
            )
            .on("start", event => {
                if (event.sourceEvent) {
                    dragging = true;
                    this.svg.classed("panning", true);
                }
            })
            .on("zoom", event => {
                this.viewport.attr("transform", event.transform);
            })
            .on("end", () => {
                if (dragging) {
                    dragging = false;
                    this.svg.classed("panning", false);
                }
            });

        this.svg
            .call(this.zoomBehavior)
            .on("dblclick.zoom", null) // disable d3's own double-click zoom
            .on("wheel", event => this.handleWheel(event));
    }

    handleWheel(event) {
        event.preventDefault();

        const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
        const point = this.zoomOnFocus
            ? d3.pointer(event, this.svg.node())
            : this.getViewportCenter();

        this.zoomBehavior.scaleBy(this.svg, factor, point);
    }

    getViewportCenter() {
        const rect = this.svg.node().getBoundingClientRect();
        return [rect.width / 2, rect.height / 2];
    }

    zoomIn() {
        this.svg.transition().duration(200)
            .call(this.zoomBehavior.scaleBy, ZOOM_STEP);
    }

    zoomOut() {
        this.svg.transition().duration(200)
            .call(this.zoomBehavior.scaleBy, 1 / ZOOM_STEP);
    }

    // Choose a transform that shows all vertices (used on load and resetView).
    fitToVertices(animate = false) {
        const rect = this.svg.node().getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) { return; }

        const bounds = this.getVertexBounds();
        let transform = d3.zoomIdentity;

        if (bounds) {
            const boundsW = Math.max(bounds.maxX - bounds.minX + 2 * FIT_PADDING, 100);
            const boundsH = Math.max(bounds.maxY - bounds.minY + 2 * FIT_PADDING, 100);

            const k = Math.min(
                Math.max(
                    Math.min(rect.width / boundsW, rect.height / boundsH),
                    SCALE_EXTENT[0]
                ),
                SCALE_EXTENT[1]
            );

            transform = d3.zoomIdentity
                .translate(rect.width / 2 - k * bounds.cx, rect.height / 2 - k * bounds.cy)
                .scale(k);
        }

        const target = animate ? this.svg.transition().duration(300) : this.svg;
        target.call(this.zoomBehavior.transform, transform);
    }

    // Re-centers on the vertices' bounding box without changing the current
    // zoom level, regardless of how far the view has been panned.
    centerView(animate = true) {
        const rect = this.svg.node().getBoundingClientRect();
        const bounds = this.getVertexBounds();
        if (rect.width === 0 || rect.height === 0 || !bounds) { return; }

        const k = d3.zoomTransform(this.svg.node()).k;
        const transform = d3.zoomIdentity
            .translate(rect.width / 2 - k * bounds.cx, rect.height / 2 - k * bounds.cy)
            .scale(k);

        const target = animate ? this.svg.transition().duration(300) : this.svg;
        target.call(this.zoomBehavior.transform, transform);
    }

    resetView() {
        this.fitToVertices(true);
    }

    setupCenterOnDoubleClick() {
        this.svg.on("dblclick.center", () => this.centerView(true));
    }

    // ---------- grid ----------

    // The pattern lives in one shared, hidden SVG so every SVGWindow can
    // reference it by id (its appearance is defined in styles.css).
    static ensureGridPattern() {
        if (document.getElementById(GRID_PATTERN_ID)) { return; }

        d3.select(document.body)
            .append("svg")
            .attr("class", "graph-defs")
            .attr("aria-hidden", "true")
            .append("defs")
            .append("pattern")
            .attr("id", GRID_PATTERN_ID)
            .attr("width", GRID_SIZE)
            .attr("height", GRID_SIZE)
            .attr("patternUnits", "userSpaceOnUse")
            .append("path")
            .attr("class", "grid-line")
            .attr("d", `M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`);
    }

    drawGrid() {
        this.grid.append("rect")
            .attr("class", "grid-background")
            .attr("x", -100000)
            .attr("y", -100000)
            .attr("width", 200000)
            .attr("height", 200000);
    }

    // ---------- accessors ----------

    getElement() { return this.svg.node(); }
    getSelection() { return this.svg; }

    destroy() {
        this.container.removeEventListener("gridtoggle", this.handleGridToggle);
        this.container.removeEventListener("zoomfocustoggle", this.handleZoomFocusToggle);
        this.svg.on(".zoom", null).on("wheel", null);
        this.svg.remove();
    }
}
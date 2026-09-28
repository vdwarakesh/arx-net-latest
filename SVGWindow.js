const GRID_SIZE = 50;
const FIT_PADDING = 50;
const SCALE_EXTENT = [0.1, 10];
const ZOOM_STEP = 1.2;
const GRID_PATTERN_ID = "graph-grid-pattern";

export class SVGWindow {
    svg = d3.create("svg").attr("class", "graph-svg");

    viewport = this.svg.append("g").attr("class", "viewport");
    grid = this.viewport.append("g").attr("class", "graph-grid");

    constructor(graph, container) {
        this.graph = graph;
        this.container =
            typeof container === "string"
                ? document.querySelector(container)
                : container;

        if (!this.container) {
            throw new Error("SVGWindow container not found.");
        }

        SVGWindow.ensureGridPattern();
        this.drawGrid();
        this.setupZoom();

        // Attach first so the SVG has a real size when we fit the view.
        this.container.appendChild(this.svg.node());
        this.fitToVertices();
    }

    // ---------- helpers ----------

    getVertices() {
        return Array.from(this.graph.vertices.values());
    }

    // ---------- zoom & pan ----------

    setupZoom() {
        let dragging = false;

        this.zoomBehavior = d3.zoom()
            .scaleExtent(SCALE_EXTENT)
            .filter(event =>
                event.type === "wheel" ||
                event.button === 1 ||
                (event.button === 0 && event.ctrlKey)
            )
            .on("start", event => {
                if (event.sourceEvent && event.sourceEvent.type !== "wheel") {
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
            .on("dblclick.zoom", null); // disable double-click zoom
    }

    zoomIn() {
        this.svg.transition().duration(200)
            .call(this.zoomBehavior.scaleBy, ZOOM_STEP);
    }

    zoomOut() {
        this.svg.transition().duration(200)
            .call(this.zoomBehavior.scaleBy, 1 / ZOOM_STEP);
    }

    // Choose a transform that shows all vertices.
    fitToVertices(animate = false) {
        const rect = this.svg.node().getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) { return; }

        const vertices = this.getVertices();
        let transform = d3.zoomIdentity;

        if (vertices.length > 0) {
            const xs = vertices.map(v => v.x ?? 0);
            const ys = vertices.map(v => v.y ?? 0);
            const minX = Math.min(...xs) - FIT_PADDING;
            const maxX = Math.max(...xs) + FIT_PADDING;
            const minY = Math.min(...ys) - FIT_PADDING;
            const maxY = Math.max(...ys) + FIT_PADDING;

            const boundsW = Math.max(maxX - minX, 100);
            const boundsH = Math.max(maxY - minY, 100);
            const cx = (minX + maxX) / 2;
            const cy = (minY + maxY) / 2;

            const k = Math.min(
                Math.max(
                    Math.min(rect.width / boundsW, rect.height / boundsH),
                    SCALE_EXTENT[0]
                ),
                SCALE_EXTENT[1]
            );

            transform = d3.zoomIdentity
                .translate(rect.width / 2 - k * cx, rect.height / 2 - k * cy)
                .scale(k);
        }

        const target = animate
            ? this.svg.transition().duration(300)
            : this.svg;
        target.call(this.zoomBehavior.transform, transform);
    }

    resetView() {
        this.fitToVertices(true);
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
        this.svg.on(".zoom", null);
        this.svg.remove();
    }
}
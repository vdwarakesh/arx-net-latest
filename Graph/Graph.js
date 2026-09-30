import { Vertex } from "./Vertex.js";
import { Edge } from "./Edge.js";
import { Container } from "../Container.js";
import { SVGWindow } from "../SVGWindow.js";
import { GraphRender } from "./GraphRender.js";

const MIN_CIRCLE_RADIUS = 100;
const VERTEX_SPACING = 80; // straight-line distance between neighbouring vertices

// A Graph IS a Container (and therefore an HTMLElement), so it goes on the
// page the normal DOM way:
//
//   const graph = new Graph();
//   graph.createVertex("a", []);
//   document.body.appendChild(graph);
//
// There's no separate render()/mount() call. connectedCallback() is the
// standard custom-element lifecycle hook that the browser calls the moment
// an element is actually inserted into the document - that's where the
// vertex layout and the SVG rendering get built.
export class Graph extends Container {
    constructor() {
        super();
        this.vertices = new Map();
        this.edges = [];
        this.svgWindow = null;
        this.graphRender = null;
    }

    createVertex(id, connections = []) {
        const vertex = new Vertex(id);
        this.vertices.set(id, vertex);
        for (const connectionId of connections) {
            const target = this.vertices.get(connectionId);
            if (target) {
                this.edges.push(new Edge(vertex, target));
            }
        }
        return vertex;
    }

    // Places every vertex evenly on a circle centred on (0, 0).
    // The circle grows with the vertex count so neighbours never overlap.
    rearrangeVerticesInCircle() {
        const vertices = Array.from(this.vertices.values());
        const count = vertices.length;
        if (count === 0) { return; }

        if (count === 1) {
            vertices[0].x = 0;
            vertices[0].y = 0;
            return;
        }

        // Chord between neighbours = 2 * r * sin(PI / count), solved for r.
        const radius = Math.max(
            MIN_CIRCLE_RADIUS,
            VERTEX_SPACING / (2 * Math.sin(Math.PI / count))
        );

        vertices.forEach((vertex, i) => {
            // Start at the top (-PI / 2) and go clockwise.
            const angle = -Math.PI / 2 + (2 * Math.PI * i) / count;
            vertex.x = radius * Math.cos(angle);
            vertex.y = radius * Math.sin(angle);
        });
    }

    // Called by the browser when this element is inserted into the
    // document (e.g. by appendChild). Guarded so re-inserting an
    // already-built graph elsewhere in the page doesn't rebuild it.
    connectedCallback() {
        if (this.svgWindow) { return; }

        this.rearrangeVerticesInCircle();
        this.svgWindow = new SVGWindow(this, this);
        this.graphRender = new GraphRender(this, this.svgWindow);
    }
}

customElements.define("graph-view", Graph);
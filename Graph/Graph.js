import { Vertex } from "./Vertex.js";
import { Edge } from "./Edge.js";
import { SVGWindow } from "../SVGWindow.js";
import { GraphRender } from "./GraphRender.js";

const MIN_CIRCLE_RADIUS = 100;
const VERTEX_SPACING = 80; // straight-line distance between neighbouring vertices

export class Graph {
    static idCounter = 0; // Keep track of how many graphs are created

    constructor() {
        this.vertices = new Map();
        this.edges = [];
        this.svgWindow = null;
        this.graphRender = null;

        // Generate a unique ID and create the container div automatically
        Graph.idCounter++;
        this.containerId = `graph-container-${Graph.idCounter}`;
        this.container = document.createElement("div");
        this.container.id = this.containerId;
        this.container.classList.add("graph-container");

        document.body.appendChild(this.container);
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

    render() {
        this.rearrangeVerticesInCircle(); // before the window fits its view
        this.svgWindow = new SVGWindow(this, this.container);
        this.graphRender = new GraphRender(this, this.svgWindow);
        return this.graphRender;
    }
}
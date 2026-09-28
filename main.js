import { Graph } from "./Graph/Graph.js";

const graph = new Graph();
console.log("Created graph")

graph.createVertex("A");
graph.createVertex("B", ["A"]);
graph.createVertex("C", ["A"]);
graph.createVertex("D", ["B"]);
graph.createVertex("E", ["B"]);
graph.createVertex("F", ["C"]);

// Call render without passing a container string
graph.render();
console.log(graph)
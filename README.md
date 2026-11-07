# Shard Spiral 
*Trace It. Change It. Understand It.*

A next-generation, mobile-first algorithm visualization platform.

Unlike traditional visualizers that rely on hardcoded animations, this platform runs **actual code in the browser**, tracing execution step-by-step using a custom AST-aware runtime. It doesn't just show you how algorithms work. It lets you step into the code, make decisions at runtime, and steer the traversal interactively.

---

## Features

* **Wide Range of Algorithms & Data Structures:** Supports everything from simple Array operations (Linear/Binary Search, Sorting) to complex Graph and Tree algorithms (BFS, DFS, Dijkstra's, Kruskal's, Max Flow).
* **Auto & Manual Execution Modes:**
* **Auto Mode:** Watch the algorithm run step-by-step with synchronized code highlighting, dynamic canvas updates, and real-time state variable tracking.
* **Manual Mode (Interactive Sandbox):** The visualization actually pauses mid-execution at critical decision points (e.g., "Which neighbor should BFS explore next?"). Click a node or edge on the canvas to feed your choice back into the running code!

* **Mobile-First Design:** Algorithms shouldn't be confined to a desktop. The UI is completely responsive, allowing you to learn, visualize, and revise data structures on the fly directly from your phone.
* **Live State Variables & Explanations:** As the code executes, all local variables, arrays, sets, and queues are tracked automatically and displayed in a clean UI. Node IDs are automatically translated into human-readable canvas labels.
* **Time-Travel Debugging:** Step forwards, step backwards, or drag the slider to instantly rewind the simulation. Made a bad choice in Manual Mode? Just step back and pick a different edge!

---

## How It's Different from Other Visualizers

Most algorithm visualizers are basically static animations. They run a JavaScript simulation, record an array of UI changes, and play them back. **We don't do that.**

1. **True Code Execution:** We run real Python using a Pyodide Web Worker. The code you see on the screen is exactly what is executing.
2. **Zero-Hardcoding Generic Tracer:** Our tracer doesn't look for specific variable names like `queue` or `visited`. Instead, it intercepts language-level operations (like `__getitem__` on arrays or `__iter__` on graph neighbors) and uses Python AST parsing to track state. This means it scales to *any* algorithm or coding style automatically.
3. **Interactive Decision Making:** Because we control the Python execution thread, we can pause it synchronously. This allows for real-time evaluation and targeted visualization. You aren't just watching BFS; you are *guiding* it.

---

## Technical Architecture

* **Frontend:** Vanilla JS, HTML, CSS with highly optimized HTML5 Canvas rendering for Graphs, Trees, and Arrays.
* **Execution Engine:** Web Workers running Pyodide (WASM Python).
* **The Tracer Engine (`Pyodide Worker`):**
* Uses `sys.settrace` to monitor line-by-line execution.
* Implements `VisualGraph` and `VisualSequence` proxy objects to intercept array indexing, loop variable assignments, and graph edge traversals.
* Pauses via custom exceptions (`_WaitForUserChoice`) to request user input from the main UI thread before resolving tie-breakers or loops.

* Universal Auto-Detect Parser: Feed it data in almost any format  or rapid compact shorthand without worrying about syntax errors or language boilerplate. It instantly parses, validates, and visualizes your input so you spend zero time formatting and 100% of your time learning.

* Smart Test-Case Generator (Coming Soon): Spin up tailored test environments with a single click. Configure targeted scenarios on the fly-from pre-sorted or reverse arrays for edge-case sorting to custom graph topologies (sparse, dense, cyclic, or guaranteed connected)-to stress-test algorithms and spot performance trade-offs instantly.

---

## Project Status: What's Done & What's Next

### What We've Accomplished So Far

* **Core Architecture:** Web Worker setup, Pyodide initialization, and cross-thread communication.
* **The Generic Tracer:** Built the AST-parsing tracer that tracks variables, scopes, recursive calls, and future-accesses (to perfectly color-code "finished" vs "active" nodes without hardcoding).
* **Data Structure Rendering:**
* **Arrays:** Dynamic bars, active indices, pointers.
* **Graphs:** Configurable layouts, physics/rendering engine, directional/bidirectional edges, weight pills, active/visited state coloring.

* **Playback Controls:** Play, pause, speed control, and robust step-by-step rewinding.
* **Auto/Manual Modes:** Successfully implemented the core loop interception so algorithms pause and let users click the canvas to choose the next branch.
* **Base Algorithms Implemented:** Linear Search, Breadth-First Search (BFS), Recursive Depth-First Search (DFS).

### What Remains (Roadmap)

* **Algorithm Expansion:** Adding advanced graph algorithms (Dijkstra's Shortest Path, Prim's/Kruskal's MST, Bellman-Ford, Edmonds-Karp Max Flow) and Array algorithms (Sorting, Two-Pointer, Binary Search).
* **Evaluation / Quiz Mode:** Expanding "Manual Mode" into a test environment where users are asked to click the *correct* next step (e.g., "Click the node Dijkstra's will settle next") and receive instant feedback.
* **Additional Data Structures:** Implementing Canvas rendering for generic Binary Trees, Heaps, Linked Lists, and 2D Grids/Matrices.
* **Code Editor / User Scripts:** Allowing users to write their *own* Python code in the browser and watch our generic tracer visualize it on the data structures automatically.
* **User Accounts & Progress:** Tracking which algorithms a user has mastered, saving custom graph inputs, and syncing progress.

---

*Built for students, educators, and developers to make algorithm mastery interactive, accessible, and deeply intuitive.*

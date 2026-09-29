// Generic visualization shell: an outer box with a header (Grid / Zoom on
// Focus checkboxes) and a content area for a renderer (SVGWindow, etc.) to
// mount into. Knows nothing about graphs, trees, or any specific drawing -
// any visualization type can reuse it by constructing one and reading its
// content element, initial state, and toggle events.
export class Container {
    static idCounter = 0;

    constructor() {
        Container.idCounter++;
        this.id = `viz-container-${Container.idCounter}`;

        this.gridEnabled = true;
        this.zoomOnFocus = false;
        this.gridToggleListeners = [];
        this.zoomFocusToggleListeners = [];

        this.element = document.createElement("div");
        this.element.id = this.id;
        this.element.className = "viz-container";

        this.header = document.createElement("div");
        this.header.className = "viz-header";
        this.element.appendChild(this.header);

        this.content = document.createElement("div");
        this.content.className = "viz-content";
        this.element.appendChild(this.content);

        this.createCheckboxOption("Grid", this.gridEnabled, checked => {
            this.gridEnabled = checked;
            this.gridToggleListeners.forEach(listener => listener(checked));
        });

        this.createCheckboxOption("Zoom on Focus", this.zoomOnFocus, checked => {
            this.zoomOnFocus = checked;
            this.zoomFocusToggleListeners.forEach(listener => listener(checked));
        });

        document.body.appendChild(this.element);
    }

    // ---------- header ----------

    createCheckboxOption(labelText, defaultChecked, onChange) {
        const label = document.createElement("label");
        label.className = "viz-header-option";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = defaultChecked;
        checkbox.addEventListener("change", () => onChange(checkbox.checked));

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(labelText));
        this.header.appendChild(label);

        return checkbox;
    }

    // ---------- subscriptions ----------
    // Consumers read gridEnabled / zoomOnFocus for the initial state, then
    // subscribe here to react to later changes.

    onGridToggle(listener) {
        this.gridToggleListeners.push(listener);
    }

    onZoomFocusToggle(listener) {
        this.zoomFocusToggleListeners.push(listener);
    }

    // ---------- cleanup ----------

    destroy() {
        this.element.remove();
    }
}
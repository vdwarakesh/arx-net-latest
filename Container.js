const TAG_NAME = "viz-container";
export class Container extends HTMLElement {
    constructor() {
        super();
        this.classList.add("viz-container");

        this.gridEnabled = true;
        this.zoomOnFocus = false;

        this.header = document.createElement("div");
        this.header.className = "viz-header";
        this.appendChild(this.header);

        this.content = document.createElement("div");
        this.content.className = "viz-content";
        this.appendChild(this.content);

        this.createCheckboxOption("Grid", this.gridEnabled, checked => {
            this.gridEnabled = checked;
            this.dispatchEvent(new CustomEvent("gridtoggle", { detail: checked }));
        });

        this.createCheckboxOption("Zoom on Focus", this.zoomOnFocus, checked => {
            this.zoomOnFocus = checked;
            this.dispatchEvent(new CustomEvent("zoomfocustoggle", { detail: checked }));
        });
    }

    // ---------- header ----------

    createCheckboxOption(labelText, isChecked, onChange) {
        const label = document.createElement("label");
        label.className = "viz-header-option";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = isChecked;
        checkbox.addEventListener("change", () => onChange(checkbox.checked));

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(labelText));
        this.header.appendChild(label);

        return checkbox;
    }
}

customElements.define(TAG_NAME, Container);
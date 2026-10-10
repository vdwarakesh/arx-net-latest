// ============================================================
// CONTAINER
// Represents one draggable/focusable "object" box built from the
// #container-template in layout.html: its DOM, its focus button (with
// its hover tooltip), and its double-click-to-rename behavior.
// Naming/rename-conflict logic lives in ContainerRegistry.js — this
// class just asks for it.
//
// There is deliberately no delete button or delete-click binding here.
// The delete mechanism itself is fully intact and reusable though:
// ContainerRegistry.confirmDelete(container, onConfirmed) shows the
// confirmation modal and removes the name from the registry, and
// ViewManager.deleteContainer(containerElement) handles the DOM/view
// side. Wiring a future delete trigger (wherever it lives) is just:
//   registry.confirmDelete(containerInstance,
//       () => viewManager.deleteContainer(containerInstance.element));
// ============================================================

import { HoverPopover } from './HoverPopover.js';

export class Container {
    /**
     * @param {string} name - desired name (registry will dedupe it)
     * @param {import('./ContainerRegistry.js').ContainerRegistry} registry
     * @param {(containerElement: HTMLElement) => void} onFocusRequest - called when the focus button is clicked
     */
    constructor(name, registry, onFocusRequest) {
        this.registry = registry;
        this.name = registry.getUniqueName(name);
        this.element = this._createDOM(onFocusRequest);
    }

    _createDOM(onFocusRequest) {
        const template = document.getElementById('container-template');
        const clone = template.content.cloneNode(true);
        const containerEl = clone.querySelector('.container');
        const titleEl = clone.querySelector('.container-title');
        const focusBtn = containerEl.querySelector('.focus-btn');

        titleEl.textContent = this.name;

        focusBtn.addEventListener('click', () => onFocusRequest(containerEl));

        // Small hover tooltip, same component the sidebar icons use —
        // passed the element directly since a template-cloned icon has no
        // id to target by. Automatically hidden on mobile (see HoverPopover.js).
        new HoverPopover(focusBtn, 'Focus', null);

        // Double-click the title to rename inline
        titleEl.addEventListener('dblclick', () => this._beginRename(titleEl));

        return containerEl;
    }

    _beginRename(titleEl) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'rename-input';
        input.value = this.name;
        titleEl.replaceWith(input);
        input.focus();
        input.select();

        let isFinished = false;

        const finishEdit = () => {
            if (isFinished) return;
            isFinished = true;
            const newName = input.value.trim();
            input.replaceWith(titleEl);

            if (newName && newName !== this.name) {
                this.registry.attemptRename(this, newName);
            }
        };

        input.addEventListener('blur', finishEdit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') input.blur();
            if (e.key === 'Escape') {
                input.value = this.name;
                input.blur();
            }
        });
    }
}
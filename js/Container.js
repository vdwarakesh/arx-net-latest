// ============================================================
// CONTAINER
// Represents one draggable/focusable "object" box built from the
// #container-template in layout.html: its DOM, its focus/delete
// buttons (with their hover tooltips), and its double-click-to-rename
// behavior. Naming/rename-conflict/delete-confirmation logic itself
// lives in ContainerRegistry.js — this class just asks for it.
// ============================================================

import { HoverPopover } from './HoverPopover.js';

export class Container {
    /**
     * @param {string} name - desired name (registry will dedupe it)
     * @param {import('./ContainerRegistry.js').ContainerRegistry} registry
     * @param {(containerElement: HTMLElement) => void} onFocusRequest - called when the focus button is clicked
     * @param {(containerElement: HTMLElement) => void} onDeleteRequest - called after the delete confirmation modal is accepted
     */
    constructor(name, registry, onFocusRequest, onDeleteRequest) {
        this.registry = registry;
        this.name = registry.getUniqueName(name);
        this.element = this._createDOM(onFocusRequest, onDeleteRequest);
    }

    _createDOM(onFocusRequest, onDeleteRequest) {
        const template = document.getElementById('container-template');
        const clone = template.content.cloneNode(true);
        const containerEl = clone.querySelector('.container');
        const titleEl = clone.querySelector('.container-title');
        const focusBtn = containerEl.querySelector('.focus-btn');
        const deleteBtn = containerEl.querySelector('.delete-btn');

        titleEl.textContent = this.name;

        focusBtn.addEventListener('click', () => onFocusRequest(containerEl));

        // Confirmation happens in the registry (it owns registry state);
        // onDeleteRequest only runs if the user actually confirms, and is
        // where the DOM/view-state side of deletion happens (ViewManager).
        deleteBtn.addEventListener('click', () => {
            this.registry.confirmDelete(this, () => onDeleteRequest(containerEl));
        });

        // Small hover tooltips, same component the sidebar icons use —
        // passed the element directly since a template-cloned icon has no
        // id to target by. Automatically hidden on mobile (see HoverPopover.js).
        new HoverPopover(focusBtn, 'Focus', null);
        new HoverPopover(deleteBtn, 'Delete', null);

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
// ============================================================
// CONTAINER REGISTRY & NAMING
// Single source of truth for "which names are taken". Owns the
// Container name -> Container map, unique-name generation, and the
// rename-conflict ("Force Rename") modal workflow.
// If a container ends up with the wrong name, or renaming misbehaves,
// check here first.
// ============================================================

import { FloatingWindow } from './FloatingWindow.js';

export class ContainerRegistry {
    constructor() {
        this.containers = new Map();
        this.warningModal = new FloatingWindow('Name Conflict', 'min(50rem, 95vw)', 'auto');
    }

    get size() {
        return this.containers.size;
    }

    has(name) {
        return this.containers.has(name);
    }

    get(name) {
        return this.containers.get(name);
    }

    set(name, container) {
        this.containers.set(name, container);
    }

    delete(name) {
        this.containers.delete(name);
    }

    keys() {
        return this.containers.keys();
    }

    // Returns a unique name, appending _1, _2, ... if needed
    getUniqueName(desiredName) {
        if (!this.containers.has(desiredName)) return desiredName;
        let counter = 1;
        while (this.containers.has(`${desiredName}_${counter}`)) {
            counter++;
        }
        return `${desiredName}_${counter}`;
    }

    // Updates name, DOM label, and map entry. Does not remove any old map entry.
    _setContainerName(container, newName) {
        container.name = newName;
        container.element.querySelector('.container-title').textContent = newName;
        this.containers.set(newName, container);
    }

    // Normal rename: removes the old map entry, then sets the new one
    _executeRename(container, newName) {
        this.containers.delete(container.name);
        this._setContainerName(container, newName);
    }

    // Entry point used by Container when the user finishes an inline rename.
    // Either renames immediately, or opens the conflict modal if the name is taken.
    attemptRename(container, desiredName) {
        if (!this.containers.has(desiredName)) {
            this._executeRename(container, desiredName);
            return;
        }

        this.warningModal.setContent(`
            <div class="modal-form">
                <p>The name <strong>"${desiredName}"</strong> is already in use by another container.</p>
                <p>If you force this rename, the existing container will be automatically renamed.</p>
                <div class="modal-actions">
                    <button class="btn btn-secondary" id="warn-cancel">Cancel</button>
                    <button class="btn btn-danger" id="warn-force">Force Rename</button>
                </div>
            </div>
        `);
        this.warningModal.open();

        this.warningModal.overlay.querySelector('#warn-cancel').onclick = () => {
            this.warningModal.close();
        };

        this.warningModal.overlay.querySelector('#warn-force').onclick = () => {
            this.warningModal.close();

            const requester = container;
            const existing = this.containers.get(desiredName);

            // Free the requester's old name so it can be reused as a displaced slot
            this.containers.delete(requester.name);

            // Pick the next free name for the displaced container (e.g. Graph -> Graph_1)
            const forcedName = this.getUniqueName(desiredName);

            // Move the displaced container and give the requested name to the requester
            this.containers.delete(desiredName);
            this._setContainerName(existing, forcedName);
            this._setContainerName(requester, desiredName);
        };
    }
}

// ============================================================
// CONTAINER REGISTRY & NAMING
// Single source of truth for "which names are taken". Owns the
// Container name -> Container map, unique-name generation, the
// rename-conflict ("Force Rename") modal workflow, the delete
// confirmation workflow, and a small onChange subscription so other
// modules (e.g. ViewManager's mobile name list) can stay in sync
// without the registry needing to know who's listening.
// If a container ends up with the wrong name, or renaming or deleting
// misbehaves, check here first.
// ============================================================

import { FloatingWindow } from './FloatingWindow.js';

export class ContainerRegistry {
    constructor() {
        this.containers = new Map();
        this.warningModal = new FloatingWindow('Name Conflict', 'min(50rem, 95vw)', 'auto');
        // Separate instance from warningModal — different content/buttons,
        // and keeping them distinct avoids one workflow's leftover button
        // handlers ever firing for the other.
        this.deleteModal = new FloatingWindow('Delete Object', 'min(50rem, 95vw)', 'auto');
        this._changeListeners = [];
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
        this._notifyChange();
    }

    delete(name) {
        this.containers.delete(name);
        this._notifyChange();
    }

    keys() {
        return this.containers.keys();
    }

    // Returns names sorted the way they should read to a person (numeric-aware,
    // case-insensitive), so "Graph_2" sorts before "Graph_10".
    getSortedNames() {
        return [...this.containers.keys()].sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
        );
    }

    // Shared markup for "jump to this container" buttons — used by both the
    // desktop hover popover (sidebarPopovers.js) and the mobile name list
    // (ViewManager.renderMobileList), so both always agree on naming/order.
    // Clicking a button here is handled by AppController's delegated
    // .list-jump-btn click listener, not by anything in this class.
    renderJumpButtonsHTML() {
        return this.getSortedNames()
            .map(name => `<button class="popover-btn list-jump-btn" data-name="${name}">${name}</button>`)
            .join('');
    }

    // Subscribe to be notified whenever a name is added, removed, or renamed.
    onChange(callback) {
        this._changeListeners.push(callback);
    }

    _notifyChange() {
        this._changeListeners.forEach(callback => callback());
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
        this._notifyChange();
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

    // Entry point used by Container when its delete icon is clicked. Shows
    // a confirmation modal; only removes the name from the registry (and
    // notifies subscribers) if the user actually confirms. The caller
    // (ViewManager, via the onConfirmed callback) is responsible for
    // removing the container's DOM element and any view-state cleanup —
    // this class only owns naming/registry state, never the DOM.
    confirmDelete(container, onConfirmed) {
        this.deleteModal.setContent(`
            <div class="modal-form">
                <p>Delete <strong>"${container.name}"</strong>? This removes the container and everything inside it. This can't be undone.</p>
                <div class="modal-actions">
                    <button class="btn btn-secondary" id="delete-cancel">Cancel</button>
                    <button class="btn btn-danger" id="delete-confirm">Delete</button>
                </div>
            </div>
        `);
        this.deleteModal.open();

        this.deleteModal.overlay.querySelector('#delete-cancel').onclick = () => {
            this.deleteModal.close();
        };

        this.deleteModal.overlay.querySelector('#delete-confirm').onclick = () => {
            this.deleteModal.close();
            this.delete(container.name);
            onConfirmed();
        };
    }
}
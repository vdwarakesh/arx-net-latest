// ============================================================
// VIEW MANAGEMENT (Grid vs Focused) + CONTAINER CREATION
// Owns the #multi-view / #focused-view toggle, which container is
// currently focused, and the two creation modals (pick type -> name it).
// If a container won't focus, the grid/focused toggle is stuck, or the
// "New" button's modals misbehave, check here.
// ============================================================

import { FloatingWindow } from './FloatingWindow.js';
import { Container } from './Container.js';

export class ViewManager {
    constructor(registry) {
        this.registry = registry;

        this.btnNew = document.getElementById('btn-new');
        this.btnList = document.getElementById('btn-list');
        this.multiView = document.getElementById('multi-view');
        this.focusedView = document.getElementById('focused-view');
        this.focusedSlot = document.getElementById('focused-container-slot');

        this.currentFocused = null;
        this.lastFocused = null;

        this.gridPlaceholder = document.createElement('div');
        this.gridPlaceholder.style.display = 'none';

        // Bind so it can be handed to Container instances and to AppController as a callback
        this.focusContainer = this.focusContainer.bind(this);

        this.pickTypeModal = new FloatingWindow('Create New', 'min(50rem, 90vw)', 'auto');
        this.pickTypeModal.setContent(`
            <div class="modal-form">
                <p style="margin-bottom: 0.5rem; font-size: 0.95rem;">Select the type of object to create:</p>
                <button class="btn btn-secondary" id="pick-graph" style="width: 100%; text-align: left;">Graph</button>
                <button class="btn btn-secondary" id="pick-tree" style="width: 100%; text-align: left;">Tree</button>
            </div>
        `);
        this.pickTypeModal.overlay.querySelector('#pick-graph').addEventListener('click', () => {
            this.pickTypeModal.close();
            this.openCreationModal('Graph');
        });
        this.pickTypeModal.overlay.querySelector('#pick-tree').addEventListener('click', () => {
            this.pickTypeModal.close();
            this.openCreationModal('Tree');
        });

        this.creationModal = new FloatingWindow('Create Object', 'min(50rem, 95vw)', 'auto');

        this.btnNew.addEventListener('click', () => this.openPickTypeModal());
        this.btnList.addEventListener('click', () => this.toggleList());
    }

    createNewContainer(name = 'Object') {
        const container = new Container(name, this.registry, this.focusContainer);
        this.registry.set(container.name, container);
        this.multiView.appendChild(container.element);
        this.focusContainer(container.element);
        return container;
    }

    focusContainer(containerElement) {
        if (this.currentFocused) {
            this.gridPlaceholder.replaceWith(this.currentFocused);
        }

        containerElement.replaceWith(this.gridPlaceholder);
        this.focusedSlot.appendChild(containerElement);

        this.currentFocused = containerElement;
        this.lastFocused = containerElement;

        this.multiView.classList.add('hidden');
        this.focusedView.classList.remove('hidden');
    }

    toggleList() {
        if (this.registry.size === 0) return;

        const isCurrentlyList = !this.multiView.classList.contains('hidden');

        if (isCurrentlyList) {
            if (!this.lastFocused) return;
            this.focusContainer(this.lastFocused);
        } else {
            if (this.currentFocused) {
                this.gridPlaceholder.replaceWith(this.currentFocused);
                this.currentFocused = null;
            }
            this.multiView.classList.remove('hidden');
            this.focusedView.classList.add('hidden');
        }
    }

    openPickTypeModal() {
        this.pickTypeModal.open();
    }

    openCreationModal(type) {
        const defaultName = this.registry.getUniqueName(type);
        this.creationModal.overlay.querySelector('.modal-header span').textContent = `Create ${type}`;

        this.creationModal.setContent(`
            <div class="modal-form">
                <label>Container Name:</label>
                <input type="text" class="modal-input" id="create-name" value="${defaultName}">
                <div class="modal-actions">
                    <button class="btn btn-primary" id="create-confirm">Create</button>
                </div>
            </div>
        `);
        this.creationModal.open();

        const nameInput = this.creationModal.overlay.querySelector('#create-name');

        const confirmCreate = () => {
            const finalName = nameInput.value.trim() || type;
            this.createNewContainer(finalName);
            this.creationModal.close();
        };

        this.creationModal.overlay.querySelector('#create-confirm').onclick = confirmCreate;

        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmCreate();
            }
        });

        setTimeout(() => nameInput.focus(), 100);
    }
}

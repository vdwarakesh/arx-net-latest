// ============================================================
// VIEW MANAGEMENT (Grid vs Focused) + CONTAINER CREATION
// Owns the #multi-view / #focused-view toggle, which container is
// currently focused, and the two creation modals (pick type -> name it).
// If a container won't focus, the grid/focused toggle is stuck, or the
// "New" button's modals misbehave, check here.
//
// Also owns the mobile-only name list (.mobile-object-list) prepended
// inside #multi-view: list -> container 1 -> container 2 -> ... .
// It's invisible on desktop (see css/views.css) since the sidebar's
// hover popover already covers that case there. If names are missing,
// stale, or out of order in that mobile list, check renderMobileList()
// below and the "onChange" wiring at the bottom of the constructor.
//
// Also keeps the "Object metadata" card (#metadataCard, static markup
// in layout.html) in sync with whichever container is currently
// focused — see _updateMetadata() and focusContainer() below.
//
// Also toggles #empty-state vs. (#focused-container-slot + .algorithm):
// with nothing focused, #focused-view shows the "Arx Net" empty state
// instead of two empty/irrelevant panes. See _showEmptyState() /
// _showFocusedContent() below.
//
// Also handles the DOM/view-state side of deleting a container (the
// registry side — confirmation + removing it from the name map — is
// ContainerRegistry's job). See deleteContainer() below.
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
        this.algorithm = document.getElementById('algorithm');
        this.emptyState = document.getElementById('empty-state');
        this.metadataCard = document.getElementById('metadataCard');
        this.metadataNameValue = document.getElementById('metadata-name-value');

        this.currentFocused = null;
        this.lastFocused = null;

        // Nothing is focused yet — #focused-view is visible by default
        // (before anything's been created), so start on the empty state
        // rather than showing two empty/irrelevant panes.
        this._showEmptyState();

        this.gridPlaceholder = document.createElement('div');
        this.gridPlaceholder.style.display = 'none';

        // Mobile-only list of names, kept as the first child of #multi-view
        // so it always renders above the containers that follow it.
        this.mobileListEl = document.createElement('div');
        this.mobileListEl.className = 'mobile-object-list';
        this.multiView.prepend(this.mobileListEl);

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
        // These buttons are set once here and never rebuilt, so they can be
        // wired directly instead of through document-level delegation.
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

        // Keep the mobile list, and the metadata card's displayed name, in
        // sync with every add/rename the registry sees — not just the ones
        // that happen to go through createNewContainer below (a rename
        // happens entirely inside ContainerRegistry, for example, including
        // while the renamed container is the one currently focused).
        this.registry.onChange(() => {
            this.renderMobileList();
            this._refreshMetadataIfFocused();
        });
    }

    createNewContainer(name = 'Object') {
        const container = new Container(
            name,
            this.registry,
            this.focusContainer,
            (containerElement) => this.deleteContainer(containerElement)
        );
        this.registry.set(container.name, container);
        this.multiView.appendChild(container.element);
        this.focusContainer(container.element);
        return container;
    }

    // Runs only after the user confirms in ContainerRegistry's delete
    // modal (the registry has already removed the name by this point).
    // .remove() takes the container and everything inside it with it,
    // regardless of whether it currently lives in the grid or the
    // focused slot — no gridPlaceholder bookkeeping needed either way,
    // since there's a single reused placeholder node (see focusContainer)
    // that simply relocates itself the next time something is focused.
    deleteContainer(containerElement) {
        const wasFocused = containerElement === this.currentFocused;

        containerElement.remove();

        if (this.lastFocused === containerElement) {
            this.lastFocused = null;
        }

        if (wasFocused) {
            this.currentFocused = null;
            this._showEmptyState();
            this.multiView.classList.add('hidden');
            this.focusedView.classList.remove('hidden');
        }
    }

    // Rebuilds the mobile name list from scratch. Cheap and infrequent
    // enough (only on add/rename) that a full rebuild is simpler than
    // diffing — see the HoverPopover discussion for where that tradeoff
    // does and doesn't hold.
    renderMobileList() {
        this.mobileListEl.innerHTML = this.registry.size === 0
            ? ''
            : this.registry.renderJumpButtonsHTML();
    }

    focusContainer(containerElement) {
        if (this.currentFocused) {
            this.gridPlaceholder.replaceWith(this.currentFocused);
        }

        containerElement.replaceWith(this.gridPlaceholder);
        // Insert before the metadata card specifically (not appendChild),
        // so the container always stays above it regardless of DOM order.
        this.focusedSlot.insertBefore(containerElement, this.metadataCard);

        this.currentFocused = containerElement;
        this.lastFocused = containerElement;

        this.multiView.classList.add('hidden');
        this.focusedView.classList.remove('hidden');

        this._showFocusedContent();
        this._updateMetadata(containerElement);
    }

    // Reads the name straight off the container's own title element — the
    // single place that name is already kept up to date by
    // ContainerRegistry — rather than tracking a second copy of it here.
    _updateMetadata(containerElement) {
        const name = containerElement.querySelector('.container-title').textContent;
        this.metadataNameValue.textContent = name;
    }

    _refreshMetadataIfFocused() {
        if (this.currentFocused) {
            this._updateMetadata(this.currentFocused);
        }
    }

    // Nothing focused: show the "Arx Net" empty state, hide the container
    // slot, the algorithm (Code/Traversal) panel, and the metadata card.
    _showEmptyState() {
        this.emptyState.style.display = 'flex';
        this.focusedSlot.style.display = 'none';
        this.algorithm.style.display = 'none';
        this.metadataCard.style.display = 'none';
    }

    // Something focused: the reverse of _showEmptyState(). '' reverts each
    // element to its stylesheet-defined display (flex, in every case here).
    _showFocusedContent() {
        this.emptyState.style.display = 'none';
        this.focusedSlot.style.display = '';
        this.algorithm.style.display = '';
        this.metadataCard.style.display = '';
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
                this._showEmptyState();
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
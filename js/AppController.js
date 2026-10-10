// ============================================================
// APP CONTROLLER
// Composition root: builds every module and wires them together.
//
// This is the ONE place in the whole app that attaches listeners
// directly to `document`:
//   - keydown, for shortcuts that must work regardless of what's
//     focused (there's no single "owning" element for those).
//   - click, for .list-jump-btn (its buttons are rebuilt from scratch
//     every time the object-list popover reopens, so a listener
//     attached once to a specific button would miss ones created
//     later — see sidebarPopovers.js) AND for closing any open
//     CustomSelect when the click lands outside it (see
//     CustomSelect.js's closeIfOutside()).
// Everything else (pick-graph/pick-tree, sidebar buttons, modal
// buttons, etc.) has a fixed DOM and gets a direct listener on its
// own element, attached where that element is created — see
// ViewManager.js, SettingsModal.js, FullscreenToggle.js.
// ============================================================

import { ContainerRegistry } from './ContainerRegistry.js';
import { ViewManager } from './ViewManager.js';
import { ThemeManager } from './ThemeManager.js';
import { SettingsModal } from './SettingsModal.js';
import { FullscreenToggle } from './FullscreenToggle.js';
import { ResizablePanel } from './ResizablePanel.js';
import { CodePanel } from './CodePanel.js';
import { initSidebarPopovers } from './sidebarPopovers.js';
import { initLanguageSelects } from './initLanguageSelects.js';
import { initTraversalResize } from './initTraversalResize.js';

export class AppController {
    constructor() {
        this.registry = new ContainerRegistry();
        this.viewManager = new ViewManager(this.registry);
        this.themeManager = new ThemeManager();
        this.settingsModal = new SettingsModal(this.themeManager);
        this.fullscreenToggle = new FullscreenToggle();

        // Code/Explanation <-> Traversal row (vertical drag, grows/shrinks
        // the Code/Explanation card). Unchanged behavior from before —
        // just renamed topCardId -> targetId to match ResizablePanel's
        // now-generalized options.
        this.codeResizer = new ResizablePanel({
            panelId: 'algorithm',
            targetId: 'codeCard',
            dividerId: 'dividerH'
        });

        // Container <-> Object metadata (vertical drag). Object metadata is
        // "after" the divider, so dragging down shrinks it rather than
        // growing it — see ResizablePanel's targetPosition doc comment.
        this.metadataResizer = new ResizablePanel({
            panelId: 'focused-container-slot',
            targetId: 'metadataCard',
            dividerId: 'metadataDividerH',
            targetPosition: 'after'
        });

        // Traversal <-> State variables (horizontal drag) + the "rotate to
        // a vertical tab at 3rem" behavior — see initTraversalResize.js.
        this.traversalResizer = initTraversalResize();

        this.codePanel = new CodePanel();
        this.languageSelects = initLanguageSelects();

        initSidebarPopovers(this.registry);

        this._handleGlobalClick = this._handleGlobalClick.bind(this);
        this._handleKeydown = this._handleKeydown.bind(this);
    }

    init() {
        document.addEventListener('click', this._handleGlobalClick);
        document.addEventListener('keydown', this._handleKeydown);
    }

    // ------------------------------------------------------------------
    // GLOBAL EVENT DELEGATION
    // Only "list-jump-btn" lives here, because its buttons are regenerated
    // from scratch every time the "Show object list" popover reopens
    // (see sidebarPopovers.js) — a direct listener would miss buttons
    // created after the listener was attached. Everything with a fixed,
    // one-time DOM (pick-graph/pick-tree, modal buttons, etc.) gets a
    // direct listener instead; see ViewManager.js.
    // ------------------------------------------------------------------
    _handleGlobalClick(e) {
        if (e.target.classList.contains('list-jump-btn')) {
            const containerName = e.target.dataset.name;
            const container = this.registry.get(containerName);
            if (container) {
                this.viewManager.focusContainer(container.element);
            }
        }

        this.languageSelects.forEach(select => select.closeIfOutside(e.target));
    }

    // ------------------------------------------------------------------
    // KEYBOARD SHORTCUTS
    // ------------------------------------------------------------------
    _handleKeydown(e) {
        if (!e.altKey || e.ctrlKey || e.metaKey) return;

        const key = e.key.toLowerCase();

        if (key === 'n') {
            e.preventDefault();
            this.viewManager.openCreationModal('Graph');
        }
        if (key === 'l') {
            e.preventDefault();
            this.viewManager.toggleList();
        }
    }
}
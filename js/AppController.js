// ============================================================
// APP CONTROLLER
// Composition root: builds every module and wires them together.
//
// This is also the ONE place in the whole app that attaches listeners
// directly to `document` (global click delegation + keyboard shortcuts).
// Everything else attaches its listeners to the specific element it
// owns. If a click or keypress anywhere seems to do the wrong thing,
// or nothing at all, start here — _handleGlobalClick / _handleKeydown
// is the full list of app-wide shortcuts and delegated actions.
// ============================================================

import { ContainerRegistry } from './ContainerRegistry.js';
import { ViewManager } from './ViewManager.js';
import { ThemeManager } from './ThemeManager.js';
import { SettingsModal } from './SettingsModal.js';
import { FullscreenToggle } from './FullscreenToggle.js';
import { ResizablePanel } from './ResizablePanel.js';
import { initSidebarPopovers } from './sidebarPopovers.js';

export class AppController {
    constructor() {
        this.registry = new ContainerRegistry();
        this.viewManager = new ViewManager(this.registry);
        this.themeManager = new ThemeManager();
        this.settingsModal = new SettingsModal(this.themeManager);
        this.fullscreenToggle = new FullscreenToggle();
        this.resizablePanel = new ResizablePanel({
            panelId: 'algorithm',
            topCardId: 'codeCard',
            dividerId: 'dividerH'
        });

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
    // ------------------------------------------------------------------
    _handleGlobalClick(e) {
        // Routes choices from the Pick Type modal to the Name input modal
        if (e.target.id === 'pick-graph') {
            this.viewManager.pickTypeModal.close();
            this.viewManager.openCreationModal('Graph');
        }
        if (e.target.id === 'pick-tree') {
            this.viewManager.pickTypeModal.close();
            this.viewManager.openCreationModal('Tree');
        }

        // Handles jumping to a container from the "Show object list" popover
        if (e.target.classList.contains('list-jump-btn')) {
            const containerName = e.target.dataset.name;
            const container = this.registry.get(containerName);
            if (container) {
                this.viewManager.focusContainer(container.element);
            }
        }
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

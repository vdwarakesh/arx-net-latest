// ============================================================
// 1. UTILITIES
// ============================================================

// Converts rem values to pixels for resize calculations
const remPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize);

// ============================================================
// 2. REUSABLE FLOATING WINDOW
// ============================================================

class FloatingWindow {
    constructor(title, width = 'auto', height = 'auto') {
        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay';

        // Applies dynamic sizing with inline styles
        this.overlay.innerHTML = `
            <div class="modal-window" style="width: ${width}; height: ${height};">
                <div class="modal-header">
                    <span>${title}</span>
                    <span class="modal-close" title="Close">&times;</span>
                </div>
                <div class="modal-body"></div>
            </div>
        `;

        this.body = this.overlay.querySelector('.modal-body');

        this.overlay.querySelector('.modal-close').addEventListener('click', () => this.close());

        // Close when clicking outside the window
        this.overlay.addEventListener('mousedown', (e) => {
            if (e.target === this.overlay) this.close();
        });

        document.body.appendChild(this.overlay);
    }

    setContent(htmlString) {
        this.body.innerHTML = htmlString;
    }

    open() {
        this.overlay.classList.add('active');
    }

    close() {
        this.overlay.classList.remove('active');
    }
}

// ============================================================
// 3. CONTAINER REGISTRY & NAMING
// ============================================================

const appContainers = new Map();

// Returns a unique name, appending _1, _2, ... if needed
const getUniqueName = (desiredName) => {
    if (!appContainers.has(desiredName)) return desiredName;
    let counter = 1;
    while (appContainers.has(`${desiredName}_${counter}`)) {
        counter++;
    }
    return `${desiredName}_${counter}`;
};

// Updates name, DOM label, and map entry. Does not remove any old map entry.
const setContainerName = (container, newName) => {
    container.name = newName;
    container.element.querySelector('.container-title').textContent = newName;
    appContainers.set(newName, container);
};

// Normal rename: removes the old map entry, then sets the new one
const executeRename = (container, newName) => {
    appContainers.delete(container.name);
    setContainerName(container, newName);
};

// ============================================================
// 4. CONTAINER CLASS
// ============================================================

class Container {
    constructor(name) {
        this.name = getUniqueName(name);
        this.element = this.createDOM();
    }

    createDOM() {
        const template = document.getElementById('container-template');
        const clone = template.content.cloneNode(true);
        const containerEl = clone.querySelector('.container');
        const titleEl = clone.querySelector('.container-title');
        const focusBtn = containerEl.querySelector('.focus-btn');

        titleEl.textContent = this.name;

        focusBtn.addEventListener('click', () => focusContainer(containerEl));

        // Double-click the title to rename inline
        titleEl.addEventListener('dblclick', () => {
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
                    attemptRename(this, newName);
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
        });

        return containerEl;
    }
}

// ============================================================
// 5. CONTAINER CREATION & RENAME CONFLICTS (modals)
// ============================================================

const creationModal = new FloatingWindow('Create Object', 'min(50rem, 95vw)', 'auto');
const warningModal = new FloatingWindow('Name Conflict', 'min(50rem, 95vw)', 'auto');

const openCreationModal = (type) => {
    const defaultName = getUniqueName(type);
    creationModal.overlay.querySelector('.modal-header span').textContent = `Create ${type}`;

    creationModal.setContent(`
        <div class="modal-form">
            <label>Container Name:</label>
            <input type="text" class="modal-input" id="create-name" value="${defaultName}">
            <div class="modal-actions">
                <button class="btn btn-primary" id="create-confirm">Create</button>
            </div>
        </div>
    `);
    creationModal.open();

    const nameInput = document.getElementById('create-name');

    const confirmCreate = () => {
        const finalName = nameInput.value.trim() || type;
        createNewContainer(finalName);
        creationModal.close();
    };

    document.getElementById('create-confirm').onclick = confirmCreate;

    nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            confirmCreate();
        }
    });

    setTimeout(() => nameInput.focus(), 100);
};

const attemptRename = (container, desiredName) => {
    if (!appContainers.has(desiredName)) {
        executeRename(container, desiredName);
        return;
    }

    warningModal.setContent(`
        <div class="modal-form">
            <p>The name <strong>"${desiredName}"</strong> is already in use by another container.</p>
            <p>If you force this rename, the existing container will be automatically renamed.</p>
            <div class="modal-actions">
                <button class="btn btn-secondary" id="warn-cancel">Cancel</button>
                <button class="btn btn-danger" id="warn-force">Force Rename</button>
            </div>
        </div>
    `);
    warningModal.open();

    document.getElementById('warn-cancel').onclick = () => {
        warningModal.close();
    };

    document.getElementById('warn-force').onclick = () => {
        warningModal.close();

        const requester = container;
        const existing = appContainers.get(desiredName);

        // Free the requester's old name so it can be reused as a displaced slot
        appContainers.delete(requester.name);

        // Pick the next free name for the displaced container (e.g. Graph -> Graph_1)
        const forcedName = getUniqueName(desiredName);

        // Move the displaced container and give the requested name to the requester
        appContainers.delete(desiredName);
        setContainerName(existing, forcedName);
        setContainerName(requester, desiredName);
    };
};

// ============================================================
// 6. VIEW MANAGEMENT (Grid vs Focused)
// ============================================================

const btnNew = document.getElementById('btn-new');
const btnList = document.getElementById('btn-list');
const multiView = document.getElementById('multi-view');
const focusedView = document.getElementById('focused-view');
const focusedSlot = document.getElementById('focused-container-slot');

let currentFocused = null;
let lastFocused = null;

const gridPlaceholder = document.createElement('div');
gridPlaceholder.style.display = 'none';

const createNewContainer = (name = 'Object') => {
    const container = new Container(name);
    appContainers.set(container.name, container);
    multiView.appendChild(container.element);
    focusContainer(container.element);
};

const focusContainer = (containerElement) => {
    if (currentFocused) {
        gridPlaceholder.replaceWith(currentFocused);
    }

    containerElement.replaceWith(gridPlaceholder);
    focusedSlot.appendChild(containerElement);

    currentFocused = containerElement;
    lastFocused = containerElement;

    multiView.classList.add('hidden');
    focusedView.classList.remove('hidden');
};

const toggleList = () => {
    if (appContainers.size === 0) return;

    const isCurrentlyList = !multiView.classList.contains('hidden');

    if (isCurrentlyList) {
        if (!lastFocused) return;
        focusContainer(lastFocused);
    } else {
        if (currentFocused) {
            gridPlaceholder.replaceWith(currentFocused);
            currentFocused = null;
        }
        multiView.classList.remove('hidden');
        focusedView.classList.add('hidden');
    }
};

// Pick Type Modal
const pickTypeModal = new FloatingWindow('Create New', 'min(50rem, 90vw)', 'auto');
pickTypeModal.setContent(`
    <div class="modal-form">
        <p style="margin-bottom: 0.5rem; font-size: 0.95rem;">Select the type of object to create:</p>
        <button class="btn btn-secondary" id="pick-graph" style="width: 100%; text-align: left;">Graph</button>
        <button class="btn btn-secondary" id="pick-tree" style="width: 100%; text-align: left;">Tree</button>
    </div>
`);

// --- Sidebar Event Listeners ---
btnNew.addEventListener('click', () => pickTypeModal.open());
btnList.addEventListener('click', toggleList);

// ============================================================
// 7. RESIZING (Pointer Events)
// ============================================================

const algorithm = document.getElementById('algorithm');
const codeCard = document.getElementById('codeCard');
const dividerH = document.getElementById('dividerH');

let dragging = false;
let startY = 0;
let startCodeHeight = 0;

dividerH.addEventListener('pointerdown', (e) => {
    dividerH.setPointerCapture(e.pointerId);
    dragging = true;
    dividerH.classList.add('is-dragging');

    startY = e.clientY;
    startCodeHeight = codeCard.getBoundingClientRect().height;
    document.body.style.userSelect = 'none';
    e.preventDefault();
});

dividerH.addEventListener('pointermove', (e) => {
    if (!dragging) return;

    const totalHeight = algorithm.getBoundingClientRect().height;
    const handleHeight = dividerH.offsetHeight;
    const minHeight = 3 * remPx();
    const maxHeight = totalHeight - handleHeight - minHeight;

    const delta = e.clientY - startY;
    const newHeight = Math.max(minHeight, Math.min(startCodeHeight + delta, maxHeight));

    codeCard.style.flex = `0 0 ${newHeight / remPx()}rem`;
});

dividerH.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    dragging = false;
    dividerH.classList.remove('is-dragging');

    document.body.style.userSelect = '';
    dividerH.releasePointerCapture(e.pointerId);
});

// ============================================================
// 8. THEME (Light / Dark / System)
// ============================================================

const themeMedia = window.matchMedia('(prefers-color-scheme: dark)');

const applyTheme = (themeValue) => {
    const isDark = themeValue === 'dark' ? true
        : themeValue === 'light' ? false
            : themeMedia.matches;

    if (isDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
};

const savedTheme = localStorage.getItem('app-theme') || 'system';
applyTheme(savedTheme);

themeMedia.addEventListener('change', () => {
    if ((localStorage.getItem('app-theme') || 'system') === 'system') applyTheme('system');
});

// ============================================================
// 9. SETTINGS MODAL
// ============================================================

const settingsConfig = [
    {
        id: 'appearance',
        title: 'Appearance',
        html: `
            <div class="settings-section">
                <div class="settings-title">Theme</div>
                <div class="radio-group">
                    <label class="radio-label">
                        <input type="radio" name="themeSetting" value="light">
                        <div class="radio-custom"></div> Light Mode
                    </label>
                    <label class="radio-label">
                        <input type="radio" name="themeSetting" value="dark">
                        <div class="radio-custom"></div> Dark Mode
                    </label>
                    <label class="radio-label">
                        <input type="radio" name="themeSetting" value="system">
                        <div class="radio-custom"></div> System Default
                    </label>
                </div>
            </div>
        `
    },
    {
        id: 'shortcuts',
        title: 'Shortcuts',
        html: `
            <div class="settings-section">
                <div class="settings-title">Keyboard shortcuts - Layout (PC only)</div>
                <div class="shortcut-list">
                    <div class="shortcut-row">
                        <span>Create new</span>
                        <div class="shortcut-keys"><kbd>Ctrl</kbd><kbd>N</kbd></div>
                    </div>
                    <div class="shortcut-row">
                        <span>Toggle view</span>
                        <div class="shortcut-keys"><kbd>Ctrl</kbd><kbd>L</kbd></div>
                    </div>
                </div>
            </div>
        `
    }
];

// Build tabs and panes from config
let tabsHTML = '';
let panesHTML = '';

settingsConfig.forEach((section, index) => {
    const isActive = index === 0 ? 'active' : '';
    tabsHTML += `
        <div class="settings-tab ${isActive}" data-target="${section.id}">
            ${section.title}
        </div>`;
    panesHTML += `
        <div class="settings-pane ${isActive}" id="pane-${section.id}">
            ${section.html}
        </div>`;
});

const settingsModal = new FloatingWindow('Settings', 'min(50rem, 95vw)', 'min(32rem, 90vh)');
settingsModal.setContent(`
    <div class="settings-layout">
        <div class="settings-sidebar">${tabsHTML}</div>
        <div class="settings-content">${panesHTML}</div>
    </div>
`);

// Tab switching
const tabs = settingsModal.overlay.querySelectorAll('.settings-tab');
const panes = settingsModal.overlay.querySelectorAll('.settings-pane');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        panes.forEach(p => p.classList.remove('active'));

        tab.classList.add('active');
        document.getElementById(`pane-${tab.dataset.target}`).classList.add('active');
    });
});

// Theme radios
const themeRadios = settingsModal.overlay.querySelectorAll('input[name="themeSetting"]');
themeRadios.forEach(radio => {
    if (radio.value === savedTheme) radio.checked = true;
    radio.addEventListener('change', (e) => {
        const selected = e.target.value;
        localStorage.setItem('app-theme', selected);
        applyTheme(selected);
    });
});

document.getElementById('btn-settings').addEventListener('click', () => {
    settingsModal.open();
});

// ============================================================
// 10. FULLSCREEN TOGGLE (logo)
// ============================================================

const logoBtn = document.getElementById('logo');

logoBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.warn(`Error attempting to enable fullscreen: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
});

logoBtn.addEventListener('mouseenter', () => {
    logoBtn.src = document.fullscreenElement ? 'images/windowed.png' : 'images/fullscreen.png';
});

logoBtn.addEventListener('mouseleave', () => {
    logoBtn.src = 'images/logo.png';
});

// Update the icon if fullscreen changes (e.g. Esc) while hovering
document.addEventListener('fullscreenchange', () => {
    if (logoBtn.matches(':hover')) {
        logoBtn.src = document.fullscreenElement ? 'images/windowed.png' : 'images/fullscreen.png';
    }
});

// ============================================================
// 11. HOVER POPOVERS
// ============================================================

class HoverPopover {
    constructor(targetId, title, contentGenerator) {
        this.target = document.getElementById(targetId);
        this.title = title;
        this.contentGenerator = contentGenerator;
        this.popover = null;
        this.hideTimeout = null;

        this.target.addEventListener('mouseenter', () => this.show());
        this.target.addEventListener('mouseleave', () => this.scheduleHide());
    }

    buildDOM() {
        if (this.popover) return;

        this.popover = document.createElement('div');
        this.popover.className = 'popover';

        // Keep open while the mouse is over the popover itself
        this.popover.addEventListener('mouseenter', () => clearTimeout(this.hideTimeout));
        this.popover.addEventListener('mouseleave', () => this.scheduleHide());

        document.body.appendChild(this.popover);
    }

    show() {
        clearTimeout(this.hideTimeout);
        this.buildDOM();

        // Regenerate content each time it opens
        const bodyContent = this.contentGenerator ? this.contentGenerator() : '';

        if (bodyContent) {
            this.popover.classList.remove('no-body');
            this.popover.innerHTML = `
                <div class="popover-header">${this.title}</div>
                <div class="popover-body">${bodyContent}</div>
            `;
        } else {
            this.popover.classList.add('no-body');
            this.popover.innerHTML = `<div class="popover-header">${this.title}</div>`;
        }

        // Position to the right of the sidebar icon
        const rect = this.target.getBoundingClientRect();
        this.popover.style.top = `${rect.top}px`;
        this.popover.style.left = `${rect.right + 10}px`;

        // Hide after any option inside is clicked
        this.popover.querySelectorAll('.popover-btn').forEach(btn => {
            btn.addEventListener('click', () => this.hide());
        });

        this.popover.classList.add('active');
    }

    scheduleHide() {
        this.hideTimeout = setTimeout(() => this.hide(), 150);
    }

    hide() {
        if (this.popover) this.popover.classList.remove('active');
    }
}

new HoverPopover('btn-new', 'Create new', null);

const newGraphBtn = document.getElementById("new-graph");
const newTreeBtn = document.getElementById("new-tree");

new HoverPopover('btn-list', 'Show object list', () => {
    if (appContainers.size === 0) return '';

    const names = [...appContainers.keys()].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    return names
        .map(name => `<button class="popover-btn list-jump-btn" data-name="${name}">${name}</button>`)
        .join('');
});

new HoverPopover('btn-settings', 'Settings', null);

// ============================================================
// 12. GLOBAL EVENT DELEGATION
// ============================================================

document.addEventListener('click', (e) => {
    // Routes choices from the Pick Type modal to the Name input modal
    if (e.target.id === 'pick-graph') {
        pickTypeModal.close();
        openCreationModal('Graph');
    }
    if (e.target.id === 'pick-tree') {
        pickTypeModal.close();
        openCreationModal('Tree');
    }

    // Handles jumping to containers from both the Desktop Popover and the Mobile Modal
    if (e.target.classList.contains('list-jump-btn')) {
        const containerName = e.target.dataset.name;
        const container = appContainers.get(containerName);
        if (container) {
            focusContainer(container.element);
            mobileListModal.close(); 
        }
    }
});

// ============================================================
// 13. KEYBOARD SHORTCUTS
// ============================================================

document.addEventListener('keydown', (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey) return;

    const key = e.key.toLowerCase();

    if (key === 'n') {
        e.preventDefault();
        openCreationModal('Graph');
    }
    if (key === 'l') {
        e.preventDefault();
        toggleList();
    }
});
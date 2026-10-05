// --- 1. Utility for rem-to-px calculations ---
const remPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize);

// --- 2. Container Class ---
class Container {
    static count = 0;

    constructor(name) {
        Container.count++;
        // Use provided name or default to Container {number}
        this.name = name || `Container ${Container.count}`;
        this.element = this.createDOM();
    }

    createDOM() {
        const template = document.getElementById('container-template');
        const clone = template.content.cloneNode(true);
        const containerEl = clone.querySelector('.container');
        const titleEl = clone.querySelector('.container-title');
        const focusBtn = containerEl.querySelector('.focus-btn');

        titleEl.textContent = this.name;

        // Bind the focus event strictly to this container's element
        focusBtn.addEventListener('click', () => {
            focusContainer(this.element);
        });

        return containerEl;
    }
}

// --- 3. View Management (Grid vs Focused) ---
const btnNew = document.getElementById('btn-new');
const btnList = document.getElementById('btn-list');
const multiView = document.getElementById('multi-view');
const focusedView = document.getElementById('focused-view');
const focusedSlot = document.getElementById('focused-container-slot');

let currentFocused = null;
let lastFocused = null; // Tracks the container to return to when toggling

const gridPlaceholder = document.createElement('div');
gridPlaceholder.style.display = 'none';

const createNewContainer = (name) => {
    const container = new Container(name);
    multiView.appendChild(container.element);

    // Automatically focus the newly created container
    focusContainer(container.element);
};

const focusContainer = (containerElement) => {
    if (currentFocused) {
        gridPlaceholder.replaceWith(currentFocused);
    }

    containerElement.replaceWith(gridPlaceholder);
    focusedSlot.appendChild(containerElement);

    currentFocused = containerElement;
    lastFocused = containerElement; // Remember this container

    multiView.classList.add('hidden');
    focusedView.classList.remove('hidden');
};

const toggleList = () => {
    const isCurrentlyList = !multiView.classList.contains('hidden');

    if (isCurrentlyList) {
        // Switch TO Focused View
        if (lastFocused) {
            focusContainer(lastFocused);
        }
    } else {
        // Switch TO List View
        if (currentFocused) {
            gridPlaceholder.replaceWith(currentFocused);
            currentFocused = null; // Clears the active slot (but lastFocused remembers it)
        }
        multiView.classList.remove('hidden');
        focusedView.classList.add('hidden');
    }
};

// Sidebar event listeners
btnNew.addEventListener('click', () => createNewContainer());
btnList.addEventListener('click', toggleList); // Now a toggle

// Initialize the app with a default container (it will auto-focus!)
createNewContainer("Main Container");


// --- 4. Resizing Logic (Pointer Events) ---
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

dividerH.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    dragging = false;
    dividerH.classList.remove('is-dragging');

    document.body.style.userSelect = '';
    dividerH.releasePointerCapture(e.pointerId);
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

// --- 5. Reusable Floating Window Class ---
class FloatingWindow {
    constructor(title) {
        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay';

        this.overlay.innerHTML = `
            <div class="modal-window">
                <div class="modal-header">
                    <span>${title}</span>
                    <span class="modal-close" title="Close">&times;</span>
                </div>
                <div class="modal-body"></div>
            </div>
        `;

        this.body = this.overlay.querySelector('.modal-body');

        // Close on X click
        this.overlay.querySelector('.modal-close').addEventListener('click', () => this.close());

        // Close on clicking outside the window
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


// --- 6. Settings & Advanced Theme Logic ---
const themeMedia = window.matchMedia('(prefers-color-scheme: dark)');

const applyTheme = (themeValue) => {
    let isDark = themeValue === 'dark' ? true : themeValue === 'light' ? false : themeMedia.matches;
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

// 6.1. Define Settings Data (Plug-and-Play)
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
                    <div class="shortcut-row">
                        <span>Save session</span>
                        <div class="shortcut-keys"><kbd>Ctrl</kbd><kbd>S</kbd></div>
                    </div>
                    <div class="shortcut-row">
                        <span>Open session</span>
                        <div class="shortcut-keys"><kbd>Ctrl</kbd><kbd>O</kbd></div>
                    </div>
                </div>
            </div>
        `
    }
];

// 6.2. Build the UI from the Config
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

const settingsModal = new FloatingWindow('Settings');
settingsModal.setContent(`
    <div class="settings-layout">
        <div class="settings-sidebar">${tabsHTML}</div>
        <div class="settings-content">${panesHTML}</div>
    </div>
`);

// 6.3. Wire up Tab Switching Logic
const tabs = settingsModal.overlay.querySelectorAll('.settings-tab');
const panes = settingsModal.overlay.querySelectorAll('.settings-pane');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        // Remove active class from all
        tabs.forEach(t => t.classList.remove('active'));
        panes.forEach(p => p.classList.remove('active'));

        // Add active class to clicked tab and corresponding pane
        tab.classList.add('active');
        document.getElementById(`pane-${tab.dataset.target}`).classList.add('active');
    });
});

// 6.4. Hook up the Radio Buttons
const themeRadios = settingsModal.overlay.querySelectorAll('input[name="themeSetting"]');
themeRadios.forEach(radio => {
    if (radio.value === savedTheme) radio.checked = true;
    radio.addEventListener('change', (e) => {
        const selected = e.target.value;
        localStorage.setItem('app-theme', selected);
        applyTheme(selected);
    });
});

// 6.5. Hook up the Sidebar Settings Button
document.getElementById('btn-settings').addEventListener('click', () => {
    settingsModal.open();
});

// --- 7. Anything ---
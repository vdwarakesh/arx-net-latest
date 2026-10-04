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


// --- 5. Theme Toggle Logic ---
const themeToggle = document.getElementById('themeToggle');

const applyTheme = (isDark) => {
    if (isDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggle.src = 'images/dark.png';
        localStorage.setItem('app-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
        themeToggle.src = 'images/light.png';
        localStorage.setItem('app-theme', 'light');
    }
};

const savedTheme = localStorage.getItem('app-theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const initialDark = savedTheme === 'dark' || (!savedTheme && prefersDark);

applyTheme(initialDark);

themeToggle.addEventListener('click', () => {
    const currentlyDark = document.documentElement.getAttribute('data-theme') === 'dark';
    applyTheme(!currentlyDark);
});
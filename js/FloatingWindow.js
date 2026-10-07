// ============================================================
// REUSABLE FLOATING WINDOW
// A generic modal: creation modal, rename-conflict modal, pick-type
// modal, and the settings modal are all built from this one class.
// If a modal's open/close animation or backdrop is broken, check here.
// ============================================================

export class FloatingWindow {
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

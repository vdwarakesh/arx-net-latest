// ============================================================
// FULLSCREEN TOGGLE (logo)
// Clicking the logo enters/exits fullscreen; hovering it swaps the
// icon to preview which action a click will take.
// ============================================================

export class FullscreenToggle {
    constructor(buttonId = 'logo') {
        this.button = document.getElementById(buttonId);

        this.button.addEventListener('click', () => this._toggle());
        this.button.addEventListener('mouseenter', () => this._updateIcon());
        this.button.addEventListener('mouseleave', () => {
            this.button.src = 'images/logo.png';
        });

        // Update the icon if fullscreen changes (e.g. Esc) while hovering
        document.addEventListener('fullscreenchange', () => {
            if (this.button.matches(':hover')) this._updateIcon();
        });

        // Intercept F11 to keep it synchronized with the HTML5 Fullscreen API
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F11') {
                e.preventDefault(); // Stop the browser's native F11 action
                this._toggle();     // Route through API toggle instead
            }
        });
    }

    _toggle() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.warn(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    }

    _updateIcon() {
        this.button.src = document.fullscreenElement ? 'images/windowed.png' : 'images/fullscreen.png';
    }
}
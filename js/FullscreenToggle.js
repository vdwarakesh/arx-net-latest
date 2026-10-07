// ============================================================
// FULLSCREEN TOGGLE (logo)
// Clicking the logo enters/exits fullscreen; hovering it swaps the
// icon to preview which action a click will take. If the logo icon
// doesn't swap or fullscreen won't toggle, check here.
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

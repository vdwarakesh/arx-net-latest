// ============================================================
// HOVER POPOVERS
// Used for the sidebar tooltips/menus (New / List / Settings icons).
//
// MOBILE_QUERY must stay in sync with the breakpoint in css/responsive.css.
// Hover popovers rely on mouseenter/mouseleave, which touch devices don't
// fire reliably, so they are intentionally disabled below this breakpoint
// rather than left to misbehave (get stuck open, never close, etc).
// ============================================================

const MOBILE_QUERY = '(max-width: 48rem)';

export class HoverPopover {
    constructor(targetId, title, contentGenerator) {
        this.target = document.getElementById(targetId);
        this.title = title;
        this.contentGenerator = contentGenerator;
        this.popover = null;
        this.hideTimeout = null;
        this.mediaQuery = window.matchMedia(MOBILE_QUERY);

        this.target.addEventListener('mouseenter', () => this.show());
        this.target.addEventListener('mouseleave', () => this.scheduleHide());

        // If the viewport crosses into mobile while a popover is open (e.g. the
        // user rotates a tablet or resizes the window), close it immediately.
        this.mediaQuery.addEventListener('change', () => {
            if (this.mediaQuery.matches) this.hide();
        });
    }

    get isMobile() {
        return this.mediaQuery.matches;
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
        // Popovers are a desktop-only convenience; never render on mobile.
        if (this.isMobile) return;

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

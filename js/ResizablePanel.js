// ============================================================
// RESIZING (Pointer Events)
// Drags the horizontal divider between the Code card and the
// Traversal card. If dragging feels wrong (jumps, won't go past a
// certain point, cursor gets "stuck"), check here.
// ============================================================

import { remPx } from './utils.js';

export class ResizablePanel {
    /**
     * @param {{ panelId: string, topCardId: string, dividerId: string }} ids
     */
    constructor({ panelId, topCardId, dividerId }) {
        this.panel = document.getElementById(panelId);
        this.topCard = document.getElementById(topCardId);
        this.divider = document.getElementById(dividerId);

        this.dragging = false;
        this.startY = 0;
        this.startTopHeight = 0;

        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);

        this.divider.addEventListener('pointerdown', this._onPointerDown);
        this.divider.addEventListener('pointermove', this._onPointerMove);
        this.divider.addEventListener('pointerup', this._onPointerUp);
    }

    _onPointerDown(e) {
        this.divider.setPointerCapture(e.pointerId);
        this.dragging = true;
        this.divider.classList.add('is-dragging');

        this.startY = e.clientY;
        this.startTopHeight = this.topCard.getBoundingClientRect().height;
        document.body.style.userSelect = 'none';
        e.preventDefault();
    }

    _onPointerMove(e) {
        if (!this.dragging) return;

        const totalHeight = this.panel.getBoundingClientRect().height;
        const handleHeight = this.divider.offsetHeight;
        const minHeight = 3 * remPx();
        const maxHeight = totalHeight - handleHeight - minHeight;

        const delta = e.clientY - this.startY;
        const newHeight = Math.max(minHeight, Math.min(this.startTopHeight + delta, maxHeight));

        this.topCard.style.flex = `0 0 ${newHeight / remPx()}rem`;
    }

    _onPointerUp(e) {
        if (!this.dragging) return;
        this.dragging = false;
        this.divider.classList.remove('is-dragging');

        document.body.style.userSelect = '';
        this.divider.releasePointerCapture(e.pointerId);
    }
}

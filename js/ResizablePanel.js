// ============================================================
// RESIZABLE PANEL (generic — vertical or horizontal)
// Drags a divider to resize "target" (setting its flex-basis in rem
// directly), while target's sibling passively absorbs whatever space
// that frees up or takes via its own flex: 1 1 0. One class, used for
// three dividers: Code/Explanation <-> Traversal row (vertical),
// container <-> Object metadata (vertical), and Traversal <-> State
// variables (horizontal) — just different options at each call site.
// If dragging feels wrong (jumps, won't go past a point, wrong side
// grows), check here first.
// ============================================================

import { remPx } from './utils.js';

export class ResizablePanel {
    /**
     * @param {Object} opts
     * @param {string} opts.panelId - the flex container holding target + divider (+ its sibling)
     * @param {string} opts.targetId - the element whose flex-basis this directly sets while dragging
     * @param {string} opts.dividerId - the drag handle between target and its sibling
     * @param {'vertical'|'horizontal'} [opts.axis='vertical'] - drag direction / which dimension is resized
     * @param {'before'|'after'} [opts.targetPosition='before'] - is target before or after the divider, along that axis?
     * @param {number} [opts.minRem=3] - target's own minimum size, in rem
     * @param {number} [opts.otherMinRem=3] - minimum reserved for whatever's on target's other side, in rem
     * @param {(sizes: {targetSize: number, siblingSize: number}) => void} [opts.onResize] - called with live pixel sizes on every drag step (and once from checkSizes())
     */
    constructor({
        panelId,
        targetId,
        dividerId,
        axis = 'vertical',
        targetPosition = 'before',
        minRem = 3,
        otherMinRem = 3,
        onResize
    }) {
        this.panel = document.getElementById(panelId);
        this.target = document.getElementById(targetId);
        this.divider = document.getElementById(dividerId);
        this.axis = axis;
        // target "before" the divider (e.g. Code, Traversal): dragging in the
        // positive direction moves the divider away from target, growing it.
        // target "after" the divider (e.g. Object metadata): the opposite.
        this.sign = targetPosition === 'before' ? 1 : -1;
        this.minRem = minRem;
        this.otherMinRem = otherMinRem;
        this.onResize = onResize;

        this.dragging = false;
        this.startPos = 0;
        this.startSize = 0;

        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);

        this.divider.addEventListener('pointerdown', this._onPointerDown);
        this.divider.addEventListener('pointermove', this._onPointerMove);
        this.divider.addEventListener('pointerup', this._onPointerUp);
    }

    _clientPos(e) {
        return this.axis === 'vertical' ? e.clientY : e.clientX;
    }

    _panelSize() {
        const rect = this.panel.getBoundingClientRect();
        return this.axis === 'vertical' ? rect.height : rect.width;
    }

    _targetSize() {
        const rect = this.target.getBoundingClientRect();
        return this.axis === 'vertical' ? rect.height : rect.width;
    }

    _dividerSize() {
        return this.axis === 'vertical' ? this.divider.offsetHeight : this.divider.offsetWidth;
    }

    _onPointerDown(e) {
        this.divider.setPointerCapture(e.pointerId);
        this.dragging = true;
        this.divider.classList.add('is-dragging');

        this.startPos = this._clientPos(e);
        this.startSize = this._targetSize();
        document.body.style.userSelect = 'none';
        e.preventDefault();
    }

    _onPointerMove(e) {
        if (!this.dragging) return;

        const totalSize = this._panelSize();
        const handleSize = this._dividerSize();
        const minSize = this.minRem * remPx();
        const maxSize = totalSize - handleSize - (this.otherMinRem * remPx());

        const delta = (this._clientPos(e) - this.startPos) * this.sign;
        const newSize = Math.max(minSize, Math.min(this.startSize + delta, maxSize));

        this.target.style.flex = `0 0 ${newSize / remPx()}rem`;

        if (this.onResize) {
            this.onResize({ targetSize: newSize, siblingSize: totalSize - handleSize - newSize });
        }
    }

    _onPointerUp(e) {
        if (!this.dragging) return;
        this.dragging = false;
        this.divider.classList.remove('is-dragging');

        document.body.style.userSelect = '';
        this.divider.releasePointerCapture(e.pointerId);
    }

    // Re-reads current sizes and fires onResize once, without requiring a
    // drag first — used to establish correct initial state (e.g. collapsed
    // classes) right after setup.
    checkSizes() {
        if (!this.onResize) return;
        const targetSize = this._targetSize();
        const totalSize = this._panelSize();
        const handleSize = this._dividerSize();
        this.onResize({ targetSize, siblingSize: totalSize - handleSize - targetSize });
    }
}
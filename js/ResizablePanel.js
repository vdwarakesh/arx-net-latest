import { remPx } from './utils.js';

export class ResizablePanel {
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
        this.divider.addEventListener('pointercancel', this._onPointerUp);
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
        
        // Wrap release in a try/catch or check if it has capture. 
        // On pointercancel, the browser often drops capture automatically, 
        // which can cause releasePointerCapture to throw an error.
        if (this.divider.hasPointerCapture(e.pointerId)) {
            this.divider.releasePointerCapture(e.pointerId);
        }
    }

    checkSizes() {
        if (!this.onResize) return;
        const targetSize = this._targetSize();
        const totalSize = this._panelSize();
        const handleSize = this._dividerSize();
        this.onResize({ targetSize, siblingSize: totalSize - handleSize - targetSize });
    }
}
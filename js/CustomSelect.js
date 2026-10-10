// ============================================================
// CUSTOM SELECT (desktop only)
// Native <select> dropdowns can't be styled reliably across browsers,
// so on desktop this builds a styled trigger + option list on top of
// the real <select> and keeps the two in sync. On mobile the real
// <select> is left alone and shown directly — native pickers are
// already the right UX there, and this class does nothing further
// besides keep itself hidden.
//
// The real <select> stays in the DOM either way and remains the single
// source of truth for the value; the custom UI only ever reads from it
// and writes back through it (by setting .value and dispatching a real
// "change" event), so anything else already listening to the select —
// CodePanel's cross-header language sync, for instance — keeps working
// completely unaware this class exists.
//
// This does NOT attach its own document-level "click outside to close"
// listener — AppController is the one place that owns document-level
// listeners (see its comment). Instead it exposes closeIfOutside(),
// which AppController's existing delegated click handler calls for
// every CustomSelect instance.
// ============================================================

import { MOBILE_QUERY } from './utils.js';

export class CustomSelect {
    constructor(selectEl) {
        this.select = selectEl;
        this.mediaQuery = window.matchMedia(MOBILE_QUERY);
        this.isOpen = false;

        this.wrapper = document.createElement('div');
        this.wrapper.className = 'custom-select';
        this.select.insertAdjacentElement('beforebegin', this.wrapper);
        this.wrapper.appendChild(this.select);

        this.trigger = document.createElement('button');
        this.trigger.type = 'button';
        this.trigger.className = 'custom-select-trigger';
        this.trigger.innerHTML = '<span class="custom-select-label"></span><span class="custom-select-caret">▾</span>';
        this.label = this.trigger.querySelector('.custom-select-label');
        this.wrapper.appendChild(this.trigger);

        this.list = document.createElement('div');
        this.list.className = 'custom-select-list';
        this.wrapper.appendChild(this.list);

        this.optionButtons = [...this.select.options].map(option => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'custom-select-option';
            item.textContent = option.textContent;
            item.addEventListener('click', () => {
                this.select.value = option.value;
                this.select.dispatchEvent(new Event('change'));
                this.close();
            });
            this.list.appendChild(item);
            return { value: option.value, element: item };
        });

        this.trigger.addEventListener('click', () => this.toggle());

        // Covers both the native mobile picker and any other code
        // (CodePanel's language sync) changing the real select's value.
        this.select.addEventListener('change', () => this._syncTrigger());

        this._syncTrigger();
        this._applyMode();
        this.mediaQuery.addEventListener('change', () => this._applyMode());
    }

    _applyMode() {
        const mobile = this.mediaQuery.matches;
        this.select.style.display = mobile ? '' : 'none';
        this.trigger.style.display = mobile ? 'none' : '';
        if (mobile) this.close();
    }

    _syncTrigger() {
        const selected = this.select.options[this.select.selectedIndex];
        this.label.textContent = selected ? selected.textContent : '';
        this.optionButtons.forEach(opt => {
            opt.element.classList.toggle('active', opt.value === this.select.value);
        });
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    open() {
        this.isOpen = true;
        this.list.classList.add('active');
    }

    close() {
        this.isOpen = false;
        this.list.classList.remove('active');
    }

    // Called by AppController's global click delegation on every click
    // anywhere in the document; closes this instance if the click landed
    // outside its own wrapper (trigger + list).
    closeIfOutside(target) {
        if (this.isOpen && !this.wrapper.contains(target)) {
            this.close();
        }
    }
}
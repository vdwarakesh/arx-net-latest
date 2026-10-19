// ============================================================
// CODE / EXPLANATION / NOTES TABS
// Switches between the #codeCard and #explanationCard cards (two
// separate cards with deliberately-duplicated header markup - see the
// comment in layout.html for why) and, while Explanation is active,
// hides Traversal/State variables and lets the visible card fill the
// full height. All of that is driven by toggling a single
// "explanation-active" class on #algorithm - see css/views.css for
// what that class actually changes, and css/containers-cards.css for
// the tab bar's own look.
//
// Notes has no data-tab attribute on purpose (see layout.html), so the
// tab-switching above skips it - it isn't a card to switch to. Instead
// it opens notes.html in a new window; see .notes-tab wiring below.
//
// The language <select> is intentionally NOT wired up in here at all:
// it's a sibling of the tabs, not nested inside any of them, so
// clicking it can never bubble into a tab switch. This class only ever
// listens for clicks on .code-tab[data-tab] and .notes-tab.
// ============================================================

export class CodePanel {
    constructor() {
        this.algorithm = document.getElementById('algorithm');
        this.tabs = [...document.querySelectorAll('.code-tab[data-tab]')];
        this.notesButtons = [...document.querySelectorAll('.notes-tab')];
        this.languageSelects = [...document.querySelectorAll('.language-select')];

        this.tabs.forEach(tab => {
            tab.addEventListener('click', () => this.showTab(tab.dataset.tab));
        });

        // Both headers have their own Notes button (duplicated markup,
        // same reason the language select is duplicated) - wire both to
        // the same action rather than trying to share one button.
        this.notesButtons.forEach(btn => {
            btn.addEventListener('click', () => this.openNotes());
        });

        // The header (and its language select) is duplicated across the
        // Code and Explanation cards, so keep both selects showing the
        // same value rather than letting them drift apart.
        this.languageSelects.forEach(select => {
            select.addEventListener('change', () => this._syncLanguage(select.value));
        });

        this.showTab('code');
    }

    openNotes() {
        // noopener/noreferrer: notes.html shouldn't get a handle back to
        // this window via window.opener.
        window.open('notes.html', '_blank', 'noopener,noreferrer');
    }

    showTab(tabName) {
        this.algorithm.classList.toggle('explanation-active', tabName === 'explanation');

        this.tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
    }

    _syncLanguage(value) {
        this.languageSelects.forEach(select => {
            if (select.value !== value) select.value = value;
        });
    }
}
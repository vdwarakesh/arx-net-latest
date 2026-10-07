// ============================================================
// THEME (Light / Dark / System)
// Reads/writes the saved theme preference and flips the
// [data-theme="dark"] attribute on <html>. If the wrong theme loads
// on startup, or system-mode doesn't follow the OS, check here.
// ============================================================

const STORAGE_KEY = 'app-theme';

export class ThemeManager {
    constructor() {
        this.media = window.matchMedia('(prefers-color-scheme: dark)');

        this.media.addEventListener('change', () => {
            if (this.getSaved() === 'system') this.apply('system');
        });

        this.apply(this.getSaved());
    }

    getSaved() {
        return localStorage.getItem(STORAGE_KEY) || 'system';
    }

    // Persists the choice AND applies it immediately (used by the settings radios)
    setSaved(themeValue) {
        localStorage.setItem(STORAGE_KEY, themeValue);
        this.apply(themeValue);
    }

    apply(themeValue) {
        const isDark = themeValue === 'dark' ? true
            : themeValue === 'light' ? false
                : this.media.matches;

        if (isDark) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }
}

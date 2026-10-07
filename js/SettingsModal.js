// ============================================================
// SETTINGS MODAL
// Builds the tabbed Settings window from settingsConfig.js, wires up
// tab switching, and syncs the theme radios with ThemeManager.
// If a settings tab won't switch or a radio doesn't stick, check here.
// ============================================================

import { FloatingWindow } from './FloatingWindow.js';
import { settingsConfig } from './settingsConfig.js';

export class SettingsModal {
    /**
     * @param {import('./ThemeManager.js').ThemeManager} themeManager
     * @param {string} triggerId - id of the sidebar button that opens this modal
     */
    constructor(themeManager, triggerId = 'btn-settings') {
        this.themeManager = themeManager;
        this.modal = new FloatingWindow('Settings', 'min(50rem, 95vw)', 'min(32rem, 90vh)');

        this.modal.setContent(this._buildContent());
        this._wireTabs();
        this._wireThemeRadios();

        document.getElementById(triggerId).addEventListener('click', () => this.modal.open());
    }

    _buildContent() {
        let tabsHTML = '';
        let panesHTML = '';

        settingsConfig.forEach((section, index) => {
            const isActive = index === 0 ? 'active' : '';
            tabsHTML += `
                <div class="settings-tab ${isActive}" data-target="${section.id}">
                    ${section.title}
                </div>`;
            panesHTML += `
                <div class="settings-pane ${isActive}" id="pane-${section.id}">
                    ${section.html}
                </div>`;
        });

        return `
            <div class="settings-layout">
                <div class="settings-sidebar">${tabsHTML}</div>
                <div class="settings-content">${panesHTML}</div>
            </div>
        `;
    }

    _wireTabs() {
        const tabs = this.modal.overlay.querySelectorAll('.settings-tab');
        const panes = this.modal.overlay.querySelectorAll('.settings-pane');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                panes.forEach(p => p.classList.remove('active'));

                tab.classList.add('active');
                this.modal.overlay.querySelector(`#pane-${tab.dataset.target}`).classList.add('active');
            });
        });
    }

    _wireThemeRadios() {
        const savedTheme = this.themeManager.getSaved();
        const radios = this.modal.overlay.querySelectorAll('input[name="themeSetting"]');

        radios.forEach(radio => {
            if (radio.value === savedTheme) radio.checked = true;
            radio.addEventListener('change', (e) => {
                this.themeManager.setSaved(e.target.value);
            });
        });
    }
}

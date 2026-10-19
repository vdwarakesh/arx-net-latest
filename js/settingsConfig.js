// ============================================================
// SETTINGS CONFIG
// Pure data: the tabs/panes shown inside the Settings modal. To add,
// remove, or reword a settings section, edit this file only - the
// rendering logic lives in SettingsModal.js.
// ============================================================

export const settingsConfig = [
    {
        id: 'appearance',
        title: 'Appearance',
        html: `
            <div class="settings-section">
                <div class="settings-title">Theme</div>
                <div class="radio-group">
                    <label class="radio-label">
                        <input type="radio" name="themeSetting" value="light">
                        <div class="radio-custom"></div> Light Mode
                    </label>
                    <label class="radio-label">
                        <input type="radio" name="themeSetting" value="dark">
                        <div class="radio-custom"></div> Dark Mode
                    </label>
                    <label class="radio-label">
                        <input type="radio" name="themeSetting" value="system">
                        <div class="radio-custom"></div> System Default
                    </label>
                </div>
            </div>
        `
    },
    {
        id: 'shortcuts',
        title: 'Shortcuts',
        html: `
            <div class="settings-section">
                <div class="settings-title">Keyboard shortcuts - Layout (PC only)</div>
                <div class="shortcut-list">
                    <div class="shortcut-row">
                        <span>Create new</span>
                        <div class="shortcut-keys"><kbd>Ctrl</kbd><kbd>N</kbd></div>
                    </div>
                    <div class="shortcut-row">
                        <span>Toggle view</span>
                        <div class="shortcut-keys"><kbd>Ctrl</kbd><kbd>L</kbd></div>
                    </div>
                </div>
            </div>
        `
    }
];

// ============================================================
// ENTRY POINT
// Starts the app once the DOM is ready. This is the only file
// referenced directly from layout.html.
// ============================================================

import { AppController } from './AppController.js';

document.addEventListener('DOMContentLoaded', () => {
    const app = new AppController();
    app.init();
});

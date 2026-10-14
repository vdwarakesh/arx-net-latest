// ============================================================
// ENTRY POINT
// Starts the app once the DOM is ready, fonts are loaded, 
// and layout is stable to prevent FOUC (Flash of Unstyled Content) 
// and mobile rendering glitches.
// ============================================================

import { AppController } from './AppController.js';

// Wait for everything: DOM, CSS, Images, AND Fonts
Promise.all([
    new Promise(resolve => {
        // Check if the page is already fully loaded
        if (document.readyState === 'complete') {
            resolve();
        } else {
            // Wait for all assets (images, stylesheets) to finish loading
            window.addEventListener('load', resolve);
        }
    }),
    // Ensure fonts are loaded so layout math and Prism heights are 100% accurate
    document.fonts ? document.fonts.ready : Promise.resolve()
]).then(() => {
    const app = new AppController();
    app.init();
    document.body.classList.remove('is-loading');
});
// ============================================================
// LANGUAGE SELECT INIT
// Wraps every .language-select (one per Code/Explanation header) with
// a CustomSelect. Returns the instances so AppController can route its
// delegated click handler's "close if clicked outside" check to each
// of them — see CustomSelect.js's closeIfOutside().
// ============================================================

import { CustomSelect } from './CustomSelect.js';

export function initLanguageSelects() {
    return [...document.querySelectorAll('.language-select')].map(select => new CustomSelect(select));
}
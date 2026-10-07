// ============================================================
// UTILITIES
// ============================================================

// Converts rem values to pixels for resize calculations
export const remPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize);

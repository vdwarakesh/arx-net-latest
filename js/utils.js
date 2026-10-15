// ============================================================
// UTILITIES
// ============================================================

// Converts rem values to pixels for resize calculations
export const remPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize);

// Shared with css/responsive.css's breakpoint — anything that needs to
// know "is this mobile?" in JS HoverPopover imports this
// single constant instead of each keeping its own copy of the string.
export const MOBILE_QUERY = '(max-width: 48rem)';
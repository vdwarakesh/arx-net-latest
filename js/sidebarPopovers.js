// ============================================================
// SIDEBAR POPOVERS
// Wires the three sidebar icons (New / List / Settings) up to
// HoverPopover. The "List" popover's content is generated fresh from
// the registry each time it opens. If the object-list popover shows
// stale or wrong names, check the generator function here.
// ============================================================

import { HoverPopover } from './HoverPopover.js';

/**
 * @param {import('./ContainerRegistry.js').ContainerRegistry} registry
 */
export function initSidebarPopovers(registry) {
    new HoverPopover('btn-new', 'Create new', null);

    new HoverPopover('btn-list', 'Show object list', () => {
        if (registry.size === 0) return '';

        const names = [...registry.keys()]
        // Uncomment for sorted buttons. Check in ContainerRegistry.js for mobile ordering
        // const names = [...registry.keys()].sort((a, b) =>
        //     a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
        // );

        return names
            .map(name => `<button class="popover-btn list-jump-btn" data-name="${name}">${name}</button>`)
            .join('');
    });

    new HoverPopover('btn-settings', 'Profile and settings', null);
}

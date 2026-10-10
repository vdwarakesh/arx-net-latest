// ============================================================
// TRAVERSAL / STATE VARIABLES RESIZE
// Wires the horizontal divider between Traversal and State variables.
// Also keeps each card's "collapsed" class in sync with whether it's
// actually sitting at its 3rem minimum width right now — that class
// is what css/containers-cards.css uses to rotate the header into a
// vertical tab. ResizablePanel's onResize hook reports live sizes on
// every drag step; checkSizes() reports them once up front too, in
// case a narrow screen starts below 3rem before any drag happens.
//
// ResizablePanel itself has no idea "collapsed" exists — that's kept
// here, specific to this one pair of cards, rather than baked into the
// generic resize class.
// ============================================================

import { ResizablePanel } from './ResizablePanel.js';
import { remPx } from './utils.js';

const MIN_REM = 3;

export function initTraversalResize() {
    const traversalCard = document.getElementById('traversalCard');
    const stateVariablesCard = document.getElementById('stateVariablesCard');

    const applyCollapsed = ({ targetSize, siblingSize }) => {
        const minPx = MIN_REM * remPx();
        // Small tolerance so float rounding can't leave both (or neither) collapsed.
        traversalCard.classList.toggle('collapsed', targetSize <= minPx + 0.5);
        stateVariablesCard.classList.toggle('collapsed', siblingSize <= minPx + 0.5);
    };

    const resizer = new ResizablePanel({
        panelId: 'traversalRow',
        targetId: 'traversalCard',
        dividerId: 'dividerV',
        axis: 'horizontal',
        targetPosition: 'before',
        minRem: MIN_REM,
        otherMinRem: MIN_REM,
        onResize: applyCollapsed
    });

    resizer.checkSizes();

    return resizer;
}
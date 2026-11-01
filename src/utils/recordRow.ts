import type React from 'react';

/**
 * Makes a record row open its existing detail view without stealing clicks from
 * the action menu, links, inline buttons, inputs or editable controls.
 * The native row role is retained, so data-table accessibility is unaffected.
 */
export function recordRowInteractions(openDetails: () => void) {
  return {
    tabIndex: 0,
    title: 'View details',
    onClick: (event: React.MouseEvent<HTMLTableRowElement>) => {
      const target = event.target as Element;
      if (target.closest('button, a, input, select, textarea, [role="button"], [role="menuitem"], [contenteditable="true"]')) return;
      openDetails();
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLTableRowElement>) => {
      if (event.target !== event.currentTarget) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openDetails();
      }
    },
  };
}

import { useEffect, useRef } from 'react';

const openOverlayTokens: symbol[] = [];
let originalBodyOverflow = '';
const focusableSelector = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/** Handles nested dialogs without closing a parent, trapping keyboard focus or leaking scroll locks. */
export function useAccessibleOverlay(
  open: boolean,
  onClose: () => void,
  dialogRef: React.RefObject<HTMLElement | null>,
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const token = Symbol('overlay');
    const previousFocus = document.activeElement as HTMLElement | null;
    if (!openOverlayTokens.length) originalBodyOverflow = document.body.style.overflow;
    openOverlayTokens.push(token);
    document.body.style.overflow = 'hidden';

    const initialFocus = window.requestAnimationFrame(() => {
      const target = dialogRef.current?.querySelector<HTMLElement>(focusableSelector) || dialogRef.current;
      target?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (openOverlayTokens[openOverlayTokens.length - 1] !== token || event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector))
        .filter(item => item.getClientRects().length > 0);
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(initialFocus);
      document.removeEventListener('keydown', onKeyDown);
      const index = openOverlayTokens.indexOf(token);
      if (index >= 0) openOverlayTokens.splice(index, 1);
      if (!openOverlayTokens.length) document.body.style.overflow = originalBodyOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open, dialogRef]);
}

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { cn } from '../../utils/cn';

export interface SelectOption {
  value: string;
  label: string;
  color?: string;
}

interface PremiumSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  label: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

interface Placement {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  mobile: boolean;
  bottomInset: number;
}

/**
 * Responsive, keyboard-accessible selection control.
 * Desktop: viewport-aware popover in a portal, never clipped by modal scroll.
 * Narrow viewports: touch-friendly bottom sheet with all options scrollable.
 */
export const PremiumSelect: React.FC<PremiumSelectProps> = ({
  value, onChange, options, label, placeholder = 'Select an option',
  disabled = false, className,
}) => {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [placement, setPlacement] = useState<Placement>({
    top: 0, left: 8, width: 220, maxHeight: 248, mobile: false, bottomInset: 0,
  });
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const lastTouch = useRef(false);
  const listId = useId();
  const selectedIndex = options.findIndex(option => option.value === value);
  const selected = options[selectedIndex];

  const updatePlacement = useCallback(() => {
    if (!button.current) return;
    const viewport = window.visualViewport;
    const viewWidth = viewport?.width || window.innerWidth;
    const viewTop = viewport?.offsetTop || 0;
    const viewHeight = viewport?.height || window.innerHeight;
    const viewBottom = viewTop + viewHeight;
    const rect = button.current.getBoundingClientRect();
    const mobile = window.matchMedia('(max-width: 639px)').matches || viewWidth < 480;

    if (mobile) {
      // VisualViewport also accounts for the on-screen keyboard on iOS/Android.
      const bottomInset = Math.max(0, window.innerHeight - viewBottom);
      setPlacement({
        mobile: true, bottomInset, top: 0, left: 0, width: viewWidth,
        maxHeight: Math.max(144, Math.min(440, viewHeight * 0.72)),
      });
      return;
    }

    const freeBelow = Math.max(0, viewBottom - rect.bottom - 8);
    const freeAbove = Math.max(0, rect.top - viewTop - 8);
    const desired = Math.min(300, options.length * 42 + 8);
    const above = freeBelow < Math.min(180, desired) && freeAbove > freeBelow;
    const space = above ? freeAbove : freeBelow;
    const maxHeight = Math.max(72, Math.min(desired, space - 4));
    const width = Math.min(Math.max(220, rect.width), viewWidth - 16);
    const left = Math.max(8, Math.min(rect.left, viewWidth - width - 8));
    const top = above
      ? Math.max(viewTop + 8, rect.top - maxHeight - 4)
      : Math.min(rect.bottom + 4, viewBottom - maxHeight - 8);
    setPlacement({ top, left, width, maxHeight, mobile: false, bottomInset: 0 });
  }, [options.length]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node) &&
          !menu.current?.contains(event.target as Node)) setOpen(false);
    };
    let frame = 0;
    const reposition = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (button.current && !button.current.getClientRects().length) {
          setOpen(false);
          return;
        }
        updatePlacement();
      });
    };
    document.addEventListener('pointerdown', outside);
    // The form in New Order has its own scroll container; anchored menus must
    // follow it instead of disappearing under the keyboard or being clipped.
    document.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    window.visualViewport?.addEventListener('resize', reposition);
    window.visualViewport?.addEventListener('scroll', reposition);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      window.visualViewport?.removeEventListener('resize', reposition);
      window.visualViewport?.removeEventListener('scroll', reposition);
      cancelAnimationFrame(frame);
    };
  }, [open, updatePlacement]);

  useEffect(() => {
    if (!open || !menu.current) return;
    const highlighted = menu.current.querySelector<HTMLElement>('[data-highlighted="true"]');
    // Arrow-key navigation should keep the active item visible inside the sheet.
    if (highlighted && !lastTouch.current) highlighted.scrollIntoView({ block: 'nearest' });
    lastTouch.current = false;
  }, [active, open]);

  const show = () => {
    if (disabled || options.length === 0) return;
    lastTouch.current = false;
    setActive(Math.max(0, selectedIndex));
    updatePlacement();
    setOpen(true);
  };

  const choose = (index: number) => {
    if (disabled || !options[index]) return;
    onChange(options[index].value);
    setOpen(false);
    // Re-focus the trigger without jumping the modal behind the bottom sheet.
    button.current?.focus({ preventScroll: true });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || options.length === 0) return;
    if (event.key === 'Escape') {
      if (open) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
      return;
    }
    if (event.key === 'Tab') { setOpen(false); return; }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (!open) { show(); return; }
      setActive(current => event.key === 'Home' ? 0
        : event.key === 'End' ? options.length - 1
        : event.key === 'ArrowDown' ? (current + 1) % options.length
        : (current - 1 + options.length) % options.length);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) choose(active); else show();
    } else if (open && event.key.length === 1 && /\S/.test(event.key)) {
      const index = options.findIndex(option =>
        option.label.toLowerCase().startsWith(event.key.toLowerCase()));
      if (index >= 0) setActive(index);
    }
  };

  const optionRows = options.map((option, index) => (
    <div
      role="option"
      key={option.value}
      aria-selected={option.value === value}
      data-highlighted={active === index ? 'true' : undefined}
      onPointerDown={() => { lastTouch.current = true; }}
      onMouseEnter={() => setActive(index)}
      onMouseDown={event => event.preventDefault()}
      onClick={() => choose(index)}
      className={cn(
        'flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors active:bg-blue-100',
        index === active ? 'bg-blue-50 text-blue-900' : 'text-slate-700 hover:bg-slate-50',
      )}
    >
      {option.color && <span aria-hidden="true" className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: option.color }} />}
      <span className="min-w-0 flex-1 break-words">{option.label}</span>
      {option.value === value && <Check aria-hidden="true" className="h-4 w-4 flex-none text-blue-600" />}
    </div>
  ));

  return (
    <div ref={root} className={cn('relative min-w-0', className)}>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        disabled={disabled}
        onKeyDown={onKeyDown}
        onClick={() => open ? setOpen(false) : show()}
        className={cn(
          'flex min-h-11 w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm shadow-sm transition-colors',
          'border-slate-200 bg-white text-slate-800 hover:border-blue-300 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500',
          open && 'border-blue-400 ring-2 ring-blue-100',
          disabled && 'cursor-not-allowed bg-slate-50 opacity-50',
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {selected?.color && <span aria-hidden="true" className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: selected.color }} />}
          <span className="min-w-0 truncate">{selected?.label || placeholder}</span>
        </span>
        <ChevronDown aria-hidden="true" className={cn('h-4 w-4 flex-none text-slate-500 transition-transform', open && 'rotate-180')} />
      </button>

      {open && createPortal(
        placement.mobile ? (
          <div className="fixed inset-0 z-[110]" aria-label={label + ' options'}>
            <div className="absolute inset-0 bg-slate-900/40" aria-hidden="true" onClick={() => setOpen(false)} />
            <div
              className="absolute left-0 right-0 flex flex-col rounded-t-2xl border border-slate-200 bg-white shadow-2xl"
              style={{ bottom: placement.bottomInset, maxHeight: placement.maxHeight, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
              <div className="flex flex-none items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <h3 className="min-w-0 truncate text-sm font-bold text-slate-900">{label}</h3>
                <button type="button" onClick={() => setOpen(false)} aria-label={'Close ' + label + ' options'}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div ref={menu} id={listId} role="listbox" aria-label={label}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
                {optionRows}
              </div>
            </div>
          </div>
        ) : (
          <div
            ref={menu} id={listId} role="listbox" aria-label={label}
            className="fixed z-[110] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-1 shadow-2xl"
            style={{ top: placement.top, left: placement.left, width: placement.width, maxHeight: placement.maxHeight }}
          >
            {optionRows}
          </div>
        ), document.body,
      )}
    </div>
  );
};

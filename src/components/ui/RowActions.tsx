import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface RowAction {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}

interface RowActionsProps {
  label: string;
  actions: RowAction[];
}

/** Portal menu avoids clipping inside horizontally scrollable business tables. */
export const RowActions: React.FC<RowActionsProps> = ({ label, actions }) => {
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const toggle = () => {
    if (!open && trigger.current) {
      const bounds = trigger.current.getBoundingClientRect();
      const preferredHeight = Math.min(300, actions.length * 44 + 12);
      const below = window.innerHeight - bounds.bottom - 8;
      const above = bounds.top - 8;
      const menuHeight = Math.max(44, Math.min(preferredHeight, Math.max(below, above) - 4));
      const useAbove = below < Math.min(preferredHeight, 150) && above > below;
      const width = Math.min(176, window.innerWidth - 16);
      setPosition({
        top: useAbove ? Math.max(8, bounds.top - menuHeight - 4)
          : Math.max(8, Math.min(bounds.bottom + 4, window.innerHeight - menuHeight - 8)),
        left: Math.max(8, Math.min(bounds.right - width, window.innerWidth - width - 8)),
      });
    }
    setOpen(value => !value);
  };

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || []);
        const index = items.findIndex(item => item === document.activeElement);
        const next = event.key === 'ArrowDown' ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
        if (items[next]) { event.preventDefault(); items[next].focus(); }
      }
    };
    const dismiss = () => setOpen(false);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', keyboard);
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', dismiss, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', keyboard);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('scroll', dismiss, true);
    };
  }, [open]);

  return (
    <>
      <button type="button" ref={trigger} onClick={toggle} title={label} aria-label={label} aria-haspopup="menu" aria-expanded={open}
        className="inline-flex cursor-pointer items-center justify-center rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500">
        <MoreVertical aria-hidden="true" className="h-4 w-4" />
      </button>
      {open && createPortal(
        <div ref={menu} role="menu" aria-label={label}
          className="fixed z-[105] max-h-[min(18rem,calc(100dvh-1rem))] w-[min(11rem,calc(100vw-1rem))] overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-white p-1 shadow-xl"
          style={{ top: Math.max(8, position.top), left: position.left }}>
          {actions.map(action => (
            <button type="button" key={action.label} role="menuitem" disabled={action.disabled}
              onClick={() => { setOpen(false); action.onClick(); }}
              className={cn('flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-colors',
                action.danger ? 'text-red-700 hover:bg-red-50' : 'text-slate-700 hover:bg-blue-50 hover:text-blue-800')}>
              {action.icon && <span aria-hidden="true" className="flex-none">{action.icon}</span>}
              <span>{action.label}</span>
            </button>
          ))}
        </div>, document.body
      )}
    </>
  );
};

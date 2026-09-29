import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
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

/** Keyboard-operable, compact listbox for app filters and workflow decisions. */
export const PremiumSelect: React.FC<PremiumSelectProps> = ({
  value, onChange, options, label, placeholder = 'Select an option',
  disabled = false, className,
}) => {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const selectedIndex = options.findIndex(option => option.value === value);
  const selected = options[selectedIndex];

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  const show = () => {
    if (disabled) return;
    setActive(Math.max(0, selectedIndex));
    setOpen(true);
  };

  const choose = (index: number) => {
    if (options[index]) onChange(options[index].value);
    setOpen(false);
    button.current?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'Tab') {
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      if (!open) { show(); return; }
      setActive(current => event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
        : event.key === 'ArrowDown' ? (current + 1) % options.length
          : (current - 1 + options.length) % options.length);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) choose(active);
      else show();
    } else if (open && event.key.length === 1 && /\S/.test(event.key)) {
      const match = options.findIndex(option => option.label.toLowerCase().startsWith(event.key.toLowerCase()));
      if (match >= 0) setActive(match);
    }
  };

  return (
    <div ref={root} className={cn('relative min-w-0', className)}>
      <button
        type="button"
        ref={button}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        disabled={disabled}
        onKeyDown={onKeyDown}
        onClick={() => open ? setOpen(false) : show()}
        className={cn('flex min-h-10 w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm shadow-sm outline-none transition-colors cursor-pointer',
          'bg-white text-slate-800 border-slate-200 hover:border-blue-300 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1',
          open && 'border-blue-400 ring-2 ring-blue-100',
          disabled && 'cursor-not-allowed opacity-50 bg-slate-50')}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {selected?.color && <span aria-hidden="true" className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: selected.color }} />}
          <span className="truncate">{selected?.label || placeholder}</span>
        </span>
        <ChevronDown aria-hidden="true" className={cn('h-4 w-4 flex-none text-slate-500 transition-transform duration-150', open && 'rotate-180')} />
      </button>
      {open && options.length > 0 && (
        <div id={listId} role="listbox" aria-label={label}
          className="absolute left-0 right-0 top-full z-[80] mt-1 max-h-64 min-w-[min(16rem,90vw)] overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl"
        >
          {options.map((option, index) => (
            <div
              role="option"
              aria-selected={option.value === value}
              key={option.value}
              onMouseEnter={() => setActive(index)}
              onMouseDown={e => e.preventDefault()}
              onClick={() => choose(index)}
              className={cn('flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                index === active ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-50')}
            >
              {option.color && <span aria-hidden="true" className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: option.color }} />}
              <span className="flex-1 truncate">{option.label}</span>
              {option.value === value && <Check aria-hidden="true" className="h-4 w-4 text-blue-600" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

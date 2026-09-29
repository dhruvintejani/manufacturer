import React from 'react';
import { createPortal } from 'react-dom';
import { useAccessibleOverlay } from './useAccessibleOverlay';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  side?: 'right' | 'left';
  width?: string;
}

export const Drawer: React.FC<DrawerProps> = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  side = 'right',
  width = 'max-w-2xl',
}) => {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  useAccessibleOverlay(open, onClose, dialogRef);

  const slideVariants = {
    right: { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } },
    left: { initial: { x: '-100%' }, animate: { x: 0 }, exit: { x: '-100%' } },
  };
  const variants = slideVariants[side];

  // Portals escape transformed route animations and the dashboard's scroll container.
  // Fixed dialogs must be relative to the actual device viewport, especially on phones.
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40 flex min-w-0">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={variants.initial}
            animate={variants.animate}
            exit={variants.exit}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            ref={dialogRef}
            tabIndex={-1}
            className={cn(
              'relative ml-auto h-[100dvh] min-w-0 max-w-[100vw] bg-white shadow-2xl flex flex-col w-full',
              width
            )}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-label={!title ? (subtitle || 'Dialog') : undefined}
          >
            {(title || subtitle) && (
              <div className="flex min-w-0 items-start justify-between gap-3 px-4 py-3 sm:p-6 border-b border-slate-100">
                <div className="min-w-0">
                  {title && <h2 id={titleId} className="break-words text-base font-semibold text-slate-900 sm:text-lg">{title}</h2>}
                  {subtitle && <p className="break-words text-sm text-slate-500 mt-0.5">{subtitle}</p>}
                </div>
                <button
                  onClick={onClose}
                  className="shrink-0 rounded-lg p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  aria-label="Close drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
            {!title && !subtitle && (
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Close drawer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>, document.body
  );
};

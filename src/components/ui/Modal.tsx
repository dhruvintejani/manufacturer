import React from 'react';
import { useAccessibleOverlay } from './useAccessibleOverlay';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  footer?: React.ReactNode;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
};

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  size = 'lg',
  footer,
}) => {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  useAccessibleOverlay(open, onClose, dialogRef);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            ref={dialogRef}
            tabIndex={-1}
            className={cn(
              'relative min-w-0 max-w-[calc(100vw-1rem)] rounded-xl bg-white shadow-2xl w-full flex flex-col max-h-[calc(100dvh-1rem)] sm:max-h-[90dvh] z-10',
              sizeClasses[size]
            )}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-label={!title ? (subtitle || 'Dialog') : undefined}
          >
            {(title || subtitle) && (
              <div className="flex min-w-0 items-start justify-between gap-3 px-4 py-3 sm:p-6 border-b border-slate-100 flex-shrink-0">
                <div className="min-w-0">
                  {title && <h2 id={titleId} className="break-words text-base font-semibold text-slate-900 sm:text-lg">{title}</h2>}
                  {subtitle && <p className="break-words text-sm text-slate-500 mt-0.5">{subtitle}</p>}
                </div>
                <button
                  onClick={onClose}
                  className="shrink-0 rounded-lg p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
            <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4 sm:p-6">
              {children}
            </div>
            {footer && (
              <div className="max-h-[32dvh] shrink-0 overflow-y-auto border-t border-slate-100 px-4 py-3 sm:max-h-[unset] sm:p-6">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

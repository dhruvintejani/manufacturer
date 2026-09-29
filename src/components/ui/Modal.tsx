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
  useAccessibleOverlay(open, onClose, dialogRef);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
              'relative bg-white rounded-xl shadow-2xl w-full flex flex-col max-h-[90dvh] z-10',
              sizeClasses[size]
            )}
            role="dialog"
            aria-modal="true"
          >
            {(title || subtitle) && (
              <div className="flex items-start justify-between p-6 border-b border-slate-100 flex-shrink-0">
                <div>
                  {title && <h2 className="text-lg font-semibold text-slate-900">{title}</h2>}
                  {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-6">
              {children}
            </div>
            {footer && (
              <div className="flex-shrink-0 border-t border-slate-100 p-6">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

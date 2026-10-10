import React from 'react';
import { createPortal } from 'react-dom';
import { useAccessibleOverlay } from './useAccessibleOverlay';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  details?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  confirmationText?: string;
  confirmationLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  details,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  confirmationText,
  confirmationLabel = 'Type to confirm',
  onConfirm,
  onCancel,
}) => {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const [typedConfirmation, setTypedConfirmation] = React.useState('');
  useAccessibleOverlay(open, onCancel, dialogRef);

  React.useEffect(() => {
    if (!open) setTypedConfirmation('');
  }, [open]);

  const requiresTypedConfirmation = Boolean(confirmationText);
  const confirmationMatches = !requiresTypedConfirmation ||
    typedConfirmation.trim().toUpperCase() === confirmationText!.trim().toUpperCase();

  const variantStyles = {
    danger: { icon: 'text-red-500', bg: 'bg-red-50', btn: 'bg-red-600 hover:bg-red-700 text-white' },
    warning: { icon: 'text-amber-500', bg: 'bg-amber-50', btn: 'bg-amber-500 hover:bg-amber-600 text-white' },
    info: { icon: 'text-blue-500', bg: 'bg-blue-50', btn: 'bg-blue-600 hover:bg-blue-700 text-white' },
  };
  const s = variantStyles[variant];

  // Portals escape transformed route animations and the dashboard's scroll container.
  // Fixed dialogs must be relative to the actual device viewport, especially on phones.
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            ref={dialogRef} tabIndex={-1} className="relative bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90dvh] overflow-y-auto p-5 z-10"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
          >
            <div className="flex items-start gap-4">
              <div className={`p-2.5 rounded-xl ${s.bg} flex-shrink-0`}>
                <AlertTriangle className={`w-5 h-5 ${s.icon}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 id="confirm-title" className="text-base font-semibold text-slate-900">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
                {details && details.length > 0 && (
                  <ul className="mt-3 space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    {details.map(detail => (
                      <li key={detail} className="flex items-start gap-2">
                        <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button
                onClick={onCancel}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {requiresTypedConfirmation && (
              <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <label htmlFor="confirm-dialog-text" className="block text-xs font-semibold text-amber-900">
                  {confirmationLabel}: <span className="font-mono">{confirmationText}</span>
                </label>
                <input
                  id="confirm-dialog-text"
                  value={typedConfirmation}
                  onChange={event => setTypedConfirmation(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  className="mt-2 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                {cancelLabel}
              </button>
              <button
                onClick={() => { if (confirmationMatches) onConfirm(); }}
                disabled={!confirmationMatches}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${s.btn} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>, document.body
  );
};

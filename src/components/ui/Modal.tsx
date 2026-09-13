import React, { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { Button } from './Button';

// Confirm/alert dialog replacing window.confirm() and window.alert(). Renders a
// controlled overlay with a danger/success variant, an icon, message, cancel and
// confirm actions. Closes on Escape and backdrop click, returns focus on close.
interface ModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: 'danger' | 'confirm';
  onConfirm: () => void;
  onCancel: () => void;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Bekor qilish',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const Icon = variant === 'danger' ? AlertTriangle : CheckCircle2;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-slate-900 border border-white/10 shadow-2xl animate-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-white/10 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`p-2 rounded-xl shrink-0 ${
                variant === 'danger' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
              }`}
            >
              <Icon className="w-6 h-6" />
            </div>
            <h3 id="modal-title" className="font-bold text-white text-base leading-snug pt-1">
              {title}
            </h3>
          </div>
          <button
            onClick={onCancel}
            aria-label="Yopish"
            className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          <p className="text-sm text-slate-300 leading-relaxed">{message}</p>
        </div>

        <div className="px-5 pb-5 flex flex-col-reverse sm:flex-row justify-end gap-2">
          {cancelLabel && (
            <Button variant="outline" size="sm" onClick={onCancel}>
              {cancelLabel}
            </Button>
          )}
          <Button variant={variant === 'danger' ? 'danger' : 'success'} size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
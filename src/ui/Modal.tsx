import {useEffect} from 'react';
import {AlertTriangle, CheckCircle2, X} from 'lucide-react';
import {Button} from './Button';
import {useLang} from '../i18n';

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

export function Modal({open, title, message, confirmLabel, cancelLabel, variant = 'danger', onConfirm, onCancel}: ModalProps) {
  const {t} = useLang();
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;
  const Icon = variant === 'danger' ? AlertTriangle : CheckCircle2;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm animate-[var(--animate-fade-in)]"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="w-full max-w-md rounded-[var(--radius-card)] border-2 border-line bg-surface shadow-[var(--shadow-card-hover)] animate-[var(--animate-pop)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b-2 border-line p-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className={`shrink-0 rounded-xl p-2 ${variant === 'danger' ? 'bg-danger-500/15 text-danger-500' : 'bg-play-500/15 text-play-400'}`}>
              <Icon className="h-6 w-6" />
            </div>
            <h3 id="modal-title" className="pt-1 text-base font-bold leading-snug text-ink">
              {title}
            </h3>
          </div>
          <button
            onClick={onCancel}
            aria-label={t('close')}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-faint transition-colors hover:bg-surface-raised hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          <p className="text-sm leading-relaxed text-ink-soft">{message}</p>
        </div>

        <div className="flex flex-col-reverse justify-end gap-2 px-5 pb-5 sm:flex-row">
          {cancelLabel && (
            <Button variant="outline" size="sm" onClick={onCancel}>
              {cancelLabel || t('cancel')}
            </Button>
          )}
          <Button variant={variant === 'danger' ? 'danger' : 'play'} size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

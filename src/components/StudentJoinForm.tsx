import React from 'react';
import {Link} from 'react-router-dom';
import {AlertCircle, ArrowLeft, Loader2, Shield, User} from 'lucide-react';
import {useLang} from '../i18n';
import {Card} from '../ui/Card';
import {Button} from '../ui/Button';

interface StudentJoinFormProps {
  pinInput: string;
  onPinChange: (value: string) => void;
  nameInput: string;
  onNameChange: (value: string) => void;
  errorMsg: string | null;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onTeacherClick?: () => void;
}

// Presentational login screen for the student flow. State lives in StudentView;
// this component only renders the PIN + name form and forwards edits/errors.
export const StudentJoinForm: React.FC<StudentJoinFormProps> = ({
  pinInput,
  onPinChange,
  nameInput,
  onNameChange,
  errorMsg,
  loading,
  onSubmit,
  onTeacherClick,
}) => {
  const {t} = useLang();

  return (
    <div className="relative flex min-h-[75vh] items-center justify-center overflow-hidden p-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/4 h-96 w-96 rounded-full bg-brand-300/40 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-violet-300/30 blur-3xl" />
        <div className="absolute top-1/3 -right-12 h-60 w-60 rounded-full bg-play-400/25 blur-3xl" />
      </div>

      <Card className="relative z-10 w-full max-w-md space-y-6 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-line pb-4">
          <Link
            to="/"
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-raised px-2.5 text-xs font-extrabold uppercase tracking-wider text-ink-soft transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('back')}
          </Link>

          <div className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-raised px-2.5 text-xs font-extrabold uppercase tracking-wider text-ink-soft">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-play-500" />
            {t('sv_student_system')}
          </div>

          {onTeacherClick && (
            <button
              type="button"
              onClick={onTeacherClick}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border-2 border-violet-300 bg-violet-500/10 px-3 text-xs font-extrabold uppercase tracking-wider text-violet-400 transition-colors hover:bg-violet-500/20"
            >
              <Shield className="h-3.5 w-3.5" />
              {t('sv_login_as_teacher')}
            </button>
          )}
        </div>

        <div className="space-y-3 pt-1 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-[var(--shadow-pop-brand)]">
            <User className="h-8 w-8" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-ink sm:text-3xl">
              {t('sv_students_login')}
            </h2>
            <p className="mt-1 text-xs text-ink-faint">{t('sv_students_login_sub')}</p>
          </div>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl border-2 border-danger-500/30 bg-danger-500/10 p-3.5 text-xs font-semibold text-danger-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-widest text-ink-soft">
              {t('sv_pin_label')}
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="go"
              required
              maxLength={6}
              data-testid="pin-input"
              value={pinInput}
              onChange={(e) => onPinChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder={t('sv_pin_placeholder')}
              className="w-full rounded-2xl border-2 border-brand-300 bg-surface-sunken px-4 py-4 text-center text-2xl font-black tracking-widest text-brand-400 shadow-inner focus:border-brand-500 focus:outline-none sm:text-3xl"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-widest text-ink-soft">
              {t('sv_name_label')}
            </label>
            <input
              type="text"
              required
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="words"
              spellCheck={false}
              data-testid="name-input"
              value={nameInput}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder={t('sv_name_placeholder')}
              className="w-full rounded-2xl border-2 border-line bg-surface-sunken px-5 py-4 text-base font-bold text-ink focus:border-brand-500 focus:outline-none sm:text-lg"
            />
          </div>

          <Button
            type="submit"
            data-testid="join-submit"
            disabled={loading || pinInput.trim().length !== 6 || !nameInput.trim()}
            variant="play"
            size="lg"
            fullWidth
            className="uppercase tracking-widest"
            icon={loading ? <Loader2 className="h-5 w-5 animate-spin" /> : undefined}
          >
            {loading ? t('sv_connecting') : t('sv_join')}
          </Button>
        </form>
      </Card>
    </div>
  );
};

import React from 'react';
import {Link} from 'react-router-dom';
import {AlertCircle, ArrowLeft, Loader2, Shield, User} from 'lucide-react';
import {useLang} from '../i18n';

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
        <div className="absolute -top-24 left-1/4 h-96 w-96 rounded-full bg-indigo-300/40 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-violet-300/30 blur-3xl" />
        <div className="absolute top-1/3 -right-12 h-60 w-60 rounded-full bg-emerald-300/25 blur-3xl" />
        <div className="absolute top-24 -left-16 h-56 w-56 rounded-full bg-amber-300/20 blur-3xl" />
      </div>
      <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 backdrop-blur-xl relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-indigo-500/10 blur-3xl rounded-full pointer-events-none" />

        {/* Top Bar inside Card */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/5 relative z-20">
          <Link
            to="/"
            className="flex items-center gap-1.5 px-2.5 h-8 rounded-full bg-slate-800/80 text-slate-300 border border-white/5 text-xs font-bold uppercase tracking-wider inline-flex hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {t('back')}
          </Link>

          <div className="flex items-center gap-1.5 px-2.5 h-8 rounded-full bg-slate-800/80 text-slate-300 border border-white/5 text-xs font-bold uppercase tracking-wider inline-flex">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{t('sv_student_system')}</span>
          </div>

          {onTeacherClick && (
            <button
              type="button"
              onClick={onTeacherClick}
              className="flex items-center gap-1.5 px-3 h-10 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer hover:border-indigo-400 shadow-sm"
            >
              <Shield className="w-3.5 h-3.5 text-indigo-400" />
              <span>{t('sv_login_as_teacher')}</span>
            </button>
          )}
        </div>

        {/* Title & Icon Header */}
        <div className="text-center space-y-3 relative z-10 pt-1">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(79,70,229,0.4)] font-black text-2xl border border-indigo-400/30">
            <User className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight uppercase">
              {t('sv_students_login')}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {t('sv_students_login_sub')}
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-5 relative z-10">
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-widest text-slate-300 mb-1.5">
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
              onChange={(e) => { onPinChange(e.target.value.replace(/\D/g, '').slice(0, 6)); }}
              placeholder={t('sv_pin_placeholder')}
              className="w-full text-center tracking-widest font-black text-2xl sm:text-3xl px-4 py-4 rounded-2xl bg-slate-950 border-2 border-indigo-500/50 text-indigo-400 focus:outline-none focus:border-indigo-400 shadow-inner"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase tracking-widest text-slate-300 mb-1.5">
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
              className="w-full px-5 py-4 rounded-2xl bg-slate-950 border-2 border-white/10 text-white font-bold text-base sm:text-lg focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            data-testid="join-submit"
            disabled={loading || pinInput.trim().length !== 6 || !nameInput.trim()}
            className="w-full py-4 sm:py-5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-700 hover:from-indigo-500 hover:to-purple-600 text-white font-black text-sm sm:text-base uppercase tracking-widest shadow-[0_0_25px_rgba(79,70,229,0.5)] disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer border border-indigo-400/40"
          >
            {loading ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" /> {t('sv_connecting')}
              </>
            ) : (
              t('sv_join')
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
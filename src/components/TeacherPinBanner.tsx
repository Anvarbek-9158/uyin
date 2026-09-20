import React from 'react';
import { ArrowLeft, Check, Link2, MessageSquare, RefreshCw } from 'lucide-react';
import { useLang } from '../i18n';

interface TeacherPinBannerProps {
  pin: string;
  feedbackCount: number;
  studentsLinkCopied: boolean;
  showResetGame: boolean;
  onCopyStudentsLink: () => void;
  onOpenFeedback: () => void;
  onRegeneratePin: () => void;
  onResetGame: () => void;
}

// Presentational header banner shown to the teacher: the joinable PIN, a copy
// link for students, feedback inbox shortcut, and game-lifecycle actions
// (regenerate PIN / start a brand-new game). State stays in TeacherView; this
// component only renders the buttons and forwards clicks.
export const TeacherPinBanner: React.FC<TeacherPinBannerProps> = ({
  pin,
  feedbackCount,
  studentsLinkCopied,
  showResetGame,
  onCopyStudentsLink,
  onOpenFeedback,
  onRegeneratePin,
  onResetGame,
}) => {
  const { t } = useLang();

  return (
    <div className="bg-surface/95 border-2 border-brand-300 rounded-3xl p-5 sm:p-7 shadow-2xl relative overflow-hidden backdrop-blur-xl">
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-brand-500/15 blur-3xl rounded-full pointer-events-none" />

      <div className="flex flex-col lg:flex-row items-center justify-between gap-5 relative z-10">
        <div className="space-y-1.5 text-center lg:text-left">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-ink tracking-tight uppercase">
            {t('tv_pin_title')}
          </h1>
          <p className="text-ink-soft text-xs sm:text-sm font-medium tracking-wide">
            {t('tv_pin_sub')}
          </p>
        </div>

        {/* PIN BOX & CUSTOM EDIT BUTTONS */}
        <div className="flex flex-col items-center gap-4 bg-surface-sunken p-4 sm:px-7 sm:py-4 rounded-3xl border-2 border-brand-300 shadow-[var(--shadow-pop-brand)] w-full max-w-full lg:w-auto lg:flex-row lg:items-center">
          <div className="text-center sm:text-left min-w-0">
            <div className="text-xs uppercase font-extrabold text-ink-faint tracking-widest">
              {t('tv_pin_label')}
            </div>
            <div
              data-testid="pin-value"
              className=" font-black text-3xl sm:text-4xl md:text-5xl text-brand-400 tracking-wider sm:tracking-widest leading-none mt-1"
            >
              {pin}
            </div>
          </div>

          <div className="h-10 w-0.5 bg-white/15 hidden lg:block" />

          <div className="flex flex-wrap items-center justify-center gap-2">
            {/* STUDENTS JOIN LINK */}
            <button
              onClick={onCopyStudentsLink}
              title={t('tv_students_link')}
              className="flex items-center gap-1.5 px-3 h-10 sm:px-3.5 sm:h-11 rounded-xl bg-sky-500/20 hover:bg-sky-500/35 text-sky-200 text-xs font-extrabold border border-sky-500/50 transition-all uppercase tracking-wider cursor-pointer"
            >
              {studentsLinkCopied ? (
                <Check className="w-4 h-4 text-play-400 shrink-0" />
              ) : (
                <Link2 className="w-4 h-4 text-sky-400 shrink-0" />
              )}
              <span>{studentsLinkCopied ? t('tv_students_link_copied') : t('tv_students_link')}</span>
            </button>

            {/* FEEDBACK BUTTON */}
            <button
              onClick={onOpenFeedback}
              className="flex items-center gap-1.5 px-3 h-10 sm:px-3.5 sm:h-11 rounded-xl bg-brand-500/20 hover:bg-brand-500/35 text-brand-300 text-xs font-extrabold border border-brand-300 transition-all uppercase tracking-wider relative cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-brand-400 shrink-0" />
              <span>{t('tv_feedback')} ({feedbackCount})</span>
              {feedbackCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-play-400 animate-pulse" />
              )}
            </button>

            <button
              onClick={onRegeneratePin}
              className="flex items-center gap-1.5 px-3 h-10 sm:px-3.5 sm:h-11 rounded-xl bg-play-600/20 hover:bg-play-600/35 text-play-400/30 text-xs font-extrabold border border-play-500/50 transition-all uppercase tracking-wider cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-play-400 shrink-0" />
              {t('tv_regenerate_pin')}
            </button>

            {showResetGame && (
              <button
                onClick={onResetGame}
                className="flex items-center gap-1.5 px-3 h-10 sm:px-3.5 sm:h-11 rounded-xl bg-danger-500/20 hover:bg-danger-500/35 text-danger-400/30 text-xs font-extrabold border border-danger-500/40 transition-all uppercase tracking-wider cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-danger-400 shrink-0" />
                {t('tv_new_game')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
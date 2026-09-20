import React, {useState} from 'react';
import {Copy, Check, LogOut} from 'lucide-react';
import {useLang} from '../i18n';
import {Logo} from './Logo';
import {LangSwitcher} from './LangSwitcher';

interface NavbarProps {
  viewMode: 'LANDING' | 'TEACHER' | 'STUDENT';
  setViewMode: (mode: 'LANDING' | 'TEACHER' | 'STUDENT') => void;
  pin: string | null;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  onResetGame?: () => void;
  isTeacherAuth?: boolean;
  onLogoutTeacher?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({viewMode, setViewMode, pin, isTeacherAuth, onLogoutTeacher}) => {
  const [copied, setCopied] = useState(false);
  const {t} = useLang();

  const handleCopyPin = () => {
    if (!pin) return;
    navigator.clipboard.writeText(String(pin));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="sticky top-0 z-50 border-b-2 border-line bg-surface/95 text-ink shadow-sm backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-3 sm:h-16 sm:gap-3 sm:px-6 lg:px-8">
        <div onClick={() => setViewMode('TEACHER')} className="group flex min-w-0 shrink cursor-pointer items-center gap-2 sm:gap-3">
          <Logo className="h-9 w-9 transition-transform group-hover:scale-105 sm:h-11 sm:w-11" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap font-display text-base font-extrabold tracking-tight sm:text-xl md:text-2xl">
                Edu<span className="text-brand-500">Play</span>
              </span>
              <span className="hidden shrink-0 rounded-full border-2 border-violet-300 bg-violet-500/10 px-2 py-1 text-xs font-extrabold uppercase tracking-wider text-violet-400 lg:inline-block">
                {viewMode === 'TEACHER' ? t('nav_teacher_console') : t('nav_student_system')}
              </span>
            </div>
            <p className="hidden truncate text-xs font-semibold uppercase tracking-wide text-ink-faint md:block">{t('nav_subtitle')}</p>
          </div>
        </div>

        {pin && viewMode === 'TEACHER' && isTeacherAuth && (
          <button
            onClick={handleCopyPin}
            className="group flex h-10 shrink-0 items-center gap-2 rounded-xl border-2 border-brand-300 bg-surface-sunken px-3 shadow-[var(--shadow-sm)] transition-all hover:border-brand-500 sm:h-11 sm:px-4"
            title={t('pin_code')}
          >
            <span className="hidden text-xs font-extrabold uppercase tracking-wider text-ink-faint md:inline">{t('pin_code')}</span>
            <span className="font-display text-base font-black tracking-widest text-brand-400 sm:text-xl md:text-2xl">{pin}</span>
            {copied ? (
              <Check className="h-4 w-4 shrink-0 text-play-500 sm:h-5 sm:w-5" />
            ) : (
              <Copy className="h-4 w-4 shrink-0 text-ink-faint transition-colors group-hover:text-brand-500 sm:h-5 sm:w-5" />
            )}
            {copied && <span className="hidden text-xs font-black uppercase tracking-wider text-play-400 sm:inline">{t('copied')}</span>}
          </button>
        )}

        <div className="flex shrink-0 items-center gap-2">
          {viewMode === 'TEACHER' && isTeacherAuth && onLogoutTeacher && (
            <button
              onClick={onLogoutTeacher}
              aria-label={t('auth_logout')}
              className="flex h-10 items-center gap-1.5 rounded-xl border-2 border-danger-500/30 bg-danger-500/10 px-3 text-xs font-bold uppercase tracking-wider text-danger-400 transition-all hover:bg-danger-500/20 sm:text-sm"
              title={t('auth_logout')}
            >
              <LogOut className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
              <span className="hidden md:inline">{t('auth_logout')}</span>
            </button>
          )}
          <LangSwitcher compact />
        </div>
      </div>
    </header>
  );
};

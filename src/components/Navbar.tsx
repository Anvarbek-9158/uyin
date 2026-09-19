import React, { useState, useRef, useEffect } from 'react';
import { Copy, Check, LogOut, Languages, ChevronDown } from 'lucide-react';
import { useLang, Language } from '../i18n';
import { Logo } from './Logo';

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

const LANG_OPTIONS: { value: Language; label: string }[] = [
  { value: 'uz', label: 'O\'zbek' },
{ value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
];

export const Navbar: React.FC<NavbarProps> = ({
  viewMode,
  setViewMode,
  pin,
  isTeacherAuth,
  onLogoutTeacher,
}) => {
  const [copied, setCopied] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const { lang, setLang, t } = useLang();
  const langRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const currentLang = LANG_OPTIONS.find((o) => o.value === lang) ?? LANG_OPTIONS[0];

  const handleCopyPin = () => {
    if (!pin) return;
    navigator.clipboard.writeText(String(pin));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSelectLang = (l: Language) => {
    setLang(l);
    setLangOpen(false);
  };

  return (
    <header className="bg-slate-900/95 border-b border-indigo-500/20 sticky top-0 z-50 text-white shadow-2xl backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-3">
        {/* Brand / Logo */}
        <div
          onClick={() => setViewMode('TEACHER')}
          className="flex items-center gap-2 sm:gap-3 cursor-pointer group min-w-0 shrink"
        >
          <Logo className="w-9 h-9 sm:w-11 sm:h-11 drop-shadow-[0_0_12px_rgba(99,102,241,0.55)] group-hover:scale-105 transition-transform" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-black text-base sm:text-xl md:text-2xl tracking-tight whitespace-nowrap">
                <span className="text-white">Edu</span>
                <span className="text-indigo-400">Play</span>
              </span>
              <span className="text-xs uppercase font-extrabold tracking-wider px-2 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 hidden lg:inline-block shrink-0">
                {viewMode === 'TEACHER' ? t('nav_teacher_console') : t('nav_student_system')}
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium tracking-wide uppercase hidden md:block truncate">
              {t('nav_subtitle')}
            </p>
          </div>
        </div>

        {/* Center: Interactive PIN Badge */}
        {pin && viewMode === 'TEACHER' && isTeacherAuth && (
          <button
            onClick={handleCopyPin}
            className="flex items-center gap-2 px-3 sm:px-4 h-10 sm:h-11 rounded-xl bg-slate-950 hover:bg-slate-800 border border-indigo-500/50 shadow-[0_0_15px_rgba(79,70,229,0.25)] transition-all cursor-pointer group shrink-0"
            title={t('pin_code')}
          >
            <span className="text-xs text-slate-300 uppercase font-extrabold tracking-wider hidden md:inline">
              {t('pin_code')}
            </span>
            <span className=" font-black text-indigo-400 text-base sm:text-xl md:text-2xl tracking-widest">
              {pin}
            </span>
            {copied ? (
              <Check className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
            ) : (
              <Copy className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 group-hover:text-indigo-300 transition-colors shrink-0" />
            )}
            {copied && (
              <span className="text-xs text-emerald-400 font-black uppercase tracking-wider hidden sm:inline">
                {t('copied')}
              </span>
            )}
          </button>
        )}

        {/* Right Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Teacher Actions */}
          {viewMode === 'TEACHER' && isTeacherAuth && (
            <>
              {onLogoutTeacher && (
                <button
                  onClick={onLogoutTeacher}
                  aria-label={t('auth_logout')}
                  className="flex items-center gap-1.5 px-3 h-10 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 border border-rose-500/40 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all cursor-pointer"
                  title={t('auth_logout')}
                >
                  <LogOut className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400 shrink-0" />
                  <span className="hidden md:inline">{t('auth_logout')}</span>
                </button>
              )}
            </>
          )}

          {/* Language Selector (replaces sound button) */}
          <div className="relative" ref={langRef}>
            <button
              onClick={() => setLangOpen((o) => !o)}
              aria-label={t('lang_select')}
              className="flex items-center gap-1.5 px-3 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-all border border-white/10 shrink-0 cursor-pointer"
              title={t('lang_select')}
            >
              <Languages className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400 shrink-0" />
              <span className="hidden sm:inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider">
                {currentLang.value.toUpperCase()}
              </span>
              <span className="sm:hidden text-xs font-bold">{currentLang.value.toUpperCase()}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${langOpen ? 'rotate-180' : ''}`} />
            </button>

            {langOpen && (
              <div className="absolute right-0 top-full mt-2 w-44 rounded-2xl bg-slate-950/95 border border-white/10 shadow-2xl backdrop-blur-xl overflow-hidden z-[70] animate-fade-in">
                {LANG_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleSelectLang(opt.value)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-bold transition-colors cursor-pointer ${
                      lang === opt.value
                        ? 'bg-indigo-600/30 text-white border-l-2 border-indigo-400'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="uppercase tracking-wider">{opt.label}</span>
                    {lang === opt.value && <Check className="w-4 h-4 ml-auto text-indigo-300" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

import {useEffect, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {Bell, Check, ChevronDown, Languages, LogIn, Menu, Search, User} from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import {Logo} from './Logo';
import {useLang, type Language} from '../i18n';

const LANG_OPTIONS: {value: Language; label: string}[] = [
  {value: 'uz', label: 'UZB'},
  {value: 'ru', label: 'RUS'},
  {value: 'en', label: 'ENG'},
];

interface LangDropdownProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSelect: (l: Language) => void;
  triggerRef: React.RefObject<HTMLDivElement | null>;
  compact?: boolean;
}

// Accessible language picker: Escape closes it and restores focus to the
// trigger, aria attributes describe the listbox semantics for screen readers.
function LangDropdown({open, onToggle, onClose, onSelect, triggerRef, compact}: LangDropdownProps) {
  const {lang, t} = useLang();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerBtnRef = useRef<HTMLButtonElement | null>(null);
  const currentLang = LANG_OPTIONS.find((o) => o.value === lang) ?? LANG_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    // Move focus into the menu when it opens (listbox pattern).
    const first = menuRef.current?.querySelector<HTMLButtonElement>('[role="option"]');
    first?.focus();
    return () => {
      // Restore focus to the trigger when the menu closes (Escape, selection,
      // or click-outside).
      triggerBtnRef.current?.focus();
    };
  }, [open]);

  return (
    <div className="relative" ref={triggerRef}>
      <button
        ref={triggerBtnRef}
        type="button"
        onClick={onToggle}
        aria-label={t('lang_select')}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-700/60 bg-slate-800/60 text-xs font-bold uppercase tracking-wider text-slate-300 transition-colors hover:bg-slate-700 hover:text-white ${
          compact ? 'px-2.5' : 'px-3'
        }`}
      >
        <Languages className="h-4 w-4 text-indigo-400" />
        {currentLang.label}
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="listbox"
          aria-label={t('lang_select')}
          className="absolute right-0 top-full mt-2 w-44 overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900 py-1 shadow-card"
        >
          {LANG_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              role="option"
              type="button"
              aria-selected={lang === opt.value}
              onClick={() => {
                onSelect(opt.value);
                onClose();
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-bold transition-colors hover:bg-slate-800"
            >
              <span
                className={`uppercase tracking-wider ${
                  lang === opt.value ? 'text-indigo-400' : 'text-slate-300'
                }`}
              >
                {opt.label}
              </span>
              {lang === opt.value && <Check className="ml-auto h-4 w-4 text-indigo-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({onMenuClick}: HeaderProps) {
  const [langOpen, setLangOpen] = useState(false);
  const [langOpenMobile, setLangOpenMobile] = useState(false);
  const {setLang, t} = useLang();
  const langRef = useRef<HTMLDivElement | null>(null);
  const langRefMobile = useRef<HTMLDivElement | null>(null);

  const closeAllMenus = () => {
    setLangOpen(false);
    setLangOpenMobile(false);
  };

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const outsideDesktop = langRef.current && !langRef.current.contains(e.target as Node);
      const outsideMobile = langRefMobile.current && !langRefMobile.current.contains(e.target as Node);
      if (outsideDesktop || outsideMobile) {
        setLangOpen(false);
        setLangOpenMobile(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      // Escape closes any open dropdown (ARIA listbox pattern).
      if (e.key === 'Escape') {
        closeAllMenus();
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[100rem] items-center gap-2 px-3 sm:gap-3 sm:px-6 lg:px-8">
        {/* Mobile drawer trigger */}
        <button
          type="button"
          aria-label={t('menu_open')}
          onClick={onMenuClick}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700/60 bg-slate-800/60 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Brand */}
        <Link to="/" className="flex items-center gap-2 text-lg font-bold text-white">
          <Logo className="h-9 w-9" />
          <span className="hidden sm:inline">
            Edu<span className="text-indigo-400">Play</span>
          </span>
        </Link>

        {/* Global search */}
        <div className="ml-2 hidden max-w-md flex-1 md:block lg:ml-6">
          <label className="sr-only" htmlFor="topbar-search">
            {t('topbar_search')}
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="topbar-search"
              type="search"
              placeholder={t('topbar_search')}
              className="h-10 w-full rounded-xl border border-slate-700/60 bg-slate-900 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {/* Notifications */}
          <button
            type="button"
            aria-label={t('topbar_notifications')}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700/60 bg-slate-800/60 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-slate-900" />
          </button>

          {/* Profile chip */}
          <button
            type="button"
            aria-label={t('topbar_profile')}
            className="hidden items-center gap-2.5 rounded-xl border border-slate-700/60 bg-slate-800/60 py-1.5 pl-1.5 pr-3 text-left transition-colors hover:bg-slate-700 sm:inline-flex"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-glow-indigo">
              <User className="h-4 w-4" />
            </span>
            <span className="leading-tight">
              <span className="block text-xs font-bold text-white">EduPlayer</span>
              <span className="block text-xs font-medium text-slate-400">
                {t('nav_teacher_console')}
              </span>
            </span>
          </button>

          {/* Desktop controls */}
          <div className="hidden md:flex md:items-center md:gap-2">
            <ThemeToggle />

            <LangDropdown
              open={langOpen}
              onToggle={() => setLangOpen((v) => !v)}
              onClose={() => setLangOpen(false)}
              onSelect={setLang}
              triggerRef={langRef}
            />

            <Link
              to="/teacher/auth"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 text-sm font-semibold text-white shadow-glow-indigo transition-all hover:from-indigo-500 hover:to-violet-500"
            >
              <LogIn className="h-4 w-4" />
              {t('auth_login_signup')}
            </Link>
          </div>

          {/* Mobile controls */}
          <div className="flex items-center gap-1.5 md:hidden">
            <ThemeToggle />
            <LangDropdown
              open={langOpenMobile}
              onToggle={() => setLangOpenMobile((v) => !v)}
              onClose={() => setLangOpenMobile(false)}
              onSelect={setLang}
              triggerRef={langRefMobile}
              compact
            />
          </div>
        </div>
      </div>
    </header>
  );
}
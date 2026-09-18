import {useEffect, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {Check, ChevronDown, Languages, LogIn, LogOut, Menu} from 'lucide-react';
import {Logo} from './Logo';
import {useLang, type Language} from '../i18n';
import {useAuth} from '../context/AuthContext';

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
  const {user, isAuthenticated, logout} = useAuth();
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

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {/* Profile chip — only shown when authenticated */}
          {isAuthenticated && user && (
            <button
              type="button"
              aria-label={t('topbar_profile')}
              className="hidden items-center gap-2.5 rounded-xl border border-slate-700/60 bg-slate-800/60 py-1.5 pl-1.5 pr-3 text-left transition-colors hover:bg-slate-700 sm:inline-flex"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white shadow-glow-indigo">
                {user.name.trim().charAt(0).toUpperCase() || 'U'}
              </span>
              <span className="leading-tight">
                <span className="block max-w-40 truncate text-xs font-bold text-white">
                  {user.name}
                </span>
                <span className="block max-w-40 truncate text-xs font-medium text-slate-400">
                  {user.email}
                </span>
              </span>
            </button>
          )}

          {/* Desktop controls */}
          <div className="hidden md:flex md:items-center md:gap-2">
            <LangDropdown
              open={langOpen}
              onToggle={() => setLangOpen((v) => !v)}
              onClose={() => setLangOpen(false)}
              onSelect={setLang}
              triggerRef={langRef}
            />

            {isAuthenticated ? (
              <button
                type="button"
                onClick={logout}
                data-testid="header-logout"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-800/60 px-3.5 text-sm font-semibold text-slate-300 transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400"
              >
                <LogOut className="h-4 w-4" />
                {t('auth_logout')}
              </button>
            ) : (
              <Link
                to="/teacher/auth"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 text-sm font-semibold text-white shadow-glow-indigo transition-all hover:from-indigo-500 hover:to-violet-500"
              >
                <LogIn className="h-4 w-4" />
                {t('auth_login_signup')}
              </Link>
            )}
          </div>

          {/* Mobile controls */}
          <div className="flex items-center gap-1.5 md:hidden">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={logout}
                data-testid="header-logout-mobile"
                aria-label={t('auth_logout')}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700/60 bg-slate-800/60 text-slate-300 transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400"
              >
                <LogOut className="h-4 w-4" />
              </button>
            ) : (
              <Link
                to="/teacher/auth"
                aria-label={t('auth_login_signup')}
                title={t('auth_login_signup')}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-2.5 text-xs font-semibold text-white shadow-glow-indigo transition-all hover:from-indigo-500 hover:to-violet-500 sm:px-3"
              >
                <LogIn className="h-4 w-4 shrink-0" />
                <span className="hidden [@media(min-width:480px)]:inline">{t('auth_login_signup')}</span>
              </Link>
            )}
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
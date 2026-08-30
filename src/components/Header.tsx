import {useEffect, useRef, useState} from 'react';
import {Link, NavLink} from 'react-router-dom';
import {Check, ChevronDown, GraduationCap, Languages, LogIn, Menu, X} from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import {useLang, type Language} from '../i18n';

const LANG_OPTIONS: {value: Language; label: string}[] = [
  {value: 'uz', label: 'UZB'},
  {value: 'ru', label: 'RUS'},
  {value: 'en', label: 'ENG'},
];

const navLinkClass = ({isActive}: {isActive: boolean}) =>
  `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
  }`;

export default function Header() {
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [langOpenMobile, setLangOpenMobile] = useState(false);
  const {lang, setLang, t} = useLang();
  const langRef = useRef<HTMLDivElement | null>(null);
  const langRefMobile = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const outsideDesktop = langRef.current && !langRef.current.contains(e.target as Node);
      const outsideMobile = langRefMobile.current && !langRefMobile.current.contains(e.target as Node);
      if (outsideDesktop || outsideMobile) {
        setLangOpen(false);
        setLangOpenMobile(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const currentLang = LANG_OPTIONS.find((o) => o.value === lang) ?? LANG_OPTIONS[0];

  const links = [
    {to: '/', label: t('nav_home'), end: true},
    {to: '/teacher', label: t('nav_teacher')},
    {to: '/student', label: t('nav_student')},
    {to: '/pricing', label: t('nav_pricing'), end: true},
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span>
            Edu<span className="text-indigo-600 dark:text-indigo-400">Play</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={navLinkClass}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />

          <div className="relative" ref={langRef}>
            <button
              type="button"
              onClick={() => setLangOpen((v) => !v)}
              aria-label={t('lang_select')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <Languages className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
              {currentLang.label}
              <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${langOpen ? 'rotate-180' : ''}`} />
            </button>

            {langOpen && (
              <div className="absolute right-0 top-full mt-2 w-44 rounded-2xl border border-slate-200 bg-white py-1 shadow-2xl dark:border-slate-700 dark:bg-slate-950">
                {LANG_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setLang(opt.value);
                      setLangOpen(false);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-bold transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <span
                      className={`uppercase tracking-wider ${
                        lang === opt.value
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {opt.label}
                    </span>
                    {lang === opt.value && <Check className="ml-auto h-4 w-4 text-indigo-500" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Link
            to="/teacher/auth"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            <LogIn className="h-4 w-4" />
            {t('auth_login_signup')}
          </Link>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <div className="relative" ref={langRefMobile}>
            <button
              type="button"
              onClick={() => setLangOpenMobile((v) => !v)}
              aria-label={t('lang_select')}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <Languages className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
              {currentLang.label}
              <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${langOpenMobile ? 'rotate-180' : ''}`} />
            </button>

            {langOpenMobile && (
              <div className="absolute right-0 top-full mt-2 w-44 rounded-2xl border border-slate-200 bg-white py-1 shadow-2xl dark:border-slate-700 dark:bg-slate-950">
                {LANG_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setLang(opt.value);
                      setLangOpenMobile(false);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-bold transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <span
                      className={`uppercase tracking-wider ${
                        lang === opt.value
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {opt.label}
                    </span>
                    {lang === opt.value && <Check className="ml-auto h-4 w-4 text-indigo-500" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label={t('menu_open')}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950 md:hidden">
          <nav className="flex flex-col gap-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                onClick={() => setOpen(false)}
                className={navLinkClass}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}

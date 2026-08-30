import {useState} from 'react';
import {Link, NavLink, useLocation} from 'react-router-dom';
import {Gamepad2, GraduationCap, LogIn, Menu, X} from 'lucide-react';
import ThemeToggle from './ThemeToggle';

const navLinkClass = ({isActive}: {isActive: boolean}) =>
  `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
  }`;

export default function Header() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const authPath =
    location.pathname.startsWith('/teacher') && !location.pathname.includes('/auth')
      ? '/teacher/auth'
      : location.pathname.startsWith('/student')
        ? '/student/auth'
        : '/teacher/auth';

  const links = [
    {to: '/', label: 'Bosh sahifa', end: true},
    {to: '/teacher', label: 'Teacher'},
    {to: '/student', label: 'Student'},
    {to: '/pricing', label: 'Narxlar', end: true},
    {to: '/game', label: 'O‘yin', end: false},
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
          <Link
            to="/game"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
          >
            <Gamepad2 className="h-4 w-4" />
            O‘ynash
          </Link>
          <Link
            to={authPath}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            <LogIn className="h-4 w-4" />
            Kirish / Roʻyxatdan oʻtish
          </Link>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            aria-label="Menyu"
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
            <Link
              to="/game"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
            >
              <Gamepad2 className="h-4 w-4" />
              O‘ynash
            </Link>
            <Link
              to={authPath}
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
            >
              <LogIn className="h-4 w-4" />
              Kirish / Roʻyxatdan oʻtish
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

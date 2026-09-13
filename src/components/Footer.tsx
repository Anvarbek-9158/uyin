import {Link} from 'react-router-dom';
import {GraduationCap} from 'lucide-react';
import {useLang} from '../i18n';

export default function Footer() {
  const {t} = useLang();
  return (
    <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
              <GraduationCap className="h-4 w-4" />
            </span>
            <span className="font-bold text-slate-900 dark:text-white">
              Edu<span className="text-indigo-600 dark:text-indigo-400">Play</span>
            </span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-600 dark:text-slate-400">
            <Link to="/" className="transition-colors hover:text-slate-900 dark:hover:text-white">
              {t('nav_home')}
            </Link>
            <Link to="/teacher" className="transition-colors hover:text-slate-900 dark:hover:text-white">
              {t('nav_teacher')}
            </Link>
            <Link to="/student" className="transition-colors hover:text-slate-900 dark:hover:text-white">
              {t('nav_student')}
            </Link>
            <Link to="/pricing" className="transition-colors hover:text-slate-900 dark:hover:text-white">
              {t('nav_pricing')}
            </Link>
          </nav>
        </div>
        <p className="mt-8 text-center text-sm text-slate-400 dark:text-slate-500">
          {t('footer_tag')}
        </p>
      </div>
    </footer>
  );
}

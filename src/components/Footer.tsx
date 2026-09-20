import {Link} from 'react-router-dom';
import {useLang} from '../i18n';
import {Logo} from './Logo';

export default function Footer() {
  const {t} = useLang();
  return (
    <footer className="border-t-2 border-line bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <Logo className="h-8 w-8" />
            <span className="font-display font-extrabold text-ink">
              Edu<span className="text-brand-400">Play</span>
            </span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-6 text-sm font-semibold text-ink-soft">
            <Link to="/" className="transition-colors hover:text-ink">
              {t('nav_home')}
            </Link>
            <Link to="/teacher" className="transition-colors hover:text-ink">
              {t('nav_teacher')}
            </Link>
            <Link to="/student" className="transition-colors hover:text-ink">
              {t('nav_student')}
            </Link>
            <Link to="/pricing" className="transition-colors hover:text-ink">
              {t('nav_pricing')}
            </Link>
          </nav>
        </div>
        <p className="mt-8 text-center text-sm text-ink-faint">{t('footer_tag')}</p>
      </div>
    </footer>
  );
}

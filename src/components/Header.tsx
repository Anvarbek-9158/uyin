import {useState} from 'react';
import {Menu, X, LayoutGrid, GraduationCap, Users, CreditCard, LogOut, Sparkles} from 'lucide-react';
import {NavLink, Link, useLocation} from 'react-router-dom';
import {useLang} from '../i18n';
import {useAuth} from '../context/AuthContext';
import {Logo} from './Logo';
import {LangSwitcher} from './LangSwitcher';
import {Button} from '../ui/Button';
import {Badge} from '../ui/Badge';

const NAV_ITEMS = [
  {to: '/', label: 'nav_home', icon: LayoutGrid, end: true},
  {to: '/teacher', label: 'nav_teacher', icon: GraduationCap, end: false},
  {to: '/student', label: 'nav_student', icon: Users, end: false},
  {to: '/pricing', label: 'nav_pricing', icon: CreditCard, end: false},
];

export default function Header() {
  const {t} = useLang();
  const {pathname} = useLocation();
  const {user, isAuthenticated, logout} = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b-2 border-line bg-surface/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5 font-display text-lg font-bold text-ink" onClick={() => setMenuOpen(false)}>
          <Logo className="h-9 w-9" />
          Edu<span className="text-brand-500">Play</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV_ITEMS.map((item) => {
            const active = item.end ? pathname === item.to : pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={[
                  'rounded-full px-4 py-2 text-sm font-bold transition-colors',
                  active ? 'bg-brand-500/10 text-brand-400' : 'text-ink-soft hover:bg-surface-raised hover:text-ink',
                ].join(' ')}
              >
                {t(item.label)}
              </NavLink>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5">
          <div className="hidden sm:block">
            <LangSwitcher />
          </div>
          {isAuthenticated && user ? (
            <div className="hidden items-center gap-2 rounded-full border-2 border-line py-1 pl-1.5 pr-3 sm:flex">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet-500 text-xs font-extrabold text-white">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-bold text-ink">{user.name.split(' ')[0]}</span>
              {user.plan === 'pro' && (
                <Badge tone="warn" icon={<Sparkles className="h-3 w-3" />}>
                  PRO
                </Badge>
              )}
              <button onClick={logout} aria-label={t('auth_logout')} className="ml-1 text-ink-faint hover:text-danger-500">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Link to="/teacher/auth" className="hidden sm:block">
              <Button size="sm">{t('auth_login_signup')}</Button>
            </Link>
          )}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={t('menu_open')}
            className="rounded-lg p-2 text-ink-soft hover:bg-surface-raised lg:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t-2 border-line bg-surface px-4 py-4 lg:hidden animate-[var(--animate-fade-up)]">
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active = item.end ? pathname === item.to : pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMenuOpen(false)}
                  className={[
                    'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold',
                    active ? 'bg-brand-500/10 text-brand-400' : 'text-ink-soft',
                  ].join(' ')}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  {t(item.label)}
                </NavLink>
              );
            })}
          </nav>
          <div className="mt-3 flex items-center gap-2.5 border-t-2 border-line pt-3">
            <LangSwitcher />
            {isAuthenticated ? (
              <Button variant="outline" size="sm" fullWidth onClick={logout} icon={<LogOut className="h-4 w-4" />}>
                {t('auth_logout')}
              </Button>
            ) : (
              <Link to="/teacher/auth" className="flex-1" onClick={() => setMenuOpen(false)}>
                <Button size="sm" fullWidth>
                  {t('auth_login_signup')}
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

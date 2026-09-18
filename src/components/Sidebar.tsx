import {useEffect} from 'react';
import {NavLink, useLocation} from 'react-router-dom';
import {
  GraduationCap,
  LayoutGrid,
  CreditCard,
  LogOut,
  Users,
  X,
} from 'lucide-react';
import {useLang} from '../i18n';
import {useAuth} from '../context/AuthContext';
import {Logo} from './Logo';

const NAV_ITEMS = [
  {to: '/', label: 'nav_home', icon: LayoutGrid, end: true},
  {to: '/teacher', label: 'nav_teacher', icon: GraduationCap, end: false},
  {to: '/student', label: 'nav_student', icon: Users, end: false},
  {to: '/pricing', label: 'nav_pricing', icon: CreditCard, end: true},
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({open, onClose}: SidebarProps) {
  const {t} = useLang();
  const {pathname} = useLocation();
  const {user, isAuthenticated, logout} = useAuth();

  // Any navigation closes the mobile drawer.
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-800 bg-slate-900/95 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label={t('nav_aria')}
      >
        {/* Brand */}
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-800 px-5">
          <Logo className="h-9 w-9" />
          <LinkBrand />
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-5">
          <span className="px-3 pb-2 text-xs font-bold uppercase tracking-widest text-slate-500">
            {t('nav_home')} / {t('nav_teacher')}
          </span>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({isActive}) =>
                `group relative flex h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-glow-indigo'
                    : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
                }`
              }
            >
              {({isActive}) => (
                <>
                  <span
                    className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full transition-all ${
                      isActive ? 'bg-white' : 'bg-transparent'
                    }`}
                  />
                  <item.icon
                    className={`h-5 w-5 shrink-0 transition-transform group-hover:scale-110 ${
                      isActive ? 'text-white' : 'text-indigo-400'
                    }`}
                  />
                  {t(item.label)}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom: signed-in account card or sign-in CTA */}
        <div className="shrink-0 border-t border-slate-800 p-4">
          {isAuthenticated && user ? (
            <div className="rounded-2xl border border-slate-700/60 bg-slate-800/50 p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white shadow-glow-indigo">
                  {user.name.trim().charAt(0).toUpperCase() || 'U'}
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-sm font-bold text-white">{user.name}</span>
                  <span className="block truncate text-xs font-medium text-slate-400">
                    {user.email}
                  </span>
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${
                      user.plan === 'pro'
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-slate-700/60 text-slate-400'
                    }`}
                  >
                    {user.plan === 'pro' ? 'PRO' : t('plan_free')}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={logout}
                  data-testid="sidebar-logout"
                  title={t('auth_logout')}
                  aria-label={t('auth_logout')}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-700/60 text-slate-400 transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <NavLink
              to="/teacher/auth"
              className="block rounded-2xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3.5 text-center transition-all hover:border-indigo-400/60 hover:bg-indigo-500/20"
            >
              <span className="block text-sm font-bold text-white">{t('auth_login_signup')}</span>
              <span className="mt-0.5 block text-xs font-medium text-indigo-300">
                {t('nav_teacher_console')}
              </span>
            </NavLink>
          )}
        </div>
      </aside>
    </>
  );
}

function LinkBrand() {
  return (
    <span className="text-lg font-bold tracking-tight text-white">
      Edu<span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">Play</span>
    </span>
  );
}
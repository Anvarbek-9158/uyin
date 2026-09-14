import {useState, type FormEvent} from 'react';
import {useNavigate} from 'react-router-dom';
import {CheckCircle2, Mail, Loader2, Lock, User as UserIcon} from 'lucide-react';
import {useAuth, authErrorMessage} from '../context/AuthContext';
import {useLang} from '../i18n';
import {PASSWORD_MIN_LENGTH} from '../types';
import OAuthModal, {
  OAuthIcon,
  type OAuthProvider,
} from './OAuthModal';

export type Role = 'teacher' | 'student';
type Mode = 'login' | 'signup';

export interface AuthFormProps {
  role: Role;
  accent: 'indigo' | 'emerald';
}

const socials: {id: OAuthProvider; label: string}[] = [
  {id: 'google', label: 'Google'},
  {id: 'github', label: 'GitHub'},
  {id: 'apple', label: 'Apple ID'},
];

export default function AuthForm({role, accent}: AuthFormProps) {
  const navigate = useNavigate();
  const {t} = useLang();
  const {login, signup} = useAuth();
  const [mode, setMode] = useState<Mode>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<OAuthProvider | null>(null);

  const resolvedRole = role === 'teacher' ? t('auth_role_teacher') : t('auth_role_student');

  const primary =
    accent === 'indigo'
      ? {
          bg: 'bg-indigo-600 hover:bg-indigo-700',
          ring: 'focus:ring-indigo-200 dark:focus:ring-indigo-500/20',
          soft: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400',
        }
      : {
          bg: 'bg-emerald-600 hover:bg-emerald-700',
          ring: 'focus:ring-emerald-200 dark:focus:ring-emerald-500/20',
          soft: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
        };

  const resolveDestination = () => (role === 'teacher' ? '/game' : '/play');

  const clearErrors = () => {
    if (error) setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);

    const input = {email: email.trim(), password, role};
    const result =
      mode === 'signup' ? await signup({...input, name: name.trim()}) : await login(input);
    setBusy(false);

    if (!result.ok) {
      setError(authErrorMessage(t, result.code, result.message));
      return;
    }

    if (role === 'teacher') {
      sessionStorage.setItem('teacher_auth', 'true');
    }
    setSuccess(true);
    setTimeout(() => navigate(resolveDestination()), 1200);
  };

  const handleOAuthSuccess = () => {
    setActiveProvider(null);
    if (role === 'teacher') {
      sessionStorage.setItem('teacher_auth', 'true');
    }
    setSuccess(true);
    setTimeout(() => navigate(resolveDestination()), 1200);
  };

  const inputClass = `w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 outline-none transition focus:ring-2 ${primary.ring} dark:border-slate-700 dark:bg-slate-900 dark:text-white`;

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
      <div className={`h-1.5 w-full bg-gradient-to-r ${accent === 'indigo' ? 'from-indigo-500 to-blue-500' : 'from-emerald-500 to-teal-500'}`} />

      <div className="p-6 sm:p-8">
        {success ? (
          <div className="flex flex-col items-center py-10 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
              <CheckCircle2 className="h-9 w-9 animate-pop" />
            </span>
            <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
              {t('auth_success_title')}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t('auth_success_sub').replace('{role}', resolvedRole)}
            </p>
          </div>
        ) : (
          <>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                {resolvedRole} {t('auth_login')}
              </h2>
              <p className="mt-1 text-slate-500 dark:text-slate-400">
                {mode === 'signup' ? t('auth_create_account') : t('auth_login_to_account')}
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  clearErrors();
                }}
                className={`flex h-10 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                  mode === 'signup'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {t('auth_signup')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  clearErrors();
                }}
                className={`flex h-10 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                  mode === 'login'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {t('auth_login')}
              </button>
            </div>

            <div className="mt-6 grid gap-3">
              {socials.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  data-testid={`oauth-${s.id}`}
                  onClick={() => {
                    clearErrors();
                    setActiveProvider(s.id);
                  }}
                  className="inline-flex h-10 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700"
                >
                  <OAuthIcon provider={s.id} />
                  {(mode === 'signup' ? t('auth_via_signup') : t('auth_via_login')).replace(
                    '{label}',
                    s.label
                  )}
                </button>
              ))}
            </div>

            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {t('auth_or_email')}
              </span>
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            </div>

            {error && (
              <div
                role="alert"
                className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
              {mode === 'signup' && (
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t('auth_name')}
                  </span>
                  <div className="relative">
                    <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        clearErrors();
                      }}
                      placeholder={t('auth_name_placeholder')}
                      autoComplete="name"
                      className={`${inputClass} pl-10`}
                    />
                  </div>
                </label>
              )}

              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {t('auth_email')}
                </span>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      clearErrors();
                    }}
                    placeholder={t('auth_email_placeholder')}
                    autoComplete="email"
                    className={`${inputClass} pl-10`}
                  />
                </div>
              </label>

              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {t('auth_password')}
                </span>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={PASSWORD_MIN_LENGTH}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearErrors();
                    }}
                    placeholder={t('auth_password_placeholder')}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    className={`${inputClass} pl-10`}
                  />
                </div>
              </label>

              <button
                type="submit"
                data-testid="auth-submit"
                disabled={busy}
                className={`mt-1 inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-60 ${primary.bg}`}
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === 'signup' ? t('auth_submit_signup') : t('auth_submit_login')}
              </button>
            </form>
          </>
        )}
      </div>

      {activeProvider && !success && (
        <OAuthModal
          provider={activeProvider}
          role={role}
          accent={accent}
          onClose={() => setActiveProvider(null)}
          onSuccess={handleOAuthSuccess}
        />
      )}
    </div>
  );
}
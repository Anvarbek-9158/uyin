import {useState, type FormEvent} from 'react';
import {useNavigate} from 'react-router-dom';
import {CheckCircle2, Mail, Loader2, Lock, User as UserIcon} from 'lucide-react';
import {useAuth, authErrorMessage} from '../context/AuthContext';
import {useLang} from '../i18n';
import {PASSWORD_MIN_LENGTH} from '../types';

export type Role = 'teacher' | 'student';
type Mode = 'login' | 'signup';

export interface AuthFormProps {
  role: Role;
  accent: 'indigo' | 'emerald';
}

const socials = [
  {
    id: 'google',
    label: 'Google',
    svg: (
      <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.1 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.2 6.2 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.2 6.2 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.1 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
      </svg>
    ),
  },
  {
    id: 'github',
    label: 'GitHub',
    svg: (
      <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z" />
      </svg>
    ),
  },
  {
    id: 'apple',
    label: 'Apple ID',
    svg: (
      <svg className="h-5 w-5 fill-current" viewBox="0 0 384 512" aria-hidden="true">
        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
      </svg>
    ),
  },
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
                <div
                  key={s.id}
                  className="relative flex items-center"
                  title={t('auth_social_soon')}
                >
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    className="inline-flex h-10 w-full cursor-not-allowed items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-400 opacity-70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500"
                  >
                    {s.svg}
                    {(mode === 'signup' ? t('auth_via_signup') : t('auth_via_login')).replace(
                      '{label}',
                      s.label
                    )}
                  </button>
                  <span className="pointer-events-none absolute right-3 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:bg-slate-700 dark:text-slate-400">
                    {t('auth_social_soon')}
                  </span>
                </div>
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
    </div>
  );
}
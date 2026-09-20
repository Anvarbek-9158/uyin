import {useState, type FormEvent} from 'react';
import {useNavigate} from 'react-router-dom';
import {CheckCircle2, Mail, Loader2, Lock, User as UserIcon} from 'lucide-react';
import {useAuth, authErrorMessage} from '../context/AuthContext';
import {useLang} from '../i18n';
import {PASSWORD_MIN_LENGTH} from '../types';
import {Button} from '../ui/Button';
import {Input} from '../ui/Input';
import OAuthModal, {OAuthIcon, type OAuthProvider} from './OAuthModal';

export type Role = 'teacher' | 'student';
type Mode = 'login' | 'signup';

// `accent` names the role, not a literal color — 'indigo' means "teacher"
// and 'emerald' means "student" for historical reasons. It now maps to the
// brand/violet tokens below rather than to actual indigo/emerald colors.
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
  const buttonVariant = accent === 'indigo' ? 'brand' : 'violet';
  const barGradient = accent === 'indigo' ? 'from-brand-400 to-brand-600' : 'from-violet-400 to-violet-600';

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
    const result = mode === 'signup' ? await signup({...input, name: name.trim()}) : await login(input);
    setBusy(false);

    if (!result.ok) {
      setError(authErrorMessage(t, result.code, result.message));
      return;
    }

    if (role === 'teacher') sessionStorage.setItem('teacher_auth', 'true');
    setSuccess(true);
    setTimeout(() => navigate(resolveDestination()), 1200);
  };

  const handleOAuthSuccess = () => {
    setActiveProvider(null);
    if (role === 'teacher') sessionStorage.setItem('teacher_auth', 'true');
    setSuccess(true);
    setTimeout(() => navigate(resolveDestination()), 1200);
  };

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border-2 border-line bg-surface shadow-[var(--shadow-card)]">
      <div className={`h-2 w-full bg-gradient-to-r ${barGradient}`} />

      <div className="p-6 sm:p-8">
        {success ? (
          <div className="flex flex-col items-center py-10 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-play-500/15 text-play-400">
              <CheckCircle2 className="h-9 w-9 animate-[var(--animate-pop)]" />
            </span>
            <h2 className="mt-4 font-display text-xl font-bold text-ink">{t('auth_success_title')}</h2>
            <p className="mt-1 text-sm text-ink-soft">{t('auth_success_sub').replace('{role}', resolvedRole)}</p>
          </div>
        ) : (
          <>
            <div className="text-center">
              <h2 className="font-display text-2xl font-bold text-ink">
                {resolvedRole} {t('auth_login')}
              </h2>
              <p className="mt-1 text-ink-soft">{mode === 'signup' ? t('auth_create_account') : t('auth_login_to_account')}</p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-1 rounded-2xl bg-surface-raised p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  clearErrors();
                }}
                className={`flex h-10 items-center justify-center rounded-xl text-sm font-bold transition-colors ${
                  mode === 'signup' ? 'bg-surface text-ink shadow-sm' : 'text-ink-faint'
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
                className={`flex h-10 items-center justify-center rounded-xl text-sm font-bold transition-colors ${
                  mode === 'login' ? 'bg-surface text-ink shadow-sm' : 'text-ink-faint'
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
                  className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-xl border-2 border-line bg-surface px-4 text-sm font-bold text-ink transition-colors hover:bg-surface-raised"
                >
                  <OAuthIcon provider={s.id} />
                  {(mode === 'signup' ? t('auth_via_signup') : t('auth_via_login')).replace('{label}', s.label)}
                </button>
              ))}
            </div>

            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-line" />
              <span className="text-xs font-bold uppercase tracking-wide text-ink-faint">{t('auth_or_email')}</span>
              <span className="h-px flex-1 bg-line" />
            </div>

            {error && (
              <div role="alert" className="mb-4 rounded-xl border-2 border-danger-500/30 bg-danger-500/10 px-4 py-3 text-sm font-semibold text-danger-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
              {mode === 'signup' && (
                <label className="grid gap-1.5">
                  <span className="text-sm font-bold text-ink-soft">{t('auth_name')}</span>
                  <Input
                    icon={<UserIcon className="h-4 w-4" />}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      clearErrors();
                    }}
                    placeholder={t('auth_name_placeholder')}
                    autoComplete="name"
                  />
                </label>
              )}

              <label className="grid gap-1.5">
                <span className="text-sm font-bold text-ink-soft">{t('auth_email')}</span>
                <Input
                  type="email"
                  required
                  icon={<Mail className="h-4 w-4" />}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearErrors();
                  }}
                  placeholder={t('auth_email_placeholder')}
                  autoComplete="email"
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-sm font-bold text-ink-soft">{t('auth_password')}</span>
                <Input
                  type="password"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  icon={<Lock className="h-4 w-4" />}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearErrors();
                  }}
                  placeholder={t('auth_password_placeholder')}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
              </label>

              <Button
                type="submit"
                data-testid="auth-submit"
                disabled={busy}
                variant={buttonVariant}
                fullWidth
                className="mt-1"
                icon={busy ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
              >
                {mode === 'signup' ? t('auth_submit_signup') : t('auth_submit_login')}
              </Button>
            </form>
          </>
        )}
      </div>

      {activeProvider && !success && (
        <OAuthModal provider={activeProvider} role={role} accent={accent} onClose={() => setActiveProvider(null)} onSuccess={handleOAuthSuccess} />
      )}
    </div>
  );
}

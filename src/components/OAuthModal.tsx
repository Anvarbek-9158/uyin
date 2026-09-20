import {useEffect, useRef, useState, type FormEvent} from 'react';
import {Loader2, Mail, User as UserIcon, X} from 'lucide-react';
import {useAuth} from '../context/AuthContext';
import {useLang} from '../i18n';
import {Button} from '../ui/Button';
import {Input} from '../ui/Input';
import type {Role} from './AuthForm';

export type OAuthProvider = 'google' | 'github' | 'apple';

export const OAUTH_LABELS: Record<OAuthProvider, string> = {
  google: 'Google',
  github: 'GitHub',
  apple: 'Apple ID',
};

// Branded monochrome glyphs (same icons as the auth page social buttons).
export function OAuthIcon({provider, className}: {provider: OAuthProvider; className?: string}) {
  const base = className ?? 'h-5 w-5';
  if (provider === 'google') {
    return (
      <svg className={base} viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.1 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.2 6.2 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.2 6.2 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.1 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
      </svg>
    );
  }
  if (provider === 'github') {
    return (
      <svg className={base} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z" />
      </svg>
    );
  }
  return (
    <svg className={base} viewBox="0 0 384 512" fill="currentColor" aria-hidden="true">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}

interface OAuthModalProps {
  provider: OAuthProvider;
  role: Role;
  accent: 'indigo' | 'emerald';
  onClose: () => void;
  onSuccess: () => void;
}

export default function OAuthModal({provider, role, accent, onClose, onSuccess}: OAuthModalProps) {
  const {t} = useLang();
  const {oauthLogin} = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);

  const buttonVariant = accent === 'indigo' ? 'brand' : 'violet';
  const barGradient = accent === 'indigo' ? 'from-brand-400 to-brand-600' : 'from-violet-400 to-violet-600';

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // NOTE: this demo flow trusts the name/email the person types in the form
  // — there is no real round trip to Google/GitHub/Apple to verify identity
  // (no id_token check server-side). Do not treat a successful call here as
  // proof of who the person actually is; wire up a real OAuth exchange
  // before relying on this for anything sensitive.
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    const result = await oauthLogin({provider, name: name.trim(), email: email.trim(), role});
    if (!result.ok) {
      setBusy(false);
      // TEMPORARY: append the raw diagnostic (see AuthResult.debug) so the
      // real cause is visible directly in the error box, no DevTools
      // needed. Remove once the production OAuth issue is confirmed fixed.
      const base = result.message || t('auth_err_generic');
      setError(result.debug ? `${base}\n\n[debug] ${result.debug}` : base);
      return;
    }
    onSuccess();
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('oauth_title').replace('{label}', OAUTH_LABELS[provider])}
    >
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-sm overflow-hidden rounded-[var(--radius-card)] border-2 border-line bg-surface shadow-[var(--shadow-card-hover)]">
        <div className={`h-2 w-full bg-gradient-to-r ${barGradient}`} />
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="absolute right-3 top-5 inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-surface-raised hover:text-ink"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-line bg-surface-raised">
              <OAuthIcon provider={provider} />
            </span>
            <h3 className="mt-4 font-display text-xl font-bold text-ink">
              {t('oauth_title').replace('{label}', OAUTH_LABELS[provider])}
            </h3>
            <p className="mt-1 text-sm text-ink-soft">{t(role === 'teacher' ? 'oauth_sub_teacher' : 'oauth_sub_student')}</p>
          </div>

          {error && (
            <div role="alert" className="mt-5 rounded-xl border-2 border-danger-500/30 bg-danger-500/10 px-4 py-3 text-sm font-semibold text-danger-400 whitespace-pre-wrap break-words">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 grid gap-4" noValidate>
            <label className="grid gap-1.5">
              <span className="text-sm font-bold text-ink-soft">{t('auth_name')}</span>
              <Input
                ref={nameRef}
                value={name}
                data-testid="oauth-name"
                icon={<UserIcon className="h-4 w-4" />}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                placeholder={t('auth_name_placeholder')}
                autoComplete="name"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-sm font-bold text-ink-soft">{t('auth_email')}</span>
              <Input
                type="email"
                required
                value={email}
                data-testid="oauth-email"
                icon={<Mail className="h-4 w-4" />}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder={t('auth_email_placeholder')}
                autoComplete="email"
              />
            </label>

            <Button
              type="submit"
              disabled={busy}
              data-testid="oauth-submit"
              variant={buttonVariant}
              fullWidth
              className="mt-1"
              icon={busy ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
            >
              {t('oauth_continue')}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

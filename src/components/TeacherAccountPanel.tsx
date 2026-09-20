import {LogOut, Sparkles, Volume2, VolumeX, Mail, ShieldCheck} from 'lucide-react';
import {useAuth} from '../context/AuthContext';
import {useLang} from '../i18n';
import {Card} from '../ui/Card';
import {Button} from '../ui/Button';
import {Badge} from '../ui/Badge';
import {LangSwitcher} from './LangSwitcher';

interface TeacherAccountPanelProps {
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  onLogout: () => void;
}

// Account + settings merged into a single view, on purpose: the profile
// (who you are) and the preferences that affect how the console behaves
// (sound, language) are both "account-level" concerns, so splitting them
// into two separate sidebar destinations only made them harder to find.
export function TeacherAccountPanel({soundEnabled, setSoundEnabled, onLogout}: TeacherAccountPanelProps) {
  const {t} = useLang();
  const {user} = useAuth();

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet-500 font-display text-2xl font-extrabold text-white">
            {(user?.name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-xl font-bold text-ink">{user?.name || '—'}</h2>
            <p className="flex items-center gap-1.5 truncate text-sm text-ink-faint">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              {user?.email || '—'}
            </p>
          </div>
          {user?.plan === 'pro' ? (
            <Badge tone="warn" icon={<Sparkles className="h-3 w-3" />}>
              PRO
            </Badge>
          ) : (
            <Badge tone="neutral">FREE</Badge>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 flex items-center gap-2 font-display text-base font-bold text-ink">
          <ShieldCheck className="h-5 w-5 text-brand-400" />
          {t('tacc_preferences')}
        </h3>

        <div className="flex items-center justify-between border-b-2 border-line py-3.5">
          <div className="flex items-center gap-3">
            {soundEnabled ? <Volume2 className="h-5 w-5 text-play-400" /> : <VolumeX className="h-5 w-5 text-ink-faint" />}
            <span className="text-sm font-bold text-ink">{t('tacc_sound')}</span>
          </div>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            aria-pressed={soundEnabled}
            className={`relative h-7 w-12 rounded-full transition-colors ${soundEnabled ? 'bg-play-500' : 'bg-line-strong'}`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${soundEnabled ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between py-3.5">
          <span className="text-sm font-bold text-ink">{t('tacc_language')}</span>
          <LangSwitcher />
        </div>
      </Card>

      <Button variant="danger" fullWidth icon={<LogOut className="h-4 w-4" />} onClick={onLogout}>
        {t('auth_logout')}
      </Button>
    </div>
  );
}

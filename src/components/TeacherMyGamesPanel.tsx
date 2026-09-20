import {Gamepad2, RefreshCcw, Sparkles} from 'lucide-react';
import {useLang} from '../i18n';
import {Card} from '../ui/Card';
import {Button} from '../ui/Button';
import {Badge} from '../ui/Badge';

interface TeacherMyGamesPanelProps {
  pin: string | null;
  waitingCount: number;
  onCreateGame: () => void;
}

// The backend only tracks the single, currently-active PIN session (no
// persisted history of past games yet), so this panel is honest about that:
// it shows the live session as a card rather than a fake multi-game list.
export function TeacherMyGamesPanel({pin, waitingCount, onCreateGame}: TeacherMyGamesPanelProps) {
  const {t} = useLang();

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <h2 className="font-display text-xl font-bold text-ink">{t('tside_my_games')}</h2>

      {pin ? (
        <Card accent="brand" className="p-6">
          <div className="flex items-center justify-between">
            <Badge tone="brand" icon={<Sparkles className="h-3 w-3" />}>
              {t('tgames_active')}
            </Badge>
            <span className="text-xs font-bold text-ink-faint">{waitingCount} {t('tgames_waiting')}</span>
          </div>
          <p className="mt-4 font-display text-4xl font-black tracking-widest text-brand-400">{pin}</p>
          <p className="mt-1 text-sm text-ink-faint">{t('tgames_active_desc')}</p>
        </Card>
      ) : (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <Gamepad2 className="h-10 w-10 text-ink-faint" />
          <p className="text-sm font-semibold text-ink-soft">{t('tgames_empty')}</p>
        </Card>
      )}

      <Button variant="violet" icon={<RefreshCcw className="h-4 w-4" />} onClick={onCreateGame}>
        {t('tv_new_game')}
      </Button>
    </div>
  );
}

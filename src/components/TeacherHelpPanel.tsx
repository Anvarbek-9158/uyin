import {LifeBuoy, Mail} from 'lucide-react';
import {useLang} from '../i18n';
import {Card} from '../ui/Card';

export function TeacherHelpPanel() {
  const {t} = useLang();
  const faqKeys = ['help_q1', 'help_q2', 'help_q3', 'help_q4'];

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-400">
          <LifeBuoy className="h-6 w-6" />
        </span>
        <h2 className="font-display text-xl font-bold text-ink">{t('tside_help')}</h2>
      </div>

      <div className="space-y-3">
        {faqKeys.map((key) => (
          <Card key={key} className="p-5">
            <p className="font-bold text-ink">{t(`${key}_q`)}</p>
            <p className="mt-1.5 text-sm text-ink-soft">{t(`${key}_a`)}</p>
          </Card>
        ))}
      </div>

      <Card className="flex items-center gap-3 p-5">
        <Mail className="h-5 w-5 shrink-0 text-brand-400" />
        <p className="text-sm text-ink-soft">{t('help_contact')}</p>
      </Card>
    </div>
  );
}

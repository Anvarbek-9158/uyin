import {Link} from 'react-router-dom';
import {ArrowRight, Gamepad2, KeyRound, ListOrdered, Timer, TrendingUp, UserRound, Users} from 'lucide-react';
import {useLang} from '../i18n';
import {Card} from '../ui/Card';
import {Button} from '../ui/Button';
import {Badge} from '../ui/Badge';

export default function StudentSearch() {
  const {t} = useLang();

  const steps = [
    {icon: KeyRound, title: t('spl_step1_title'), desc: t('spl_step1_desc')},
    {icon: UserRound, title: t('spl_step2_title'), desc: t('spl_step2_desc')},
    {icon: Timer, title: t('spl_step3_title'), desc: t('spl_step3_desc')},
    {icon: TrendingUp, title: t('spl_step4_title'), desc: t('spl_step4_desc')},
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <Badge tone="play" icon={<Users className="h-4 w-4" />}>
          {t('spl_badge')}
        </Badge>
        <h1 className="mt-5 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">{t('spl_title')}</h1>
        <p className="mt-4 text-lg text-ink-soft">{t('spl_sub')}</p>

        <Link to="/play" className="mt-7 inline-block">
          <Button variant="play" size="lg" icon={<Gamepad2 className="h-5 w-5" />}>
            {t('spl_join')}
          </Button>
        </Link>
      </div>

      <div className="mt-14">
        <h2 className="font-display text-2xl font-bold text-ink">{t('spl_rules_title')}</h2>
        <p className="mt-1 text-ink-soft">{t('spl_rules_sub')}</p>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <Card key={s.title} accent="play" className="relative p-6">
              <span className="absolute -top-3.5 left-6 rounded-full bg-play-500 px-3 py-0.5 text-xs font-extrabold text-white shadow-[var(--shadow-pop-play)]">
                {i + 1}
              </span>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-play-500/15 text-play-400">
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-bold text-ink">{s.title}</h3>
              <p className="mt-1.5 text-sm text-ink-soft">{s.desc}</p>
            </Card>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <Link to="/play">
            <Button variant="play" icon={<ArrowRight className="h-4 w-4" />} className="flex-row-reverse">
              {t('spl_join')}
            </Button>
          </Link>
          <p className="flex items-center gap-1.5 text-sm text-ink-faint">
            <ListOrdered className="h-4 w-4" />
            {t('spl_badge')}
          </p>
        </div>
      </div>
    </div>
  );
}

import {Link} from 'react-router-dom';
import {ArrowRight, Brain, Clock, GraduationCap, LayoutDashboard, LineChart, LogIn, Radio, ShieldPlus, UserPlus, Zap} from 'lucide-react';
import {useLang} from '../i18n';
import {Card} from '../ui/Card';
import {Button} from '../ui/Button';
import {Badge} from '../ui/Badge';

export default function TeacherSearch() {
  const {t} = useLang();

  const features = [
    {icon: Clock, title: t('tpl_f1_title'), desc: t('tpl_f1_desc')},
    {icon: Zap, title: t('tpl_f2_title'), desc: t('tpl_f2_desc')},
    {icon: ShieldPlus, title: t('tpl_f3_title'), desc: t('tpl_f3_desc')},
    {icon: LineChart, title: t('tpl_f4_title'), desc: t('tpl_f4_desc')},
  ];

  const steps = [
    {icon: UserPlus, title: t('tpl_step1_title'), desc: t('tpl_step1_desc')},
    {icon: Brain, title: t('tpl_step2_title'), desc: t('tpl_step2_desc')},
    {icon: Radio, title: t('tpl_step3_title'), desc: t('tpl_step3_desc')},
    {icon: LayoutDashboard, title: t('tpl_step4_title'), desc: t('tpl_step4_desc')},
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <Badge tone="violet" icon={<GraduationCap className="h-4 w-4" />}>
          {t('tpl_badge')}
        </Badge>
        <h1 className="mt-5 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">{t('tpl_title')}</h1>
        <p className="mt-4 text-lg text-ink-soft">{t('tpl_sub')}</p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link to="/teacher/auth">
            <Button variant="violet" icon={<UserPlus className="h-4 w-4" />}>
              {t('tpl_signup')}
            </Button>
          </Link>
          <Link to="/teacher/auth">
            <Button variant="outline" icon={<LogIn className="h-4 w-4" />}>
              {t('tpl_login')}
            </Button>
          </Link>
        </div>
      </div>

      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <Card key={f.title} hoverable accent="violet" className="p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-400">
              <f.icon className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-bold text-ink">{f.title}</h3>
            <p className="mt-1.5 text-sm text-ink-soft">{f.desc}</p>
          </Card>
        ))}
      </div>

      <div className="mt-16">
        <h2 className="font-display text-2xl font-bold text-ink">{t('tpl_rules_title')}</h2>
        <p className="mt-1 text-ink-soft">{t('tpl_rules_sub')}</p>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <Card key={s.title} className="relative p-6">
              <span className="absolute -top-3.5 left-6 rounded-full bg-violet-500 px-3 py-0.5 text-xs font-extrabold text-white shadow-[var(--shadow-pop-violet)]">
                {i + 1}
              </span>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-bold text-ink">{s.title}</h3>
              <p className="mt-1.5 text-sm text-ink-soft">{s.desc}</p>
            </Card>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <Link to="/teacher/auth">
            <Button variant="play" size="lg" icon={<ArrowRight className="h-4 w-4" />} className="flex-row-reverse">
              {t('tpl_signup')}
            </Button>
          </Link>
          <p className="text-sm text-ink-faint">{t('tpl_badge')}</p>
        </div>
      </div>
    </div>
  );
}

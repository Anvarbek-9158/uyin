import {Link} from 'react-router-dom';
import {ArrowRight, Gamepad2, KeyRound, ListOrdered, Timer, TrendingUp, UserRound, Users} from 'lucide-react';
import {useLang} from '../i18n';

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
      {/* Header */}
      <div className="max-w-3xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          <Users className="h-4 w-4" />
          {t('spl_badge')}
        </span>
        <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          {t('spl_title')}
        </h1>
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">{t('spl_sub')}</p>

        <Link
          to="/play"
          className="mt-7 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition-transform hover:scale-105"
        >
          <Gamepad2 className="h-5 w-5" />
          {t('spl_join')}
        </Link>
      </div>

      {/* Game rules */}
      <div className="mt-14">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('spl_rules_title')}</h2>
        <p className="mt-1 text-slate-500 dark:text-slate-400">{t('spl_rules_sub')}</p>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <span className="absolute -top-3 left-6 rounded-full bg-emerald-600 px-3 py-0.5 text-xs font-bold text-white">
                {i + 1}
              </span>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold text-slate-900 dark:text-white">{s.title}</h3>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{s.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <Link
            to="/play"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-7 py-3.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
          >
            {t('spl_join')}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
            <ListOrdered className="h-4 w-4" />
            {t('spl_badge')}
          </p>
        </div>
      </div>
    </div>
  );
}

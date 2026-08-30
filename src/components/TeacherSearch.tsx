import {Link} from 'react-router-dom';
import {ArrowRight, Brain, Clock, GraduationCap, LayoutDashboard, LineChart, LogIn, Radio, ShieldPlus, UserPlus, Zap} from 'lucide-react';
import {useLang} from '../i18n';

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
      {/* Header */}
      <div className="max-w-3xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
          <GraduationCap className="h-4 w-4" />
          {t('tpl_badge')}
        </span>
        <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          {t('tpl_title')}
        </h1>
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">{t('tpl_sub')}</p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link
            to="/teacher/auth"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            <UserPlus className="h-4 w-4" />
            {t('tpl_signup')}
          </Link>
          <Link
            to="/teacher/auth"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <LogIn className="h-4 w-4" />
            {t('tpl_login')}
          </Link>
        </div>
      </div>

      {/* Benefits */}
      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <div
            key={f.title}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
              <f.icon className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-semibold text-slate-900 dark:text-white">{f.title}</h3>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Game rules / how it works */}
      <div className="mt-16">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('tpl_rules_title')}</h2>
        <p className="mt-1 text-slate-500 dark:text-slate-400">{t('tpl_rules_sub')}</p>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <span className="absolute -top-3 left-6 rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-bold text-white">
                {i + 1}
              </span>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold text-slate-900 dark:text-white">{s.title}</h3>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{s.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <Link
            to="/teacher/auth"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-7 py-3.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
          >
            {t('tpl_signup')}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('tpl_badge')}</p>
        </div>
      </div>
    </div>
  );
}

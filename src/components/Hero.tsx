import {Link} from 'react-router-dom';
import {ArrowRight, BookOpenCheck, Gamepad2, GraduationCap, Users, Gauge, Layers} from 'lucide-react';
import {useLang} from '../i18n';

export default function Hero() {
  const {t} = useLang();

  const features = [
    {icon: Users, title: t('hero_feat_1_title'), desc: t('hero_feat_1_desc')},
    {icon: Gamepad2, title: t('hero_feat_2_title'), desc: t('hero_feat_2_desc')},
    {icon: Gauge, title: t('hero_feat_3_title'), desc: t('hero_feat_3_desc')},
    {icon: Layers, title: t('hero_feat_4_title'), desc: t('hero_feat_4_desc')},
  ];

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-indigo-200/50 blur-3xl dark:bg-indigo-500/10" />
        <div className="absolute top-40 -right-24 h-72 w-72 rounded-full bg-violet-200/40 blur-3xl dark:bg-violet-500/10" />
      </div>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
            <BookOpenCheck className="h-4 w-4" />
            {t('hero_badge')}
          </span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl dark:text-white">
            {t('hero_title')}
          </h1>
          <p className="mt-6 text-lg text-slate-600 dark:text-slate-400">{t('hero_sub')}</p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/play"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-emerald-500/25 transition-transform hover:scale-105"
            >
              <Gamepad2 className="h-5 w-5" />
              {t('hero_play')}
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-8 py-3.5 text-base font-semibold text-slate-200 transition-all hover:border-indigo-500/50 hover:bg-slate-800 hover:text-white"
            >
              {t('hero_pricing')}
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-2">
          <Link
            to="/teacher"
            className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-card backdrop-blur transition-all hover:-translate-y-1 hover:border-indigo-500/40 hover:shadow-card-hover"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 to-blue-500" />
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-400 ring-1 ring-inset ring-indigo-500/30">
              <GraduationCap className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-2xl font-bold text-white">
              {t('hero_teacher_title')}
            </h2>
            <p className="mt-2 text-slate-400">{t('hero_teacher_desc')}</p>
            <div className="mt-6 flex items-center gap-2 font-semibold text-indigo-400">
              {t('hero_teacher_link')}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          <Link
            to="/student"
            className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-card backdrop-blur transition-all hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-card-hover"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 ring-1 ring-inset ring-emerald-500/30">
              <Users className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-2xl font-bold text-white">
              {t('hero_student_title')}
            </h2>
            <p className="mt-2 text-slate-400">{t('hero_student_desc')}</p>
            <div className="mt-6 flex items-center gap-2 font-semibold text-emerald-400">
              {t('hero_student_link')}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-indigo-500/40 hover:bg-slate-900 hover:shadow-glow-indigo"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400 ring-1 ring-inset ring-indigo-500/30 transition-transform group-hover:scale-110">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold text-white">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

import {Link} from 'react-router-dom';
import {ArrowRight, BookOpenCheck, Gamepad2, GraduationCap, Users, Layers, Search, Star} from 'lucide-react';

const features = [
  {icon: Users, title: 'Rollar bo‘yicha interfeys', desc: 'O‘qituvchi va o‘quvchi uchun alohida, moslashgan tajriba'},
  {icon: Search, title: 'Mustaqil qidiruv', desc: 'Har bir rol uchun alohida qidiruv tizimi'},
  {icon: Star, title: 'Real vaqt viktorinasi', desc: 'Pusher orqali sinf bo‘ylab jonli o‘yin va reyting'},
  {icon: Layers, title: 'Zamonaviy dizayn', desc: 'Dark / Light rejim, responsive va toza interfeys'},
];

export default function Hero() {
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
            Taʼlim platformasi
          </span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl dark:text-white">
            O‘qituvchi va o‘quvchini{' '}
            <span className="bg-gradient-to-r from-indigo-500 to-violet-600 bg-clip-text text-transparent">
              bog‘lovchi
            </span>{' '}
            yagona maydon
          </h1>
          <p className="mt-6 text-lg text-slate-600 dark:text-slate-400">
            O‘z rolini tanlang va platformaning o‘zingizga mos bor imkoniyatlaridan
            foydalaning — real vaqt rejimidagi viktorina, qidiruv, ro‘yxatdan
            o‘tish va moslashuvchan tariflar.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/game"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-emerald-500/25 transition-transform hover:scale-105"
            >
              <Gamepad2 className="h-5 w-5" />
              O‘ynashni boshlash
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-8 py-3.5 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Narxlarni ko‘rish
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-2">
          <Link
            to="/teacher"
            className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 to-blue-500" />
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
              <GraduationCap className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-2xl font-bold text-slate-900 dark:text-white">
              Men O‘qituvchiman
            </h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Kurslar, darslar va o‘quvchilarni boshqaring. O‘quvchilar va materiallarni toping.
            </p>
            <div className="mt-6 flex items-center gap-2 font-semibold text-indigo-600 dark:text-indigo-400">
              Teacher bo‘limi
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          <Link
            to="/student"
            className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
              <Users className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-2xl font-bold text-slate-900 dark:text-white">
              Men O‘quvchiman
            </h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              O‘qituvchilar, fanlar va kurslarni toping. O‘qishda davom eting.
            </p>
            <div className="mt-6 flex items-center gap-2 font-semibold text-emerald-600 dark:text-emerald-400">
              Student bo‘limi
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-slate-200 bg-white/60 p-5 dark:border-slate-800 dark:bg-slate-900/60"
            >
              <f.icon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

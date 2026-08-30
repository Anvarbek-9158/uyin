import {useMemo, useState} from 'react';
import {Users, Search, BookOpen, Mic2, ArrowRight} from 'lucide-react';

type Tab = 'teachers' | 'subjects' | 'courses';

const tabs: {id: Tab; label: string; icon: typeof Users}[] = [
  {id: 'teachers', label: 'O‘qituvchilar', icon: Users},
  {id: 'subjects', label: 'Fanlar', icon: BookOpen},
  {id: 'courses', label: 'Kurslar', icon: Mic2},
];

const data: Record<Tab, {name: string; meta: string; extra: string}[]> = {
  teachers: [
    {name: 'Kamola Ergasheva', meta: 'Matematika o‘qituvchisi', extra: '12 yil tajriba'},
    {name: 'Bekzod Nazarov', meta: 'Fizika o‘qituvchisi', extra: '8 yil tajriba'},
    {name: 'Gulnora Abdullaeva', meta: 'Ingliz tili o‘qituvchisi', extra: '10 yil tajriba'},
    {name: 'Rustam Mirzaev', meta: 'Informatika o‘qituvchisi', extra: '6 yil tajriba'},
    {name: 'Zilola Qodirova', meta: 'Kimyo o‘qituvchisi', extra: '9 yil tajriba'},
  ],
  subjects: [
    {name: 'Matematika', meta: 'Algebra & Geometriya', extra: '3 o‘qituvchi'},
    {name: 'Fizika', meta: 'Mexanika & Elektromagnetizm', extra: '2 o‘qituvchi'},
    {name: 'Ingliz tili', meta: 'Grammar & Speaking', extra: '4 o‘qituvchi'},
    {name: 'Dasturlash', meta: 'Python & Web', extra: '2 o‘qituvchi'},
    {name: 'Kimyo', meta: 'Organik & Noorganik', extra: '1 o‘qituvchi'},
  ],
  courses: [
    {name: 'Matematika 9-sinf', meta: 'Kamola Ergasheva', extra: '32 dars'},
    {name: 'IELTS Intensive', meta: 'Gulnora Abdullaeva', extra: '60 dars'},
    {name: 'Fizika 11-sinf', meta: 'Bekzod Nazarov', extra: '48 dars'},
    {name: 'Web Dasturlash', meta: 'Rustam Mirzaev', extra: '40 dars'},
    {name: 'Kimyo 10-sinf', meta: 'Zilola Qodirova', extra: '25 dars'},
  ],
};

export default function StudentSearch() {
  const [tab, setTab] = useState<Tab>('teachers');
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data[tab];
    return data[tab].filter(
      (item) =>
        item.name.toLowerCase().includes(q) || item.meta.toLowerCase().includes(q),
    );
  }, [query, tab]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
          <Users className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
            Student qidiruvi
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            O‘qituvchilar, fanlar va kurslarni qidiring
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-200 dark:border-slate-700 dark:bg-slate-900 dark:focus-within:border-emerald-500 dark:focus-within:ring-emerald-500/20">
          <Search className="h-5 w-5 shrink-0 text-emerald-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`${tabs.find((t) => t.id === tab)?.label} bo‘yicha qidirish...`}
            className="w-full bg-transparent text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
          />
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {results.map((item) => (
          <div
            key={item.name}
            className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-emerald-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-500/40"
          >
            <div className="flex items-center gap-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                {item.name.charAt(0)}
              </span>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{item.name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{item.meta}</p>
                <p className="text-xs text-emerald-500 dark:text-emerald-400">{item.extra}</p>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-600 group-hover:text-white dark:bg-emerald-500/15 dark:text-emerald-400 dark:group-hover:bg-emerald-500 dark:group-hover:text-white"
              aria-label={`${item.name} haqida`}
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {results.length === 0 && (
        <div className="mt-10 rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
          <Search className="mx-auto h-8 w-8" />
          <p className="mt-3">Hech narsa topilmadi. Iltimos, so‘rovni o‘zgartiring.</p>
        </div>
      )}
    </div>
  );
}

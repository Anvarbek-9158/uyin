import {useMemo, useState} from 'react';
import {GraduationCap, Search, BookOpen, FileText, User, ArrowRight} from 'lucide-react';

type Tab = 'students' | 'courses' | 'lessons';

const tabs: {id: Tab; label: string; icon: typeof User}[] = [
  {id: 'students', label: 'O‘quvchilar', icon: User},
  {id: 'courses', label: 'Kurslar', icon: BookOpen},
  {id: 'lessons', label: 'Darslar', icon: FileText},
];

const data: Record<Tab, {name: string; meta: string; extra: string}[]> = {
  students: [
    {name: 'Aziz Karimov', meta: 'Matematika · 9-sinf', extra: '3 kursda'},
    {name: 'Malika Yusupova', meta: 'Fizika · 11-sinf', extra: '5 kursda'},
    {name: 'Jasur Tashkentov', meta: 'Ingliz tili · 8-sinf', extra: '2 kursda'},
    {name: 'Dilnoza Rahimova', meta: 'Kimyo · 10-sinf', extra: '4 kursda'},
    {name: 'Sherzod Alimov', meta: 'Informatika · 11-sinf', extra: '1 kursda'},
    {name: 'Nodira Sodiqova', meta: 'Biologiya · 9-sinf', extra: '6 kursda'},
  ],
  courses: [
    {name: 'Algebra 9-sinf', meta: 'Aziz Karimov', extra: '32 dars'},
    {name: 'Fizika asoslari', meta: 'Malika Yusupova', extra: '48 dars'},
    {name: 'IELTS Tayyorlov', meta: 'Jasur Tashkentov', extra: '60 dars'},
    {name: 'Organik kimyo', meta: 'Dilnoza Rahimova', extra: '25 dars'},
    {name: 'Python dasturlash', meta: 'Sherzod Alimov', extra: '40 dars'},
  ],
  lessons: [
    {name: 'Kvadrat tenglamalar', meta: 'Algebra 9-sinf', extra: '45 daqiqa'},
    {name: 'Nyuton qonunlari', meta: 'Fizika asoslari', extra: '38 daqiqa'},
    {name: 'Articles in English', meta: 'IELTS Tayyorlov', extra: '52 daqiqa'},
    {name: 'Alkanlar', meta: 'Organik kimyo', extra: '30 daqiqa'},
    {name: 'Funksiyalar', meta: 'Python dasturlash', extra: '55 daqiqa'},
  ],
};

export default function TeacherSearch() {
  const [tab, setTab] = useState<Tab>('students');
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
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-md">
          <GraduationCap className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
            Teacher qidiruvi
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            O‘quvchilar, kurslar va darslarni qidiring
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
                ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:focus-within:border-indigo-500 dark:focus-within:ring-indigo-500/20">
          <Search className="h-5 w-5 shrink-0 text-indigo-500" />
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
            className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-indigo-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/40"
          >
            <div className="flex items-center gap-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
                {item.name.charAt(0)}
              </span>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{item.name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{item.meta}</p>
                <p className="text-xs text-indigo-500 dark:text-indigo-400">{item.extra}</p>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white dark:bg-indigo-500/15 dark:text-indigo-400 dark:group-hover:bg-indigo-500 dark:group-hover:text-white"
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

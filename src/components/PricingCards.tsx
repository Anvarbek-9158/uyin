import {Check, X} from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  price: string;
  period: string;
  tagline: string;
  features: {label: string; included: boolean}[];
  highlighted?: boolean;
  badge?: string;
}

const plans: Plan[] = [
  {
    id: 'free',
    name: 'Bepul',
    price: '$0',
    period: 'abadiy',
    tagline: 'Boshlash uchun yetarli',
    features: [
      {label: 'Cheklangan qidiruv', included: true},
      {label: '3 ta kursgacha kirish', included: true},
      {label: 'Temani moslashtirish', included: true},
      {label: 'Statistika hisoboti', included: false},
      {label: 'Shaxsiy repetitor', included: false},
      {label: 'Hujjat yuklab olish', included: false},
    ],
  },
  {
    id: 'monthly',
    name: 'Oylik',
    price: '$1',
    period: '/oy',
    tagline: 'To‘liq imkoniyatlar, har oy',
    features: [
      {label: 'Cheksiz qidiruv', included: true},
      {label: 'Cheksiz kurslarga kirish', included: true},
      {label: 'Statistika hisoboti', included: true},
      {label: 'Shaxsiy repetitor', included: false},
      {label: 'Hujjat yuklab olish', included: false},
      {label: 'Avvalo qo‘llab-quvvatlash', included: false},
    ],
    badge: 'Oylik',
  },
  {
    id: 'yearly',
    name: 'Yillik',
    price: '$15',
    period: '/yil',
    tagline: 'Eng foydali va arzon tarif',
    highlighted: true,
    badge: 'Tejamkor',
    features: [
      {label: 'Cheksiz qidiruv', included: true},
      {label: 'Cheksiz kurslarga kirish', included: true},
      {label: 'Statistika hisoboti', included: true},
      {label: 'Shaxsiy repetitor', included: true},
      {label: 'Hujjat yuklab olish', included: true},
      {label: 'Avvalo qo‘llab-quvvatlash', included: true},
    ],
  },
];

export default function PricingCards() {
  const handleSelect = (name: string) => {
    alert(`"${name}" tarifi tanlandi (demo). To‘lov tizimi ulanishi kutilmoqda.`);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl dark:text-white">
          Tariflarni tanlang
        </h1>
        <p className="mt-3 text-lg text-slate-600 dark:text-slate-400">
          Sizga mos rejani tanlang. Istalgan vaqtda o‘zgartirishingiz mumkin.
        </p>
      </div>

      <div className="mt-12 grid gap-8 md:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`relative flex flex-col rounded-3xl border p-8 transition-all ${
              plan.highlighted
                ? 'border-indigo-500 bg-gradient-to-b from-indigo-50 to-white shadow-xl ring-2 ring-indigo-500 dark:from-indigo-950/40 dark:to-slate-900'
                : 'border-slate-200 bg-white shadow-sm hover:shadow-md dark:border-slate-800 dark:bg-slate-900'
            }`}
          >
            {plan.highlighted && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-1 text-xs font-bold uppercase tracking-wide text-white shadow">
                {plan.badge}
              </span>
            )}

            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{plan.name}</h2>
              {plan.badge && !plan.highlighted && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {plan.badge}
                </span>
              )}
            </div>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{plan.tagline}</p>

            <div className="mt-5 flex items-end gap-1">
              <span className="text-4xl font-extrabold text-slate-900 dark:text-white">
                {plan.price}
              </span>
              <span className="mb-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                {plan.period}
              </span>
            </div>

            <div className="mt-6 flex flex-1 flex-col gap-3">
              {plan.features.map((f) => (
                <div key={f.label} className="flex items-center gap-3">
                  {f.included ? (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  ) : (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                      <X className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <span
                    className={`text-sm ${
                      f.included
                        ? 'text-slate-700 dark:text-slate-300'
                        : 'text-slate-400 line-through dark:text-slate-500'
                    }`}
                  >
                    {f.label}
                  </span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => handleSelect(plan.name)}
              className={`mt-8 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                plan.highlighted
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-sm hover:from-indigo-600 hover:to-violet-700'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Tanlash
            </button>
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-slate-400">
        Barcha narxlar AQSh dollarida. Soliqlar mamlakatga qarab farq qilishi mumkin.
      </p>
    </div>
  );
}

import {useState} from 'react';
import {Check, X} from 'lucide-react';
import {useLang} from '../i18n';
import {Modal} from './ui/Modal';

interface Feature {
  key: string;
  included: boolean;
}

interface Plan {
  id: string;
  nameKey: string;
  price: string;
  periodKey: string;
  taglineKey: string;
  features: Feature[];
  highlighted?: boolean;
  badgeKey?: string;
}

const plans: Plan[] = [
  {
    id: 'free',
    nameKey: 'pricing_free_name',
    price: '$0',
    periodKey: 'pricing_free_period',
    taglineKey: 'pricing_free_tagline',
    features: [
      {key: 'pricing_f_limited_search', included: true},
      {key: 'pricing_f_three_courses', included: true},
      {key: 'pricing_f_theme_custom', included: true},
      {key: 'pricing_f_stats', included: false},
      {key: 'pricing_f_tutor', included: false},
      {key: 'pricing_f_download', included: false},
    ],
  },
  {
    id: 'monthly',
    nameKey: 'pricing_monthly_name',
    price: '$1',
    periodKey: 'pricing_monthly_period',
    taglineKey: 'pricing_monthly_tagline',
    features: [
      {key: 'pricing_f_unlimited_search', included: true},
      {key: 'pricing_f_unlimited_courses', included: true},
      {key: 'pricing_f_stats', included: true},
      {key: 'pricing_f_tutor', included: false},
      {key: 'pricing_f_download', included: false},
      {key: 'pricing_f_priority_support', included: false},
    ],
    badgeKey: 'pricing_monthly_name',
  },
  {
    id: 'yearly',
    nameKey: 'pricing_yearly_name',
    price: '$15',
    periodKey: 'pricing_yearly_period',
    taglineKey: 'pricing_yearly_tagline',
    highlighted: true,
    badgeKey: 'pricing_badge_saving',
    features: [
      {key: 'pricing_f_unlimited_search', included: true},
      {key: 'pricing_f_unlimited_courses', included: true},
      {key: 'pricing_f_stats', included: true},
      {key: 'pricing_f_tutor', included: true},
      {key: 'pricing_f_download', included: true},
      {key: 'pricing_f_priority_support', included: true},
    ],
  },
];

export default function PricingCards() {
  const {t} = useLang();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const handleSelect = (name: string) => {
    setSelectedPlan(name);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl dark:text-white">
          {t('pricing_title')}
        </h1>
        <p className="mt-3 text-lg text-slate-600 dark:text-slate-400">
          {t('pricing_subtitle')}
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
                {plan.badgeKey && t(plan.badgeKey)}
              </span>
            )}

            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t(plan.nameKey)}</h2>
              {plan.badgeKey && !plan.highlighted && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {t(plan.badgeKey)}
                </span>
              )}
            </div>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t(plan.taglineKey)}</p>

            <div className="mt-5 flex items-end gap-1">
              <span className="text-4xl font-extrabold text-slate-900 dark:text-white">
                {plan.price}
              </span>
              <span className="mb-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                {t(plan.periodKey)}
              </span>
            </div>

            <div className="mt-6 flex flex-1 flex-col gap-3">
              {plan.features.map((f) => (
                <div key={f.key} className="flex items-center gap-3">
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
                    {t(f.key)}
                  </span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => handleSelect(t(plan.nameKey))}
              className={`mt-8 h-10 rounded-xl px-4 text-sm font-semibold transition-colors ${
                plan.highlighted
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-sm hover:from-indigo-600 hover:to-violet-700'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {t('pricing_select')}
            </button>
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-slate-400">
        {t('pricing_note')}
      </p>

      {selectedPlan && (
        <Modal
          open
          title={`${selectedPlan} ${t('pricing_select')}`}
          message={`${selectedPlan} ${t('pricing_note')}`}
          confirmLabel={t('close')}
          variant="confirm"
          onConfirm={() => setSelectedPlan(null)}
          onCancel={() => setSelectedPlan(null)}
        />
      )}
    </div>
  );
}
import {useState} from 'react';
import {Check, X} from 'lucide-react';
import {useLang} from '../i18n';
import {Modal} from '../ui/Modal';
import {Card} from '../ui/Card';
import {Button} from '../ui/Button';
import {Badge} from '../ui/Badge';

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
  accent: 'brand' | 'violet' | 'play';
}

const plans: Plan[] = [
  {
    id: 'free',
    nameKey: 'pricing_free_name',
    price: '$0',
    periodKey: 'pricing_free_period',
    taglineKey: 'pricing_free_tagline',
    accent: 'brand',
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
    accent: 'violet',
    badgeKey: 'pricing_monthly_name',
    features: [
      {key: 'pricing_f_unlimited_search', included: true},
      {key: 'pricing_f_unlimited_courses', included: true},
      {key: 'pricing_f_stats', included: true},
      {key: 'pricing_f_tutor', included: false},
      {key: 'pricing_f_download', included: false},
      {key: 'pricing_f_priority_support', included: false},
    ],
  },
  {
    id: 'yearly',
    nameKey: 'pricing_yearly_name',
    price: '$15',
    periodKey: 'pricing_yearly_period',
    taglineKey: 'pricing_yearly_tagline',
    highlighted: true,
    badgeKey: 'pricing_badge_saving',
    accent: 'play',
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">{t('pricing_title')}</h1>
        <p className="mt-3 text-lg text-ink-soft">{t('pricing_subtitle')}</p>
      </div>

      <div className="mt-12 grid gap-8 md:grid-cols-3">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            accent={plan.accent}
            hoverable
            className={`relative flex flex-col p-8 ${plan.highlighted ? 'md:-translate-y-3 md:shadow-[var(--shadow-card-hover)]' : ''}`}
          >
            {plan.highlighted && (
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-play-500 px-4 py-1 text-xs font-extrabold uppercase tracking-wide text-white shadow-[var(--shadow-pop-play)]">
                {plan.badgeKey && t(plan.badgeKey)}
              </span>
            )}

            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-ink">{t(plan.nameKey)}</h2>
              {plan.badgeKey && !plan.highlighted && <Badge tone={plan.accent}>{t(plan.badgeKey)}</Badge>}
            </div>

            <p className="mt-1 text-sm text-ink-soft">{t(plan.taglineKey)}</p>

            <div className="mt-5 flex items-end gap-1">
              <span className="font-display text-4xl font-extrabold text-ink">{plan.price}</span>
              <span className="mb-1 text-sm font-semibold text-ink-faint">{t(plan.periodKey)}</span>
            </div>

            <div className="mt-6 flex flex-1 flex-col gap-3">
              {plan.features.map((f) => (
                <div key={f.key} className="flex items-center gap-3">
                  {f.included ? (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-play-500/15 text-play-400">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  ) : (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-raised text-ink-faint">
                      <X className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <span className={`text-sm font-semibold ${f.included ? 'text-ink' : 'text-ink-faint line-through'}`}>
                    {t(f.key)}
                  </span>
                </div>
              ))}
            </div>

            <Button
              variant={plan.highlighted ? 'play' : plan.accent === 'violet' ? 'violet' : 'outline'}
              fullWidth
              className="mt-8"
              onClick={() => setSelectedPlan(t(plan.nameKey))}
            >
              {t('pricing_select')}
            </Button>
          </Card>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-ink-faint">{t('pricing_note')}</p>

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

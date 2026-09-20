import {Link} from 'react-router-dom';
import {ArrowRight, BookOpenCheck, Gamepad2, GraduationCap, Users, Gauge, Layers} from 'lucide-react';
import {useLang} from '../i18n';
import {Button} from '../ui/Button';
import {Card} from '../ui/Card';
import {Badge} from '../ui/Badge';

export default function Hero() {
  const {t} = useLang();

  const features = [
    {icon: Users, title: t('hero_feat_1_title'), desc: t('hero_feat_1_desc')},
    {icon: Gamepad2, title: t('hero_feat_2_title'), desc: t('hero_feat_2_desc')},
    {icon: Gauge, title: t('hero_feat_3_title'), desc: t('hero_feat_3_desc')},
    {icon: Layers, title: t('hero_feat_4_title'), desc: t('hero_feat_4_desc')},
  ];

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-brand-300/30 blur-3xl" />
        <div className="absolute top-24 -right-16 h-80 w-80 rounded-full bg-violet-300/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-play-400/20 blur-3xl" />
      </div>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-3xl text-center animate-[var(--animate-bounce-in)]">
          <Badge tone="violet" icon={<BookOpenCheck className="h-3.5 w-3.5" />}>
            {t('hero_badge')}
          </Badge>
          <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl lg:text-6xl">
            {t('hero_title')}
          </h1>
          <p className="mt-6 text-lg text-ink-soft">{t('hero_sub')}</p>

          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link to="/play">
              <Button variant="play" size="lg" icon={<Gamepad2 className="h-5 w-5" />}>
                {t('hero_play')}
              </Button>
            </Link>
            <Link to="/pricing">
              <Button variant="outline" size="lg" icon={<ArrowRight className="h-5 w-5" />} className="flex-row-reverse">
                {t('hero_pricing')}
              </Button>
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl gap-6 sm:grid-cols-2">
          <Link to="/teacher">
            <Card accent="violet" hoverable className="group h-full p-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-400">
                <GraduationCap className="h-8 w-8" />
              </div>
              <h2 className="mt-5 font-display text-2xl font-bold text-ink">{t('hero_teacher_title')}</h2>
              <p className="mt-2 text-ink-soft">{t('hero_teacher_desc')}</p>
              <div className="mt-6 flex items-center gap-2 font-extrabold text-violet-400">
                {t('hero_teacher_link')}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Card>
          </Link>

          <Link to="/student">
            <Card accent="play" hoverable className="group h-full p-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-play-500/15 text-play-400">
                <Users className="h-8 w-8" />
              </div>
              <h2 className="mt-5 font-display text-2xl font-bold text-ink">{t('hero_student_title')}</h2>
              <p className="mt-2 text-ink-soft">{t('hero_student_desc')}</p>
              <div className="mt-6 flex items-center gap-2 font-extrabold text-play-400">
                {t('hero_student_link')}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Card>
          </Link>
        </div>

        <div className="mx-auto mt-14 grid max-w-4xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => {
            const tones = ['brand', 'violet', 'play', 'warn'] as const;
            const tone = tones[i % tones.length];
            const toneText: Record<string, string> = {brand: 'text-brand-400 bg-brand-500/15', violet: 'text-violet-400 bg-violet-500/15', play: 'text-play-400 bg-play-500/15', warn: 'text-warn-400 bg-warn-500/15'};
            return (
              <Card key={f.title} hoverable accent={tone} className="p-5">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${toneText[tone]}`}>
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-bold text-ink">{f.title}</h3>
                <p className="mt-1 text-sm text-ink-soft">{f.desc}</p>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

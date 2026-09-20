import type {ReactNode} from 'react';

type Tone = 'brand' | 'violet' | 'play' | 'warn' | 'danger' | 'neutral';

const TONE_CLASSES: Record<Tone, string> = {
  brand: 'bg-brand-500/10 text-brand-400 border-brand-500/30',
  violet: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
  play: 'bg-play-500/10 text-play-400 border-play-500/30',
  warn: 'bg-warn-500/15 text-warn-400 border-warn-500/30',
  danger: 'bg-danger-500/10 text-danger-400 border-danger-500/30',
  neutral: 'bg-surface-raised text-ink-soft border-line',
};

export function Badge({tone = 'neutral', icon, children}: {tone?: Tone; icon?: ReactNode; children: ReactNode}) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full border-2 px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider',
        TONE_CLASSES[tone],
      ].join(' ')}
    >
      {icon}
      {children}
    </span>
  );
}

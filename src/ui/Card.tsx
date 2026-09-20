import type {HTMLAttributes} from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  accent?: 'brand' | 'violet' | 'play' | 'warn' | 'danger' | 'none';
}

const ACCENT_BORDER: Record<NonNullable<CardProps['accent']>, string> = {
  brand: 'border-brand-300',
  violet: 'border-violet-300',
  play: 'border-play-400/60',
  warn: 'border-warn-400/60',
  danger: 'border-danger-400/60',
  none: 'border-line',
};

// The one card shell for the whole product: white surface, thick 2px
// border in a semantic color, soft warm-tinted shadow — no gradients, no
// glow effects. Playful without leaning on the old dark/neon look.
export function Card({hoverable, accent = 'none', className = '', children, ...rest}: CardProps) {
  return (
    <div
      className={[
        'rounded-[var(--radius-card)] border-2 bg-surface',
        'shadow-[var(--shadow-card)]',
        ACCENT_BORDER[accent],
        hoverable ? 'transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)]' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}

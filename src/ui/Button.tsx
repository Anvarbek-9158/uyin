import {forwardRef} from 'react';
import type {ButtonHTMLAttributes, ReactNode} from 'react';

type Variant = 'brand' | 'violet' | 'play' | 'danger' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  fullWidth?: boolean;
}

// Single button primitive for the whole app. The "pop" shadow (a flat
// colored offset, no blur) plus the press-down active state is the game's
// signature interaction — every clickable primary action should use this.
const VARIANT_CLASSES: Record<Variant, string> = {
  brand: 'bg-brand-500 text-white shadow-[var(--shadow-pop-brand)] hover:bg-brand-400 active:translate-y-1 active:shadow-none',
  violet: 'bg-violet-500 text-white shadow-[var(--shadow-pop-violet)] hover:bg-violet-400 active:translate-y-1 active:shadow-none',
  play: 'bg-play-500 text-white shadow-[var(--shadow-pop-play)] hover:bg-play-400 active:translate-y-1 active:shadow-none',
  danger: 'bg-danger-500/10 text-danger-500 border-2 border-danger-500/30 hover:bg-danger-500/20',
  outline: 'bg-surface-raised text-ink border-2 border-line-strong hover:bg-surface hover:border-brand-400',
  ghost: 'bg-transparent text-ink-soft hover:bg-surface-raised hover:text-ink',
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5 rounded-xl',
  md: 'h-12 px-5 text-sm gap-2 rounded-2xl',
  lg: 'h-14 px-8 text-base gap-2.5 rounded-2xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({variant = 'brand', size = 'md', icon, fullWidth, className = '', children, disabled, ...rest}, ref) => (
    <button
      ref={ref}
      disabled={disabled}
      className={[
        'inline-flex items-center justify-center font-extrabold transition-all duration-100',
        'disabled:opacity-50 disabled:pointer-events-none disabled:grayscale',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {icon}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

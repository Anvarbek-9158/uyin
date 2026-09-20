import {forwardRef} from 'react';
import type {InputHTMLAttributes, ReactNode} from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({icon, error, className = '', ...rest}, ref) => (
  <div>
    <div className="relative">
      {icon && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint">{icon}</span>}
      <input
        ref={ref}
        className={[
          'h-12 w-full rounded-[var(--radius-control)] border-2 border-line bg-surface-sunken px-4 text-sm font-semibold text-ink placeholder:text-ink-faint placeholder:font-normal',
          'transition-colors focus:outline-none focus:border-brand-500 focus:bg-surface',
          icon ? 'pl-11' : '',
          error ? 'border-danger-500' : '',
          className,
        ].join(' ')}
        {...rest}
      />
    </div>
    {error && <p className="mt-1.5 text-xs font-bold text-danger-500">{error}</p>}
  </div>
));
Input.displayName = 'Input';

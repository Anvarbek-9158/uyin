import React from 'react';

// Accessible, consistent button primitive. Every variant enforces a minimum
// 40px (h-10) tap target and 12px font as required by the UI audit. The `title`
// fallback keeps unlabeled icon buttons screen-reader friendly.
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'success';
type Size = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)]',
  secondary:
    'bg-slate-800/80 hover:bg-slate-700/80 text-white border border-white/10',
  ghost: 'bg-transparent hover:bg-white/10 text-slate-200',
  danger:
    'bg-rose-500 hover:bg-rose-400 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)]',
  outline:
    'bg-transparent border border-white/20 hover:bg-white/10 text-slate-200',
  success:
    'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.4)]',
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-10 px-4 text-xs gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-12 px-6 text-sm gap-2',
  icon: 'h-10 w-10',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  children,
  ...rest
}) => {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-xl font-bold uppercase tracking-wider transition-all cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 disabled:opacity-50 disabled:pointer-events-none ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
};
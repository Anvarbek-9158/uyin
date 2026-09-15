import React from 'react';

// Small label/keyword component. Enforces the audit's 12px minimum font size.
type BadgeVariant = 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate' | 'sky';

interface BadgeProps {
  variant?: BadgeVariant;
  className?: string;
  children: React.ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  indigo: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  emerald: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  amber: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  rose: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  slate: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  sky: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
};

export const Badge: React.FC<BadgeProps> = ({ variant = 'slate', className = '', children }) => {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 font-bold text-xs border ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

// Consistent glassy surface used across landing pages and the game console.
// All nested interactive elements still enforce their own 40px minimums.
export const Card: React.FC<CardProps> = ({ className = '', children, ...rest }) => {
  return (
    <div
      className={`bg-slate-900/60 border border-white/10 rounded-2xl shadow-xl backdrop-blur-md ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<CardProps> = ({ className = '', children, ...rest }) => {
  return (
    <div className={`flex items-center justify-between pb-3 border-b border-white/10 ${className}`} {...rest}>
      {children}
    </div>
  );
};

export const CardTitle: React.FC<CardProps> = ({ className = '', children, ...rest }) => {
  return (
    <h3 className={`font-bold text-white text-base flex items-center gap-2 ${className}`} {...rest}>
      {children}
    </h3>
  );
};

export const CardBody: React.FC<CardProps> = ({ className = '', children, ...rest }) => {
  return (
    <div className={`space-y-4 ${className}`} {...rest}>
      {children}
    </div>
  );
};
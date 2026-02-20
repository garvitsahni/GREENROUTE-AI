import React from 'react';
import { cn } from '../../lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
}

export const Badge = ({ className, variant = 'default', ...props }: BadgeProps) => {
  const variants = {
    default: "bg-stone-800 text-stone-300",
    success: "bg-emerald-900/30 text-emerald-400 border border-emerald-900/50",
    warning: "bg-amber-900/30 text-amber-400 border border-amber-900/50",
    danger: "bg-red-900/30 text-red-400 border border-red-900/50",
    info: "bg-blue-900/30 text-blue-400 border border-blue-900/50",
    outline: "border border-stone-700 text-stone-400"
  };

  return (
    <div className={cn(
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2",
      variants[variant],
      className
    )} {...props} />
  );
};

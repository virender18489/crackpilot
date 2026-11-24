import React from 'react';
import { cn } from '../../lib/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'lavender' | 'success' | 'neutral' | 'warning' | 'outline';
}

export function Badge({ className, variant = 'primary', ...props }: BadgeProps) {
  const variants: Record<NonNullable<BadgeProps['variant']>, string> = {
    primary: 'bg-primary-500/15 text-primary-600 dark:text-lavender-200 border-primary-500/30',
    lavender: 'bg-lavender-200 text-navy-950 dark:bg-lavender-200/15 dark:text-lavender-200 border-lavender-300/60 dark:border-lavender-200/25',
    success: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    warning: 'bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/30',
    neutral: 'bg-surface-elevated text-ink-muted border-border-subtle',
    outline: 'bg-transparent text-ink-muted border-border-strong',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium tracking-wider whitespace-nowrap shrink-0',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

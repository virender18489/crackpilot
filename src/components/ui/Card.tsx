import React from 'react';
import { cn } from '../../lib/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  interactive?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({
  className,
  elevated = false,
  interactive = false,
  padding = 'md',
  ...props
}: CardProps) {
  const paddings = {
    none: '',
    sm: 'p-4 sm:p-5',
    md: 'p-5 sm:p-6',
    lg: 'p-6 sm:p-8',
  };

  return (
    <div
      className={cn(
        'rounded-2xl border border-border-subtle bg-surface transition-colors duration-150',
        elevated && 'bg-surface-elevated',
        interactive && 'hover:border-primary-500/45',
        paddings[padding],
        className
      )}
      {...props}
    />
  );
}

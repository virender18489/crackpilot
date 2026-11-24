import React from 'react';
import { cn } from '../../lib/cn';

interface StatCardProps {
  value: string;
  label: string;
  sublabel?: string;
  className?: string;
  inverted?: boolean;
  action?: React.ReactNode;
}

export function StatCard({ value, label, sublabel, className, inverted = false, action }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-4 sm:p-5',
        inverted
          ? 'border-lavender-200/20 bg-white/8 backdrop-blur-sm'
          : 'border-border-subtle bg-surface',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className={cn(
              'font-display text-xl sm:text-2xl font-bold tracking-tight tabular-nums',
              inverted ? 'text-white' : 'text-ink'
            )}
          >
            {value}
          </p>
          <p className={cn('mt-1 text-sm', inverted ? 'text-lavender-200/90' : 'text-ink-muted')}>
            {label}
          </p>
          {sublabel && (
            <p className={cn('mt-0.5 text-xs', inverted ? 'text-lavender-200/65' : 'text-ink-faint')}>
              {sublabel}
            </p>
          )}
        </div>
        {action}
      </div>
    </div>
  );
}

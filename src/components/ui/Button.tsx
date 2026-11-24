import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      fullWidth = false,
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
      primary:
        'bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 shadow-sm shadow-primary-500/20 border border-primary-400/30',
      secondary:
        'bg-lavender-200 text-navy-950 hover:bg-lavender-300 dark:bg-primary-500/15 dark:text-lavender-200 dark:hover:bg-primary-500/25 border border-primary-500/20',
      outline:
        'bg-transparent text-ink border border-border-strong hover:bg-surface-elevated hover:border-primary-500/50',
      ghost:
        'bg-transparent text-ink-muted hover:text-ink hover:bg-surface-elevated border border-transparent',
      danger:
        'bg-rose-600 text-white hover:bg-rose-700 border border-rose-500/40',
    };

    const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
      sm: 'min-h-[40px] px-3.5 py-2 text-xs rounded-xl gap-1.5',
      md: 'min-h-[44px] px-5 py-2.5 text-sm rounded-xl gap-2',
      lg: 'min-h-[48px] px-6 py-3 text-sm sm:text-base rounded-xl gap-2.5',
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center font-semibold whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed',
          variants[variant],
          sizes[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

import React from 'react';
import { cn } from '../../lib/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  labelRight?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, helperText, error, labelRight, id, ...props }, ref) => {
    const inputId = id || props.name;
    return (
      <div className="w-full space-y-1.5">
        {(label || labelRight) && (
          <div className="flex items-center justify-between gap-2">
            {label && (
              <label htmlFor={inputId} className="block text-sm font-medium text-ink">
                {label}
              </label>
            )}
            {labelRight}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? 'true' : 'false'}
          className={cn(
            'min-h-[44px] w-full rounded-xl border bg-surface-subtle px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-primary-500 focus:bg-surface focus:outline-none disabled:cursor-not-allowed disabled:opacity-60',
            error ? 'border-rose-500/70' : 'border-border-subtle hover:border-border-strong',
            className
          )}
          {...props}
        />
        {error ? (
          <p role="alert" className="text-xs font-medium text-rose-500">
            {error}
          </p>
        ) : helperText ? (
          <p className="text-xs text-ink-faint">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';

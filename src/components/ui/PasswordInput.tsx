import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/cn';
import { getPasswordStrength } from '../../lib/schemas';

export interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  helperText?: string;
  error?: string;
  labelRight?: React.ReactNode;
  showStrength?: boolean;
  currentValue?: string;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, label, helperText, error, labelRight, showStrength, currentValue = '', id, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const inputId = id || props.name;
    const strength = showStrength ? getPasswordStrength(currentValue) : null;

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
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={visible ? 'text' : 'password'}
            aria-invalid={error ? 'true' : 'false'}
            className={cn(
              'min-h-[44px] w-full rounded-xl border bg-surface-subtle py-2.5 pl-3.5 pr-11 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-primary-500 focus:bg-surface focus:outline-none disabled:cursor-not-allowed disabled:opacity-60',
              error ? 'border-rose-500/70' : 'border-border-subtle hover:border-border-strong',
              className
            )}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((prev) => !prev)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-surface-elevated hover:text-ink cursor-pointer"
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {showStrength && strength && currentValue.length > 0 && (
          <div className="space-y-1 pt-1">
            <div className="grid grid-cols-4 gap-1.5">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={cn(
                    'h-1.5 rounded-full transition-colors',
                    strength.score >= step ? strength.colorClass : 'bg-border-subtle'
                  )}
                />
              ))}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink-faint">Password strength</span>
              <span className="font-mono text-ink-muted">{strength.label}</span>
            </div>
          </div>
        )}

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

PasswordInput.displayName = 'PasswordInput';

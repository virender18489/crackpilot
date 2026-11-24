import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { AuthLayout } from '../components/auth/AuthLayout';
import { OtpInput } from '../components/auth/OtpInput';
import { Input } from '../components/ui/Input';
import { PasswordInput } from '../components/ui/PasswordInput';
import { Button } from '../components/ui/Button';
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  type ForgotPasswordFormValues,
  type ResetPasswordFormValues,
} from '../lib/schemas';
import { useToast } from '../lib/toast';
import { usePageMeta } from '../lib/seo';

export default function ForgotPasswordPage() {
  usePageMeta({
    title: 'Reset Password — Crackpilot',
    description: 'Request a 6-digit recovery code and reset your Crackpilot account password.',
  });

  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [targetEmail, setTargetEmail] = useState('');
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const emailForm = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const resetForm = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { otp: '', newPassword: '', confirmPassword: '' },
  });

  const newPasswordVal = resetForm.watch('newPassword');
  const otpVal = resetForm.watch('otp');

  const onRequestCode = async (values: ForgotPasswordFormValues) => {
    setServerError(null);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error || 'Could not send recovery code.');
        return;
      }
      setTargetEmail(values.email.trim().toLowerCase());
      setOtpHint(data.otpHint ?? null);
      setStep('reset');
      toast({
        title: 'Recovery code sent',
        description: `Enter the 6-digit code sent to ${values.email}.`,
        variant: 'info',
      });
    } catch {
      setServerError('Network error. Try again.');
    }
  };

  const onResetPassword = async (values: ResetPasswordFormValues) => {
    setServerError(null);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          otp: values.otp,
          newPassword: values.newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error || 'Password reset failed.');
        return;
      }
      toast({
        title: 'Password updated',
        description: 'You can now sign in with your new password.',
      });
      navigate('/login', { replace: true });
    } catch {
      setServerError('Network error. Try again.');
    }
  };

  return (
    <AuthLayout>
      {step === 'email' ? (
        <div className="space-y-6">
          <div className="space-y-1.5">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink">Reset Password</h2>
            <p className="text-sm text-ink-muted">Enter your email to receive a recovery code.</p>
          </div>

          <form onSubmit={emailForm.handleSubmit(onRequestCode)} noValidate className="space-y-4">
            {serverError && (
              <div
                role="alert"
                className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-500 dark:text-rose-300"
              >
                {serverError}
              </div>
            )}

            <Input
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              disabled={emailForm.formState.isSubmitting}
              error={emailForm.formState.errors.email?.message}
              {...emailForm.register('email')}
            />

            <Button type="submit" fullWidth size="lg" loading={emailForm.formState.isSubmitting}>
              Send Recovery Code
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <div className="relative flex items-center py-1">
            <div className="flex-1 border-t border-border-subtle" />
            <span className="px-3 font-mono text-[11px] text-ink-faint">OR</span>
            <div className="flex-1 border-t border-border-subtle" />
          </div>

          <p className="text-center text-sm text-ink-muted">
            Remember your password?{' '}
            <Link to="/login" className="font-semibold text-primary-500 hover:text-primary-400">
              Sign In
            </Link>
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => setStep('email')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>

          <div className="space-y-1.5">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink">Set a new password</h2>
            <p className="text-sm text-ink-muted">
              Enter the 6-digit code sent to <span className="font-medium text-ink">{targetEmail}</span> and choose a new password.
            </p>
          </div>

          {otpHint && (
            <div className="rounded-xl border border-primary-500/30 bg-primary-500/10 px-4 py-3 text-xs text-ink-muted">
              Demo recovery code:{' '}
              <button
                type="button"
                onClick={() => resetForm.setValue('otp', otpHint, { shouldValidate: true })}
                className="font-mono font-semibold text-primary-500 dark:text-lavender-200 underline underline-offset-2 cursor-pointer"
              >
                {otpHint}
              </button>
            </div>
          )}

          <form onSubmit={resetForm.handleSubmit(onResetPassword)} noValidate className="space-y-4">
            {serverError && (
              <div
                role="alert"
                className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-500 dark:text-rose-300"
              >
                {serverError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-ink">Recovery code</label>
              <OtpInput
                value={otpVal}
                onChange={(val) => resetForm.setValue('otp', val, { shouldValidate: true })}
                disabled={resetForm.formState.isSubmitting}
                error={resetForm.formState.errors.otp?.message}
              />
            </div>

            <PasswordInput
              label="New password"
              autoComplete="new-password"
              placeholder="At least 8 chars, 1 uppercase, 1 number"
              showStrength
              currentValue={newPasswordVal}
              disabled={resetForm.formState.isSubmitting}
              error={resetForm.formState.errors.newPassword?.message}
              {...resetForm.register('newPassword')}
            />

            <PasswordInput
              label="Confirm new password"
              autoComplete="new-password"
              placeholder="Repeat new password"
              disabled={resetForm.formState.isSubmitting}
              error={resetForm.formState.errors.confirmPassword?.message}
              {...resetForm.register('confirmPassword')}
            />

            <Button type="submit" fullWidth size="lg" loading={resetForm.formState.isSubmitting}>
              Update Password
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </AuthLayout>
  );
}

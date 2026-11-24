import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react';
import { AuthLayout } from '../components/auth/AuthLayout';
import { OtpInput } from '../components/auth/OtpInput';
import { Input } from '../components/ui/Input';
import { PasswordInput } from '../components/ui/PasswordInput';
import { Button } from '../components/ui/Button';
import { signupSchema, type SignupFormValues } from '../lib/schemas';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { usePageMeta } from '../lib/seo';

export default function SignupPage() {
  usePageMeta({
    title: 'Create Account — Crackpilot',
    description: 'Create your Crackpilot account, verify with OTP, and start preparing for live interviews with pay-per-use credits.',
  });

  const navigate = useNavigate();
  const { signup, verifyOtp } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [pendingEmail, setPendingEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', password: '' },
  });

  const passwordVal = watch('password');

  useEffect(() => {
    if (step !== 'otp' || resendTimer <= 0) return;
    const id = window.setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [step, resendTimer]);

  const onCreateAccount = async (values: SignupFormValues) => {
    setFormError(null);
    const res = await signup(values.email, values.password);
    if (!res.ok) {
      setFormError(res.error || 'Could not create account.');
      return;
    }
    setPendingEmail(values.email.trim().toLowerCase());
    setOtpHint(res.otpHint ?? null);
    setResendTimer(30);
    setStep('otp');
    toast({
      title: 'Verification code sent',
      description: `Check ${values.email} for your 6-digit OTP.`,
      variant: 'info',
    });
  };

  const onVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setOtpError('Enter the full 6-digit verification code.');
      return;
    }
    setOtpError(null);
    setVerifying(true);
    const res = await verifyOtp(pendingEmail, otp);
    setVerifying(false);
    if (!res.ok) {
      setOtpError(res.error || 'Invalid code.');
      return;
    }
    toast({ title: 'Account verified', description: 'Your Crackpilot workspace is ready.' });
    navigate('/dashboard', { replace: true });
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setResendTimer(30);
    toast({ title: 'New code sent', description: `Sent a fresh 6-digit code to ${pendingEmail}.`, variant: 'info' });
  };

  return (
    <AuthLayout>
      {step === 'credentials' ? (
        <div className="space-y-6">
          <div className="space-y-1.5">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink">Create an Account</h2>
            <p className="text-sm text-ink-muted">Join thousands of users acing their interviews.</p>
          </div>

          <form onSubmit={handleSubmit(onCreateAccount)} noValidate className="space-y-4">
            {formError && (
              <div
                role="alert"
                className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-500 dark:text-rose-300"
              >
                {formError}
              </div>
            )}

            <Input
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              helperText="Enter a valid email to receive your verification OTP"
              disabled={isSubmitting}
              error={errors.email?.message}
              {...register('email')}
            />

            <PasswordInput
              label="Password"
              autoComplete="new-password"
              placeholder="Create a strong password"
              showStrength
              currentValue={passwordVal}
              disabled={isSubmitting}
              error={errors.password?.message}
              {...register('password')}
            />

            <Button type="submit" fullWidth size="lg" loading={isSubmitting} className="mt-2">
              Create Account
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <div className="relative flex items-center py-1">
            <div className="flex-1 border-t border-border-subtle" />
            <span className="px-3 font-mono text-[11px] text-ink-faint">OR</span>
            <div className="flex-1 border-t border-border-subtle" />
          </div>

          <p className="text-center text-sm text-ink-muted">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-primary-500 hover:text-primary-400">
              Sign In
            </Link>
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => setStep('credentials')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Change email
          </button>

          <div className="space-y-1.5">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink">Verify your email</h2>
            <p className="text-sm text-ink-muted">
              Enter the 6-digit code sent to <span className="font-medium text-ink">{pendingEmail}</span>.
            </p>
          </div>

          {otpHint && (
            <div className="rounded-xl border border-primary-500/30 bg-primary-500/10 px-4 py-3 text-xs text-ink-muted">
              Demo preview code:{' '}
              <button
                type="button"
                onClick={() => setOtp(otpHint)}
                className="font-mono font-semibold text-primary-500 dark:text-lavender-200 underline underline-offset-2 cursor-pointer"
              >
                {otpHint}
              </button>{' '}
              (click to autofill or type any 6 digits)
            </div>
          )}

          <form onSubmit={onVerifyOtp} className="space-y-5">
            <OtpInput
              value={otp}
              onChange={(val) => {
                setOtp(val);
                if (otpError) setOtpError(null);
              }}
              disabled={verifying}
              error={otpError ?? undefined}
            />

            <Button type="submit" fullWidth size="lg" loading={verifying}>
              Verify & Open Workspace
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <div className="flex items-center justify-between text-xs text-ink-muted pt-1">
            <span>Didn&apos;t get the email?</span>
            <button
              type="button"
              disabled={resendTimer > 0}
              onClick={handleResend}
              className="inline-flex items-center gap-1.5 font-mono font-medium text-primary-500 disabled:text-ink-faint disabled:cursor-not-allowed cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend code'}
            </button>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}

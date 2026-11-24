import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight } from 'lucide-react';
import { AuthLayout } from '../components/auth/AuthLayout';
import { Input } from '../components/ui/Input';
import { PasswordInput } from '../components/ui/PasswordInput';
import { Button } from '../components/ui/Button';
import { loginSchema, type LoginFormValues } from '../lib/schemas';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { usePageMeta } from '../lib/seo';

export default function LoginPage() {
  usePageMeta({
    title: 'Sign In — Crackpilot',
    description: 'Sign in to your Crackpilot workspace to manage credits, target profile, Knowledge Engine, and desktop tokens.',
  });

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'aarav.mehta@crackpilot.dev',
      password: '',
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setFormError(null);
    const res = await login(values.email, values.password);
    if (!res.ok) {
      setFormError(res.error || 'Could not sign in.');
      return;
    }
    toast({ title: 'Signed in', description: 'Welcome back to your Crackpilot workspace.' });
    const next = searchParams.get('next');
    navigate(next && next.startsWith('/dashboard') ? next : '/dashboard', { replace: true });
  };

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="space-y-1.5">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink">Welcome back</h2>
          <p className="text-sm text-ink-muted">Sign in to your Crackpilot account</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
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
            disabled={isSubmitting}
            error={errors.email?.message}
            {...register('email')}
          />

          <PasswordInput
            label="Password"
            autoComplete="current-password"
            placeholder="Enter your password"
            disabled={isSubmitting}
            error={errors.password?.message}
            labelRight={
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-primary-500 hover:text-primary-400 transition-colors"
              >
                Forgot password?
              </Link>
            }
            {...register('password')}
          />

          <Button type="submit" fullWidth size="lg" loading={isSubmitting} className="mt-2">
            Sign In
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        <div className="relative flex items-center py-1">
          <div className="flex-1 border-t border-border-subtle" />
          <span className="px-3 font-mono text-[11px] text-ink-faint">OR</span>
          <div className="flex-1 border-t border-border-subtle" />
        </div>

        <div className="space-y-4 text-center">
          <p className="text-sm text-ink-muted">
            Don&apos;t have an account?{' '}
            <Link to="/signup" className="font-semibold text-primary-500 hover:text-primary-400">
              Get Started
            </Link>
          </p>

          <Link
            to="/partner"
            className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-border-strong bg-surface-subtle px-4 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-primary-500/50 hover:text-ink"
          >
            Want to become an Agent Partner? Apply here
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}

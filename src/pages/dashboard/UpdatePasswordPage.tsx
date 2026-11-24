import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { Button } from '../../components/ui/Button';
import { updatePasswordSchema, type UpdatePasswordFormValues } from '../../lib/schemas';
import { useToast } from '../../lib/toast';
import { usePageMeta } from '../../lib/seo';

export default function UpdatePasswordPage() {
  usePageMeta({
    title: 'Update Password — Crackpilot',
    description: 'Change your Crackpilot account password and keep your workspace credentials secure.',
  });

  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdatePasswordFormValues>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const newPass = watch('newPassword');

  const onSubmit = async (values: UpdatePasswordFormValues) => {
    try {
      const res = await fetch('/api/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Update failed', description: data.error || 'Could not update password.', variant: 'error' });
        return;
      }
      reset();
      toast({
        title: 'Password updated',
        description: 'Your new password is active across web and desktop sessions.',
      });
    } catch {
      toast({ title: 'Network error', variant: 'error' });
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="space-y-1">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink">Update Password</h1>
        <p className="text-sm text-ink-muted">
          Use a unique password with at least 8 characters, one uppercase letter, and one number.
        </p>
      </div>

      <Card padding="lg">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <PasswordInput
            label="Current password"
            autoComplete="current-password"
            placeholder="Enter current password"
            error={errors.currentPassword?.message}
            {...register('currentPassword')}
          />

          <PasswordInput
            label="New password"
            autoComplete="new-password"
            placeholder="Enter new password"
            showStrength
            currentValue={newPass}
            error={errors.newPassword?.message}
            {...register('newPassword')}
          />

          <PasswordInput
            label="Confirm new password"
            autoComplete="new-password"
            placeholder="Repeat new password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />

          <div className="pt-2 flex justify-end">
            <Button type="submit" loading={isSubmitting}>
              <ShieldCheck className="h-4 w-4" />
              Save New Password
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

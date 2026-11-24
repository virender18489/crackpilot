import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, CalendarCheck, Send } from 'lucide-react';
import { bookDemoSchema, type BookDemoFormValues } from '../../lib/schemas';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useToast } from '../../lib/toast';

interface BookDemoFormProps {
  defaultEmail?: string;
  defaultName?: string;
  compact?: boolean;
}

export function BookDemoForm({ defaultEmail = '', defaultName = '', compact = false }: BookDemoFormProps) {
  const { toast } = useToast();
  const [submittedBooking, setSubmittedBooking] = useState<BookDemoFormValues | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BookDemoFormValues>({
    resolver: zodResolver(bookDemoSchema),
    defaultValues: {
      name: defaultName,
      email: defaultEmail,
      phone: '',
      role: '',
      dateTime: '',
      platform: 'Google Meet',
      message: '',
    },
  });

  const onSubmit = async (values: BookDemoFormValues) => {
    setSubmitError(null);
    try {
      const res = await fetch('/api/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || 'Could not schedule demo.');
        return;
      }
      setSubmittedBooking(values);
      toast({
        title: 'Demo request confirmed',
        description: `We sent calendar details to ${values.email}.`,
      });
    } catch {
      setSubmitError('Network error while submitting your request.');
    }
  };

  if (submittedBooking) {
    return (
      <Card padding="lg" className="border-emerald-500/35">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div className="space-y-1 flex-1">
            <h3 className="text-lg font-bold text-ink">Walkthrough booked</h3>
            <p className="text-sm text-ink-muted">
              Thanks, <span className="font-medium text-ink">{submittedBooking.name}</span>. We reserved a 15-minute live setup session on{' '}
              <span className="font-medium text-ink">{submittedBooking.platform}</span> for{' '}
              <span className="font-mono text-xs text-ink">{submittedBooking.dateTime.replace('T', ' ')}</span>.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSubmittedBooking(null);
              reset();
            }}
          >
            Book another
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card padding={compact ? 'md' : 'lg'}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {submitError && (
          <div role="alert" className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-500">
            {submitError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Full name"
            placeholder="Aarav Mehta"
            error={errors.name?.message}
            disabled={isSubmitting}
            {...register('name')}
          />
          <Input
            label="Email address"
            type="email"
            placeholder="aarav@example.com"
            error={errors.email?.message}
            disabled={isSubmitting}
            {...register('email')}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Phone / WhatsApp"
            type="tel"
            placeholder="+91 98204 51190"
            error={errors.phone?.message}
            disabled={isSubmitting}
            {...register('phone')}
          />
          <Input
            label="Target interview role"
            placeholder="Senior Frontend Engineer"
            error={errors.role?.message}
            disabled={isSubmitting}
            {...register('role')}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Preferred date & time"
            type="datetime-local"
            error={errors.dateTime?.message}
            disabled={isSubmitting}
            {...register('dateTime')}
          />
          <div className="space-y-1.5">
            <label htmlFor="demo-platform" className="block text-sm font-medium text-ink">
              Meeting platform
            </label>
            <select
              id="demo-platform"
              disabled={isSubmitting}
              className="min-h-[44px] w-full rounded-xl border border-border-subtle bg-surface-subtle px-3.5 py-2.5 text-sm text-ink transition-colors hover:border-border-strong focus:border-primary-500 focus:bg-surface focus:outline-none"
              {...register('platform')}
            >
              <option value="Google Meet">Google Meet</option>
              <option value="Zoom">Zoom</option>
              <option value="Microsoft Teams">Microsoft Teams</option>
              <option value="Webex">Webex</option>
              <option value="Discord">Discord</option>
            </select>
            {errors.platform && (
              <p role="alert" className="text-xs font-medium text-rose-500">
                {errors.platform.message}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="demo-message" className="block text-sm font-medium text-ink">
            Anything specific you want to test? <span className="text-ink-faint font-normal">(optional)</span>
          </label>
          <textarea
            id="demo-message"
            rows={3}
            disabled={isSubmitting}
            placeholder="e.g., macOS audio setup, mobile QR remote, or system design screen capture..."
            className="w-full rounded-xl border border-border-subtle bg-surface-subtle px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint transition-colors hover:border-border-strong focus:border-primary-500 focus:bg-surface focus:outline-none"
            {...register('message')}
          />
          {errors.message && (
            <p role="alert" className="text-xs font-medium text-rose-500">
              {errors.message.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-center gap-2 text-xs text-ink-faint">
            <CalendarCheck className="h-4 w-4 text-primary-500 shrink-0" />
            15-minute live walkthrough · No credit card required
          </p>
          <Button type="submit" size="md" loading={isSubmitting}>
            <Send className="h-4 w-4" />
            Request Live Demo
          </Button>
        </div>
      </form>
    </Card>
  );
}

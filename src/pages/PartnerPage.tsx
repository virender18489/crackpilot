import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Send } from 'lucide-react';
import { Navbar } from '../components/sections/Navbar';
import { Footer } from '../components/sections/Footer';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { WhatsAppButton } from '../components/ui/WhatsAppButton';
import { partnerApplySchema, type PartnerApplyFormValues } from '../lib/schemas';
import { useToast } from '../lib/toast';
import { usePageMeta } from '../lib/seo';

export default function PartnerPage() {
  usePageMeta({
    title: 'Agent Partner Program — Crackpilot',
    description:
      'Partner with Crackpilot as a career coach, campus ambassador, or creator and earn 25% commission on every credit pack referred.',
  });

  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PartnerApplyFormValues>({
    resolver: zodResolver(partnerApplySchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      channel: 'Career Coach / Mentor',
      audienceSize: '',
      notes: '',
    },
  });

  const onSubmit = async (values: PartnerApplyFormValues) => {
    try {
      const res = await fetch('/api/partner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        toast({ title: 'Submission failed', variant: 'error' });
        return;
      }
      setSubmitted(true);
      toast({
        title: 'Partner application received',
        description: 'Our partner team reviews applications within 24 hours.',
      });
    } catch {
      toast({ title: 'Network error', variant: 'error' });
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col">
      <Navbar />
      <main className="flex-1 py-14 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-2xl space-y-3">
            <p className="mono-label text-primary-500 dark:text-lavender-200">Agent Partner Program</p>
            <h1 className="text-hero font-display font-extrabold text-ink">
              Earn 25% on every credit pack you refer.
            </h1>
            <p className="text-base leading-relaxed text-ink-muted">
              Built for interview coaches, placement cells, technical mentors, and career creators. Share your tracked code, give candidates 10% off their first pack, and receive weekly UPI or bank payouts.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { value: '25%', label: 'Revenue share', sub: 'Paid on initial & repeat credit top-ups' },
              { value: '10% off', label: 'Candidate perk', sub: 'Automatic discount via your partner code' },
              { value: 'Weekly', label: 'Direct payouts', sub: 'UPI, NEFT/IMPS, or Stripe Connect' },
            ].map((stat) => (
              <Card key={stat.label} padding="md">
                <p className="font-display text-3xl font-bold text-ink tabular-nums">{stat.value}</p>
                <p className="mt-1 text-sm font-semibold text-ink">{stat.label}</p>
                <p className="mt-0.5 text-xs text-ink-muted">{stat.sub}</p>
              </Card>
            ))}
          </div>

          {submitted ? (
            <Card padding="lg" className="border-emerald-500/35 space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-ink">Application submitted</h2>
                  <p className="text-sm text-ink-muted">
                    We received your partner details and will email your referral dashboard credentials within one business day.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSubmitted(false);
                  reset();
                }}
              >
                Submit another application
              </Button>
            </Card>
          ) : (
            <Card padding="lg">
              <h2 className="text-xl font-bold text-ink mb-5">Apply to become an Agent Partner</h2>
              <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="Full name" placeholder="Priya Sharma" error={errors.name?.message} {...register('name')} />
                  <Input
                    label="Email address"
                    type="email"
                    placeholder="priya@careerprep.in"
                    error={errors.email?.message}
                    {...register('email')}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="Phone / WhatsApp"
                    type="tel"
                    placeholder="+91 98765 43210"
                    error={errors.phone?.message}
                    {...register('phone')}
                  />
                  <div className="space-y-1.5">
                    <label htmlFor="partner-channel" className="block text-sm font-medium text-ink">
                      Partner profile
                    </label>
                    <select
                      id="partner-channel"
                      className="min-h-[44px] w-full rounded-xl border border-border-subtle bg-surface-subtle px-3.5 py-2.5 text-sm text-ink focus:border-primary-500 focus:bg-surface focus:outline-none"
                      {...register('channel')}
                    >
                      <option value="Career Coach / Mentor">Career Coach / Mentor</option>
                      <option value="Campus Ambassador">Campus Ambassador</option>
                      <option value="Content Creator">Content Creator</option>
                      <option value="Recruiting Agency">Recruiting Agency</option>
                    </select>
                  </div>
                </div>

                <Input
                  label="Estimated monthly candidate reach"
                  placeholder="e.g., 50+ mock interview mentees / month"
                  error={errors.audienceSize?.message}
                  {...register('audienceSize')}
                />

                <div className="space-y-1.5">
                  <label htmlFor="partner-notes" className="block text-sm font-medium text-ink">
                    How do you plan to share Crackpilot?
                  </label>
                  <textarea
                    id="partner-notes"
                    rows={4}
                    placeholder="Tell us about your community, cohort, or coaching sessions..."
                    className="w-full rounded-xl border border-border-subtle bg-surface-subtle px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-primary-500 focus:bg-surface focus:outline-none"
                    {...register('notes')}
                  />
                  {errors.notes && (
                    <p role="alert" className="text-xs font-medium text-rose-500">
                      {errors.notes.message}
                    </p>
                  )}
                </div>

                <div className="flex justify-end pt-1">
                  <Button type="submit" size="lg" loading={isSubmitting}>
                    <Send className="h-4 w-4" />
                    Submit Partner Application
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}

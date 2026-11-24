import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Star, CheckCircle2, Send } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { reviewSchema, type ReviewFormValues } from '../../lib/schemas';
import { useToast } from '../../lib/toast';
import { usePageMeta } from '../../lib/seo';

export default function ReviewPage() {
  usePageMeta({
    title: 'Review Crackpilot — Workspace',
    description: 'Share your feedback and rate your interview prep experience with Crackpilot.',
  });

  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { rating: 5, roleTitle: '', comment: '' },
  });

  const rating = watch('rating');

  const onSubmit = async (values: ReviewFormValues) => {
    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        toast({ title: 'Could not submit review', variant: 'error' });
        return;
      }
      setSubmitted(true);
      toast({ title: 'Thank you for your review', description: 'Your feedback helps shape Crackpilot.' });
    } catch {
      toast({ title: 'Network error', variant: 'error' });
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="space-y-1">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink">Review Crackpilot</h1>
        <p className="text-sm text-ink-muted">
          Tell us how Crackpilot performed in your practice drills or live interviews.
        </p>
      </div>

      {submitted ? (
        <Card padding="lg" className="border-emerald-500/35 space-y-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-ink">Feedback received</h2>
              <p className="text-sm text-ink-muted">
                Appreciate you taking a minute to share how your interviews went.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSubmitted(false);
              reset({ rating: 5, roleTitle: '', comment: '' });
            }}
          >
            Submit another note
          </Button>
        </Card>
      ) : (
        <Card padding="lg">
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            <div className="space-y-2">
              <span className="block text-sm font-medium text-ink">Overall rating</span>
              <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Star rating">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = (hoverRating || rating) >= star;
                  return (
                    <button
                      key={star}
                      type="button"
                      role="radio"
                      aria-checked={rating === star}
                      aria-label={`${star} star${star > 1 ? 's' : ''}`}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setValue('rating', star, { shouldValidate: true })}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-border-subtle bg-surface-subtle transition-colors hover:border-primary-500/40 cursor-pointer"
                    >
                      <Star
                        className={`h-5 w-5 ${
                          active ? 'fill-amber-400 text-amber-400' : 'text-ink-faint'
                        }`}
                      />
                    </button>
                  );
                })}
                <span className="ml-2 font-mono text-xs text-ink-muted tabular-nums">{rating} / 5</span>
              </div>
              {errors.rating && (
                <p role="alert" className="text-xs font-medium text-rose-500">
                  {errors.rating.message}
                </p>
              )}
            </div>

            <Input
              label="Role you interviewed for"
              placeholder="e.g., Senior Frontend Engineer, Product Manager"
              error={errors.roleTitle?.message}
              {...register('roleTitle')}
            />

            <div className="space-y-1.5">
              <label htmlFor="review-text" className="block text-sm font-medium text-ink">
                Your review
              </label>
              <textarea
                id="review-text"
                rows={4}
                placeholder="What worked well? What should we sharpen next?"
                className="w-full rounded-xl border border-border-subtle bg-surface-subtle px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-primary-500 focus:bg-surface focus:outline-none"
                {...register('comment')}
              />
              {errors.comment && (
                <p role="alert" className="text-xs font-medium text-rose-500">
                  {errors.comment.message}
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <Button type="submit" loading={isSubmitting}>
                <Send className="h-4 w-4" />
                Submit Review
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TESTIMONIALS } from '../../data/testimonials';
import { Card } from '../ui/Card';

export function TestimonialsSection() {
  const [activeIndex, setActiveIndex] = useState(0);

  const prev = () => setActiveIndex((i) => (i === 0 ? TESTIMONIALS.length - 1 : i - 1));
  const next = () => setActiveIndex((i) => (i === TESTIMONIALS.length - 1 ? 0 : i + 1));

  const visible = [0, 1, 2].map((offset) => TESTIMONIALS[(activeIndex + offset) % TESTIMONIALS.length]);

  return (
    <section id="reviews" className="py-20 sm:py-24 border-t border-border-subtle bg-surface-subtle/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl space-y-3">
            <p className="mono-label text-primary-500 dark:text-lavender-200">Candidate Reviews</p>
            <h2 className="text-section font-display font-bold text-ink">
              Used across technical panels, product cases, and final loops.
            </h2>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-end">
            <button
              type="button"
              onClick={prev}
              aria-label="Previous testimonial"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-border-subtle bg-surface text-ink-muted transition-colors hover:border-primary-500/50 hover:text-ink cursor-pointer"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next testimonial"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-border-subtle bg-surface text-ink-muted transition-colors hover:border-primary-500/50 hover:text-ink cursor-pointer"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((item, idx) => (
            <Card
              key={`${item.id}-${idx}`}
              padding="lg"
              className={`flex flex-col justify-between gap-6 ${idx === 2 ? 'hidden lg:flex' : ''}`}
            >
              <div className="space-y-4">
                <p className="font-mono text-xs text-primary-500 dark:text-lavender-200">
                  {item.outcome}
                </p>
                <blockquote className="text-sm sm:text-base leading-relaxed text-ink">
                  “{item.quote}”
                </blockquote>
              </div>

              <div className="border-t border-border-subtle pt-4">
                <p className="text-sm font-bold text-ink">{item.name}</p>
                <p className="text-xs text-ink-muted mt-0.5">
                  {item.role} · {item.company} · {item.location}
                </p>
              </div>
            </Card>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2" role="tablist" aria-label="Testimonial slides">
          {TESTIMONIALS.map((t, i) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeIndex === i}
              aria-label={`Show review by ${t.name}`}
              onClick={() => setActiveIndex(i)}
              className={`h-2 rounded-full transition-all cursor-pointer ${
                activeIndex === i ? 'w-7 bg-primary-500' : 'w-2 bg-border-strong hover:bg-ink-faint'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

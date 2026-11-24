import { Link } from 'react-router-dom';
import { ArrowRight, Users } from 'lucide-react';
import { FAQ_ITEMS } from '../../data/faqs';
import { Accordion } from '../ui/Accordion';
import { Button } from '../ui/Button';
import { BookDemoForm } from '../dashboard/BookDemoForm';

export function FaqAndConversionSection() {
  return (
    <>
      {/* 13. FAQ Accordion */}
      <section id="faq" className="py-20 sm:py-24 border-t border-border-subtle">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="space-y-3 text-center">
            <p className="mono-label text-primary-500 dark:text-lavender-200">FAQ</p>
            <h2 className="text-section font-display font-bold text-ink">
              Straight answers before you install.
            </h2>
          </div>

          <Accordion items={FAQ_ITEMS} defaultOpenId="faq-1" />
        </div>
      </section>

      {/* 14. Partner Program Banner */}
      <section className="py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-border-subtle bg-surface p-6 sm:p-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4 max-w-2xl">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-500/12 text-primary-500 dark:text-lavender-200">
                <Users className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="space-y-1.5">
                <p className="mono-label text-primary-500 dark:text-lavender-200">Agent Partner Program</p>
                <h2 className="text-xl sm:text-2xl font-display font-bold text-ink">
                  Coach candidates or run a placement community? Earn recurring payouts.
                </h2>
                <p className="text-sm text-ink-muted">
                  Refer job seekers with your custom partner code, track conversions in real time, and earn 25% commission on every credit pack purchased.
                </p>
              </div>
            </div>
            <Link to="/partner" className="shrink-0">
              <Button variant="secondary" size="lg">
                Apply as Partner
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 15. Final CTA */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl border border-primary-400/35 bg-gradient-to-br from-primary-600 via-primary-700 to-navy-950 px-6 py-12 sm:px-12 sm:py-16 text-white">
            <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-60" aria-hidden="true" />
            <div className="relative z-10 max-w-2xl space-y-5">
              <p className="mono-label text-lavender-200">Ready in 4 minutes</p>
              <h2 className="text-section font-display font-bold text-white">
                Walk into your next interview with your sharpest stories at eye level.
              </h2>
              <p className="text-sm sm:text-base text-lavender-100/85">
                Create your workspace, test audio loopback in Practice Mode, and keep pay-per-use hours ready whenever the next loop is scheduled.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link to="/signup">
                  <Button size="lg" variant="secondary">
                    Create Free Account
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <a
                  href="#book-demo"
                  className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-lavender-200/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20"
                >
                  Book a 15-min Demo
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 16. Book a Demo Form */}
      <section id="book-demo" className="py-20 sm:py-24 border-t border-border-subtle">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="space-y-3 text-center">
            <p className="mono-label text-primary-500 dark:text-lavender-200">Live Onboarding</p>
            <h2 className="text-section font-display font-bold text-ink">
              Book a live setup demo
            </h2>
            <p className="mx-auto max-w-xl text-sm sm:text-base text-ink-muted">
              See real-time voice transcription, Alt+S screen capture, and mobile QR pairing tested on your preferred meeting platform.
            </p>
          </div>

          <BookDemoForm />
        </div>
      </section>
    </>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ArrowRight, MessageCircle, Zap, Mic, Flame, Lightbulb } from 'lucide-react';
import { PRICING_CONFIG, calculatePrice, formatCurrency } from '../../data/pricing';
import { Slider } from '../ui/Slider';
import { useAuth } from '../../lib/auth';

export function PricingSection({ standalone = false }: { standalone?: boolean }) {
  const { user } = useAuth();
  const [hours, setHours] = useState(3);
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');

  const quote = calculatePrice(hours, currency);
  const phoneRaw = import.meta.env.VITE_WHATSAPP_NUMBER || '919876543210';
  const waDiscountHref = `https://wa.me/${phoneRaw}?text=${encodeURIComponent(
    `Hi Crackpilot team, I'm interested in the ${hours}-hour credit pack and would like to ask about an exclusive discount or coupon code.`
  )}`;

  return (
    <section
      id="pricing"
      className={
        standalone
          ? 'py-14 sm:py-20 bg-canvas'
          : 'py-20 sm:py-24 border-t border-border-subtle bg-canvas'
      }
    >
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Section Heading + Currency Toggle */}
        <div className="flex flex-col items-center text-center space-y-4">
          <p className="mono-label text-primary-500 dark:text-lavender-200">Pay-per-use Pricing</p>
          <h2 className="text-section font-display font-bold text-ink">
            Pay only for the interview hours you use.
          </h2>
          <p className="max-w-xl text-sm sm:text-base text-ink-muted">
            No subscription, no recurring charges. Usage time never expires.
          </p>

          <div
            role="group"
            aria-label="Currency selector"
            className="inline-flex items-center rounded-xl border border-border-subtle bg-surface p-1 shadow-xs"
          >
            {(['INR', 'USD'] as const).map((cur) => (
              <button
                key={cur}
                type="button"
                onClick={() => setCurrency(cur)}
                className={`min-h-[36px] rounded-lg px-4 py-1.5 font-mono text-xs font-semibold transition-colors cursor-pointer ${
                  currency === cur ? 'bg-primary-500 text-white' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {cur === 'INR' ? 'INR (₹)' : 'USD ($)'}
              </button>
            ))}
          </div>
        </div>

        {/* Single Centered Pricing Card matching reference layout */}
        <div className="rounded-3xl border border-primary-300/60 dark:border-primary-500/30 bg-surface p-6 sm:p-10 shadow-xl shadow-primary-950/6 dark:shadow-none space-y-7">
          {/* Header: Selected Time & One-Time Pack Pill */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <p className="font-mono text-xs font-semibold uppercase tracking-wider text-ink">
                Selected Time &amp; Quota
              </p>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-4xl sm:text-5xl font-extrabold text-ink tabular-nums leading-none">
                  {hours}
                </span>
                <span className="font-display text-lg sm:text-xl font-semibold text-ink">
                  {hours === 1 ? 'Hour' : 'Hours'}
                </span>
              </div>
            </div>

            <span className="inline-flex items-center rounded-full bg-lavender-200/80 dark:bg-primary-500/18 px-3.5 py-1 font-mono text-[11px] font-semibold tracking-wider text-primary-600 dark:text-lavender-200 uppercase whitespace-nowrap shrink-0">
              One-Time Pack
            </span>
          </div>

          {/* 3 Feature / Discount Pills Row */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 dark:border-primary-500/30 bg-primary-50 dark:bg-primary-500/12 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-primary-600 dark:text-lavender-200">
              <Zap className="h-3.5 w-3.5 text-primary-500 shrink-0" aria-hidden="true" />
              <span className="tabular-nums">
                {quote.captures} Screen Captures &amp; Written Questions (20/hr)
              </span>
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/12 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              <Mic className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
              Unlimited Live Audio Listening
            </span>

            {quote.discountPct > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/80 dark:border-amber-500/35 bg-amber-50 dark:bg-amber-500/15 px-3.5 py-1.5 text-xs sm:text-sm font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                <Flame className="h-3.5 w-3.5 text-amber-500 shrink-0" aria-hidden="true" />
                {quote.discountPct}% OFF
              </span>
            )}
          </div>

          {/* Slider Box */}
          <div className="rounded-2xl border border-border-subtle bg-surface-subtle/75 px-5 py-5 space-y-3">
            <Slider
              min={PRICING_CONFIG.minHours}
              max={PRICING_CONFIG.maxHours}
              value={hours}
              onChange={setHours}
              ariaLabel="Interview hours slider"
            />
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-ink tabular-nums">
              <span>1 Hr (20 Qs)</span>
              <span className="text-right">40 Hrs (800 Qs · Up to 68.7% Off)</span>
            </div>
          </div>

          {/* Dashed WhatsApp Coupon Callout */}
          <div className="rounded-2xl border border-dashed border-emerald-400/70 dark:border-emerald-500/40 bg-emerald-50/75 dark:bg-emerald-500/8 px-5 py-4 flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <Lightbulb className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
              <p className="text-sm font-semibold text-ink">
                Need an exclusive discount or coupon code?
              </p>
            </div>
            <a
              href={waDiscountHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition-colors hover:bg-emerald-600 whitespace-nowrap shrink-0"
            >
              <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              Get Discount on WhatsApp
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </a>
          </div>

          {/* Divider */}
          <div className="border-t border-border-subtle" />

          {/* Total Amount & Effective Rate Row */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1.5">
              <p className="text-xs sm:text-sm font-medium text-ink-muted">Total Amount</p>
              <div className="flex flex-wrap items-baseline gap-3">
                {quote.discountPct > 0 && (
                  <span className="font-mono text-base sm:text-lg text-ink-faint line-through tabular-nums">
                    {formatCurrency(quote.subtotal, currency)}
                  </span>
                )}
                <span className="font-display text-4xl sm:text-5xl font-extrabold text-ink tabular-nums leading-none">
                  {formatCurrency(quote.total, currency)}
                </span>
              </div>
            </div>

            <div className="text-left sm:text-right space-y-0.5">
              <p className="text-xs sm:text-sm font-medium text-ink-muted">Effective rate:</p>
              <p className="font-display text-lg sm:text-xl font-bold text-primary-600 dark:text-lavender-200 tabular-nums">
                {formatCurrency(quote.effectivePerHour, currency)}/hour
              </p>
            </div>
          </div>

          {/* Clean Single-Column Checklist */}
          <ul className="space-y-3 pt-1">
            {PRICING_CONFIG.includedFeatures.map((feat) => (
              <li key={feat} className="flex items-start gap-3 text-sm sm:text-[15px] text-ink">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-500 stroke-[2.5]" aria-hidden="true" />
                <span>{feat}</span>
              </li>
            ))}
          </ul>

          {/* Full-Width Rounded Checkout CTA */}
          <Link
            to={user ? '/dashboard/billing' : '/signup'}
            className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-full bg-primary-500 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-primary-500/25 transition-all hover:bg-primary-600 active:bg-primary-700"
          >
            <span>
              {user
                ? `Proceed to Checkout (${formatCurrency(quote.total, currency)})`
                : `Proceed to Checkout (${formatCurrency(quote.total, currency)})`}
            </span>
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

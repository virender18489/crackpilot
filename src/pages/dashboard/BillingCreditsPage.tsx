import { useEffect, useState } from 'react';
import { Download, Check, ArrowRight, Zap, Mic, Flame, Lightbulb, MessageCircle } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Slider } from '../../components/ui/Slider';
import {
  TableWrapper,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from '../../components/ui/Table';
import { INITIAL_CREDITS, INITIAL_INVOICES, type InvoiceRecord } from '../../data/dashboard';
import { PRICING_CONFIG, calculatePrice, formatCurrency } from '../../data/pricing';
import { useToast } from '../../lib/toast';
import { usePageMeta } from '../../lib/seo';

export default function BillingCreditsPage() {
  usePageMeta({
    title: 'Billing & Credits — Crackpilot',
    description: 'Check remaining interview minutes, buy pay-per-use credit bundles, and download GST invoices.',
  });

  const { toast } = useToast();
  const [credits, setCredits] = useState(INITIAL_CREDITS);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>(INITIAL_INVOICES);
  const [hours, setHours] = useState(3);
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    fetch('/api/credits', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.credits) setCredits(data.credits);
        if (Array.isArray(data?.invoices)) setInvoices(data.invoices);
      })
      .catch(() => {});
  }, []);

  const quote = calculatePrice(hours, currency);
  const phoneRaw = import.meta.env.VITE_WHATSAPP_NUMBER || '919876543210';
  const waDiscountHref = `https://wa.me/${phoneRaw}?text=${encodeURIComponent(
    `Hi Crackpilot team, I'm topping up ${hours} hours in my workspace and wanted to check if any coupon codes apply.`
  )}`;

  const handleBuyCredits = async () => {
    setPurchasing(true);
    try {
      const res = await fetch('/api/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          hours,
          currency,
          amountLabel: formatCurrency(quote.total, currency),
        }),
      });
      const data = await res.json();
      if (res.ok && data.credits) {
        setCredits(data.credits);
        if (Array.isArray(data.invoices)) setInvoices(data.invoices);
        toast({
          title: `Added ${hours} hour${hours > 1 ? 's' : ''} to your balance`,
          description: `You now have ${data.credits.minutesLeft} mins and ${data.credits.capturesLimit - data.credits.capturesUsed} captures left.`,
        });
      }
    } catch {
      toast({ title: 'Checkout failed', description: 'Unable to add credits right now.', variant: 'error' });
    } finally {
      setPurchasing(false);
    }
  };

  const handleDownloadInvoice = (inv: InvoiceRecord) => {
    const content = [
      'CRACKPILOT TAX INVOICE',
      `Invoice ID: ${inv.id}`,
      `Date: ${inv.date}`,
      `Item: ${inv.description}`,
      `Amount Paid: ${inv.amount}`,
      `Status: ${inv.status}`,
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${inv.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `Downloaded ${inv.id}`, variant: 'info' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink">Billing &amp; Credits</h1>
          <p className="text-sm text-ink-muted">
            Pay only for the interview hours you need. No auto-renewals, no credit expiration.
          </p>
        </div>

        <div className="inline-flex items-center rounded-xl border border-border-subtle bg-surface p-1 self-start">
          {(['INR', 'USD'] as const).map((cur) => (
            <button
              key={cur}
              type="button"
              onClick={() => setCurrency(cur)}
              className={`min-h-[34px] rounded-lg px-3.5 py-1 text-xs font-mono font-semibold transition-colors cursor-pointer ${
                currency === cur ? 'bg-primary-500 text-white' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {cur}
            </button>
          ))}
        </div>
      </div>

      {/* Current Balance Summary */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Card className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="mono-label text-ink-faint">Current Plan</span>
            <Badge variant="primary">{credits.planName}</Badge>
          </div>
          <p className="font-display text-3xl font-bold text-ink tabular-nums">
            {credits.minutesLeft} mins left
          </p>
          <p className="text-xs text-ink-muted">
            Usable across unlimited rounds on Windows, macOS, and Android.
          </p>
        </Card>

        <Card className="space-y-2">
          <span className="mono-label text-ink-faint">Screen Captures &amp; Prompts</span>
          <p className="font-display text-3xl font-bold text-ink tabular-nums">
            {credits.capturesLimit - credits.capturesUsed} left
          </p>
          <p className="text-xs text-ink-muted">
            {credits.capturesUsed} used of {credits.capturesLimit} total available captures.
          </p>
        </Card>
      </div>

      {/* Buy More Credits Card matching landing pricing layout */}
      <div className="rounded-3xl border border-primary-300/60 dark:border-primary-500/30 bg-surface p-6 sm:p-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-ink">
              Selected Time &amp; Quota
            </p>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-4xl font-extrabold text-ink tabular-nums leading-none">
                {hours}
              </span>
              <span className="font-display text-lg font-semibold text-ink">
                {hours === 1 ? 'Hour' : 'Hours'}
              </span>
            </div>
          </div>

          <span className="inline-flex items-center rounded-full bg-lavender-200/80 dark:bg-primary-500/18 px-3.5 py-1 font-mono text-[11px] font-semibold tracking-wider text-primary-600 dark:text-lavender-200 uppercase whitespace-nowrap shrink-0">
            One-Time Pack
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 dark:border-primary-500/30 bg-primary-50 dark:bg-primary-500/12 px-3.5 py-1.5 text-xs font-semibold text-primary-600 dark:text-lavender-200">
            <Zap className="h-3.5 w-3.5 text-primary-500 shrink-0" aria-hidden="true" />
            <span className="tabular-nums">
              {quote.captures} Screen Captures &amp; Written Questions (20/hr)
            </span>
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/12 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <Mic className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
            Unlimited Live Audio Listening
          </span>

          {quote.discountPct > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/80 dark:border-amber-500/35 bg-amber-50 dark:bg-amber-500/15 px-3.5 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 tabular-nums">
              <Flame className="h-3.5 w-3.5 text-amber-500 shrink-0" aria-hidden="true" />
              {quote.discountPct}% OFF
            </span>
          )}
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface-subtle/75 px-5 py-4 space-y-2.5">
          <Slider
            min={PRICING_CONFIG.minHours}
            max={PRICING_CONFIG.maxHours}
            value={hours}
            onChange={setHours}
            ariaLabel="Select credit hours"
          />
          <div className="flex items-center justify-between gap-2 text-xs font-semibold text-ink tabular-nums">
            <span>1 Hr (20 Qs)</span>
            <span className="text-right">40 Hrs (800 Qs · Up to 68.7% Off)</span>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-emerald-400/70 dark:border-emerald-500/40 bg-emerald-50/75 dark:bg-emerald-500/8 px-4 py-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <Lightbulb className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
            <p className="text-xs sm:text-sm font-semibold text-ink">
              Need an exclusive discount or coupon code?
            </p>
          </div>
          <a
            href={waDiscountHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-600 whitespace-nowrap shrink-0"
          >
            <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            Get Discount on WhatsApp
            <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          </a>
        </div>

        <div className="border-t border-border-subtle" />

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-ink-muted">Total Amount</p>
            <div className="flex flex-wrap items-baseline gap-2.5">
              {quote.discountPct > 0 && (
                <span className="font-mono text-base text-ink-faint line-through tabular-nums">
                  {formatCurrency(quote.subtotal, currency)}
                </span>
              )}
              <span className="font-display text-4xl font-extrabold text-ink tabular-nums leading-none">
                {formatCurrency(quote.total, currency)}
              </span>
            </div>
          </div>

          <div className="text-left sm:text-right space-y-0.5">
            <p className="text-xs font-medium text-ink-muted">Effective rate:</p>
            <p className="font-display text-lg font-bold text-primary-600 dark:text-lavender-200 tabular-nums">
              {formatCurrency(quote.effectivePerHour, currency)}/hour
            </p>
          </div>
        </div>

        <ul className="space-y-2.5">
          {PRICING_CONFIG.includedFeatures.map((feat) => (
            <li key={feat} className="flex items-start gap-2.5 text-sm text-ink">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-500 stroke-[2.5]" aria-hidden="true" />
              <span>{feat}</span>
            </li>
          ))}
        </ul>

        <Button
          fullWidth
          size="lg"
          loading={purchasing}
          onClick={handleBuyCredits}
          className="rounded-full min-h-[52px] text-base"
        >
          Proceed to Checkout ({formatCurrency(quote.total, currency)})
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Payment History Table */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-ink">Payment History</h2>
        <div className="hidden sm:block">
          <TableWrapper>
            <TableHead>
              <tr>
                <TableHeaderCell>Invoice</TableHeaderCell>
                <TableHeaderCell>Date</TableHeaderCell>
                <TableHeaderCell>Description</TableHeaderCell>
                <TableHeaderCell>Amount</TableHeaderCell>
                <TableHeaderCell className="text-right">Receipt</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-xs font-semibold text-ink">{inv.id}</TableCell>
                  <TableCell className="font-mono text-xs text-ink-muted tabular-nums whitespace-nowrap">
                    {inv.date}
                  </TableCell>
                  <TableCell className="text-xs text-ink-muted">{inv.description}</TableCell>
                  <TableCell className="font-mono text-xs font-semibold text-ink tabular-nums">
                    {inv.amount}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleDownloadInvoice(inv)}>
                      <Download className="h-3.5 w-3.5" />
                      Invoice
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </TableWrapper>
        </div>

        <div className="space-y-2.5 sm:hidden">
          {invoices.map((inv) => (
            <Card key={inv.id} padding="sm" className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-ink">{inv.id}</span>
                <span className="font-mono text-xs font-semibold text-ink tabular-nums">{inv.amount}</span>
              </div>
              <p className="text-xs text-ink-muted">{inv.description}</p>
              <div className="flex items-center justify-between pt-1 border-t border-border-subtle">
                <span className="font-mono text-[11px] text-ink-faint">{inv.date}</span>
                <Button variant="ghost" size="sm" onClick={() => handleDownloadInvoice(inv)}>
                  <Download className="h-3.5 w-3.5" />
                  Invoice
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

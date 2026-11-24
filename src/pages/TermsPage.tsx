import { Navbar } from '../components/sections/Navbar';
import { Footer } from '../components/sections/Footer';
import { WhatsAppButton } from '../components/ui/WhatsAppButton';
import { usePageMeta } from '../lib/seo';

export default function TermsPage() {
  usePageMeta({
    title: 'Terms of Service — Crackpilot',
    description: 'Terms governing Crackpilot credits, desktop and Android software licenses, and acceptable use.',
  });

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col">
      <Navbar />
      <main className="flex-1 py-14 sm:py-20">
        <article className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 space-y-8">
          <header className="space-y-2 border-b border-border-subtle pb-6">
            <p className="mono-label text-primary-500 dark:text-lavender-200">Legal</p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink">Terms of Service</h1>
            <p className="font-mono text-xs text-ink-faint">Last updated: November 2026</p>
          </header>

          <section className="space-y-3 text-sm sm:text-base leading-relaxed text-ink-muted">
            <h2 className="text-lg font-bold text-ink">1. Pay-per-use credit model</h2>
            <p>
              Crackpilot operates on prepaid hourly interview credit packs. Minutes are deducted only during active live-assist sessions. Unused credits remain available in your account without recurring subscription charges.
            </p>
          </section>

          <section className="space-y-3 text-sm sm:text-base leading-relaxed text-ink-muted">
            <h2 className="text-lg font-bold text-ink">2. Device authorization</h2>
            <p>
              Auth Tokens remain valid for 48 hours and authorize up to two devices simultaneously per account. Sharing account credentials or reselling session access outside the official Agent Partner Program is prohibited.
            </p>
          </section>

          <section className="space-y-3 text-sm sm:text-base leading-relaxed text-ink-muted">
            <h2 className="text-lg font-bold text-ink">3. User responsibility</h2>
            <p>
              You are responsible for ensuring your use of interview preparation and live-assist tools complies with applicable laws, platform terms, and any specific assessment guidelines provided by prospective employers.
            </p>
          </section>

          <section className="space-y-3 text-sm sm:text-base leading-relaxed text-ink-muted">
            <h2 className="text-lg font-bold text-ink">4. Support &amp; refunds</h2>
            <p>
              Unused credit packs purchased within 7 days with zero live minutes consumed are eligible for a full refund via Support Ticket or support@crackpilot.dev.
            </p>
          </section>
        </article>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}

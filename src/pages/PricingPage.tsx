import { Navbar } from '../components/sections/Navbar';
import { PricingSection } from '../components/sections/PricingSection';
import { Footer } from '../components/sections/Footer';
import { Accordion } from '../components/ui/Accordion';
import { WhatsAppButton } from '../components/ui/WhatsAppButton';
import { FAQ_ITEMS } from '../data/faqs';
import { usePageMeta } from '../lib/seo';

export default function PricingPage() {
  usePageMeta({
    title: 'Pricing — Crackpilot Pay-Per-Use Interview Credits',
    description:
      'Transparent pay-per-use pricing starting at ₹799/hr or $10/hr with automatic multi-hour discounts. Credits never expire.',
  });

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col">
      <Navbar />
      <main className="flex-1">
        <PricingSection standalone />

        <section className="py-16 sm:py-20 border-t border-border-subtle">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="space-y-2 text-center">
              <p className="mono-label text-primary-500 dark:text-lavender-200">Billing Questions</p>
              <h2 className="text-section font-display font-bold text-ink">Pricing &amp; credits FAQ</h2>
            </div>
            <Accordion items={FAQ_ITEMS.slice(0, 6)} defaultOpenId="faq-1" />
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}

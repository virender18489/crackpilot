import { lazy, Suspense, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Navbar } from '../components/sections/Navbar';
import { HeroSection } from '../components/sections/HeroSection';
import { PlatformMarquee } from '../components/sections/PlatformMarquee';
import { Footer } from '../components/sections/Footer';
import { WhatsAppButton } from '../components/ui/WhatsAppButton';
import { Skeleton } from '../components/ui/Skeleton';
import { FAQ_ITEMS } from '../data/faqs';
import { usePageMeta } from '../lib/seo';

// Lazy-load below-the-fold sections
const MobileRemoteSection = lazy(() =>
  import('../components/sections/MobileRemoteSection').then((m) => ({ default: m.MobileRemoteSection }))
);
const BentoFeaturesSection = lazy(() =>
  import('../components/sections/BentoFeaturesSection').then((m) => ({ default: m.BentoFeaturesSection }))
);
const CustomQASection = lazy(() =>
  import('../components/sections/CustomQASection').then((m) => ({ default: m.CustomQASection }))
);
const HowItWorksSection = lazy(() =>
  import('../components/sections/HowItWorksSection').then((m) => ({ default: m.HowItWorksSection }))
);
const TestimonialsSection = lazy(() =>
  import('../components/sections/TestimonialsSection').then((m) => ({ default: m.TestimonialsSection }))
);
const RoleShowcaseSection = lazy(() =>
  import('../components/sections/RoleShowcaseSection').then((m) => ({ default: m.RoleShowcaseSection }))
);
const DownloadSection = lazy(() =>
  import('../components/sections/DownloadSection').then((m) => ({ default: m.DownloadSection }))
);
const ShortcutsSection = lazy(() =>
  import('../components/sections/ShortcutsSection').then((m) => ({ default: m.ShortcutsSection }))
);
const PricingSection = lazy(() =>
  import('../components/sections/PricingSection').then((m) => ({ default: m.PricingSection }))
);
const FaqAndConversionSection = lazy(() =>
  import('../components/sections/FaqAndConversionSection').then((m) => ({ default: m.FaqAndConversionSection }))
);

function SectionFallback() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function LandingPage() {
  const location = useLocation();

  const faqJsonLd = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ_ITEMS.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    }),
    []
  );

  usePageMeta({
    title: 'Crackpilot — Live AI Interview Assist & Prep Workspace',
    description:
      'Real-time AI interview preparation and live-assist desktop and Android apps. Resume-aware suggestions, mobile QR remote, and pay-per-use credits from ₹799/hr.',
    jsonLd: faqJsonLd,
  });

  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.replace('#', '');
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [location.hash]);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <Navbar />
      <main>
        <HeroSection />
        <PlatformMarquee />
        <Suspense fallback={<SectionFallback />}>
          <MobileRemoteSection />
          <BentoFeaturesSection />
          <CustomQASection />
          <HowItWorksSection />
          <TestimonialsSection />
          <RoleShowcaseSection />
          <DownloadSection />
          <ShortcutsSection />
          <PricingSection />
          <FaqAndConversionSection />
        </Suspense>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}

import { Navbar } from '../components/sections/Navbar';
import { Footer } from '../components/sections/Footer';
import { WhatsAppButton } from '../components/ui/WhatsAppButton';
import { usePageMeta } from '../lib/seo';

export default function PrivacyPage() {
  usePageMeta({
    title: 'Privacy Policy — Crackpilot',
    description: 'How Crackpilot handles account details, resumes, live audio streams, and session transcripts.',
  });

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col">
      <Navbar />
      <main className="flex-1 py-14 sm:py-20">
        <article className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 space-y-8">
          <header className="space-y-2 border-b border-border-subtle pb-6">
            <p className="mono-label text-primary-500 dark:text-lavender-200">Legal</p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink">Privacy Policy</h1>
            <p className="font-mono text-xs text-ink-faint">Last updated: November 2026</p>
          </header>

          <section className="space-y-3 text-sm sm:text-base leading-relaxed text-ink-muted">
            <h2 className="text-lg font-bold text-ink">1. Information we collect</h2>
            <p>
              We collect only the information required to run your Crackpilot workspace: your email address, optional phone number, target profile settings, uploaded resume documents, custom Knowledge Engine entries, and billing invoices.
            </p>
          </section>

          <section className="space-y-3 text-sm sm:text-base leading-relaxed text-ink-muted">
            <h2 className="text-lg font-bold text-ink">2. Audio &amp; screen capture handling</h2>
            <p>
              System audio loopback and on-demand screen captures triggered via hotkeys or the mobile remote are processed in real time to generate structured talking points. Raw audio buffers are not retained after transcription completes, and customer data is never used to train third-party foundation models.
            </p>
          </section>

          <section className="space-y-3 text-sm sm:text-base leading-relaxed text-ink-muted">
            <h2 className="text-lg font-bold text-ink">3. Local network QR pairing</h2>
            <p>
              Mobile remote pairing communicates over your local Wi-Fi network using a temporary session key tied to your 48-hour Auth Token. Sessions terminate immediately when you close the desktop app or revoke your token.
            </p>
          </section>

          <section className="space-y-3 text-sm sm:text-base leading-relaxed text-ink-muted">
            <h2 className="text-lg font-bold text-ink">4. Data retention &amp; deletion</h2>
            <p>
              You may delete individual Knowledge Engine items, remove resumes, or permanently delete your entire account at any time from Account Settings. For privacy requests, contact support@crackpilot.dev.
            </p>
          </section>
        </article>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}

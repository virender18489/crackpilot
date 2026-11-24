import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Navbar } from '../components/sections/Navbar';
import { Footer } from '../components/sections/Footer';
import { Button } from '../components/ui/Button';
import { WhatsAppButton } from '../components/ui/WhatsAppButton';
import { usePageMeta } from '../lib/seo';

export default function NotFoundPage() {
  usePageMeta({
    title: 'Page Not Found — Crackpilot',
    description: 'The requested Crackpilot page could not be found.',
  });

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-24">
        <div className="max-w-md text-center space-y-5">
          <p className="font-mono text-sm font-semibold text-primary-500 dark:text-lavender-200">
            ERROR 404
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink">
            That route doesn&apos;t exist.
          </h1>
          <p className="text-sm text-ink-muted">
            The page may have moved or the link has a typo. Head back to the homepage or open your workspace.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link to="/">
              <Button>
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button variant="outline">Open Dashboard</Button>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}

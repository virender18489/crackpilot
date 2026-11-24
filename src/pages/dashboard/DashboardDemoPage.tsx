import { BookDemoForm } from '../../components/dashboard/BookDemoForm';
import { useAuth } from '../../lib/auth';
import { usePageMeta } from '../../lib/seo';

export default function DashboardDemoPage() {
  usePageMeta({
    title: 'Book a Demo — Crackpilot Workspace',
    description: 'Schedule a 15-minute live walkthrough of Crackpilot audio routing, screen capture, and mobile QR pairing.',
  });

  const { user } = useAuth();

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="space-y-1">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink">Book a Live Demo</h1>
        <p className="text-sm text-ink-muted">
          Walk through audio loopback, mobile QR pairing, and custom Knowledge Engine tuning with our onboarding team.
        </p>
      </div>

      <BookDemoForm defaultEmail={user?.email || ''} defaultName={user?.name || ''} />
    </div>
  );
}

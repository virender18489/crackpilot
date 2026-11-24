import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  KeyRound,
  Copy,
  Check,
  Download,
  QrCode,
  Camera,
  Laptop,
  Monitor,
  Smartphone,
  Clock,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { KeyCap } from '../../components/ui/KeyCap';
import {
  TableWrapper,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from '../../components/ui/Table';
import { INITIAL_CREDITS, INITIAL_PROFILE, type UserProfileData } from '../../data/dashboard';
import { INITIAL_SESSIONS, type InterviewSession } from '../../data/sessions';
import { KEYBOARD_SHORTCUTS } from '../../data/shortcuts';
import { useToast } from '../../lib/toast';
import { usePageMeta } from '../../lib/seo';

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

export default function OverviewPage() {
  usePageMeta({
    title: 'Workspace Overview — Crackpilot',
    description: 'Manage your active interview profile, remaining credits, 48-hour desktop Auth Token, and recent sessions.',
  });

  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfileData>(INITIAL_PROFILE);
  const [credits, setCredits] = useState(INITIAL_CREDITS);
  const [sessions, setSessions] = useState<InterviewSession[]>(INITIAL_SESSIONS.slice(0, 4));

  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [remainingSecs, setRemainingSecs] = useState(48 * 3600);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetch('/api/profile', { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)),
      fetch('/api/credits', { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)),
      fetch('/api/sessions', { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([profData, credData, sesData]) => {
        if (!mounted) return;
        if (profData?.profile) setProfile(profData.profile);
        if (credData?.credits) setCredits(credData.credits);
        if (sesData?.sessions) setSessions(sesData.sessions.slice(0, 4));
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!tokenModalOpen || !activeToken) return;
    const id = window.setInterval(() => {
      setRemainingSecs((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [tokenModalOpen, activeToken]);

  const handleGenerateToken = async () => {
    setGeneratingToken(true);
    try {
      const res = await fetch('/api/token', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.token) {
        setActiveToken(data.token);
        setRemainingSecs(data.ttlSeconds || 48 * 3600);
        setTokenModalOpen(true);
      } else {
        toast({ title: 'Token error', description: 'Could not generate a new Auth Token.', variant: 'error' });
      }
    } catch {
      toast({ title: 'Network error', description: 'Check your connection and retry.', variant: 'error' });
    } finally {
      setGeneratingToken(false);
    }
  };

  const handleCopyToken = async () => {
    if (!activeToken) return;
    try {
      await navigator.clipboard.writeText(activeToken);
      setCopied(true);
      toast({ title: 'Token copied', description: 'Paste this token into the Crackpilot desktop or Android app.' });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Copy failed', description: 'Select the token text manually.', variant: 'error' });
    }
  };

  const handleDownloadTrigger = (label: string, fileName: string) => {
    toast({
      title: `Starting ${label} download`,
      description: `${fileName} — verify checksum after installation.`,
      variant: 'info',
    });
  };

  const capturesLeft = Math.max(0, credits.capturesLimit - credits.capturesUsed);
  const capturePct = credits.capturesLimit > 0 ? (credits.capturesUsed / credits.capturesLimit) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Page Heading */}
      <div className="space-y-1">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink">Workspace Overview</h1>
        <p className="text-sm text-ink-muted">
          Quick glance at your active settings and recent sessions.
        </p>
      </div>

      {/* 1. Active Profile + Session Credits */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Active Profile Card */}
        <Card className="flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="mono-label text-ink-faint">Active Profile</p>
                <h2 className="mt-1 text-xl font-bold text-ink">{profile.targetRole}</h2>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {profile.experienceLevel} · {profile.companyType}
                </p>
              </div>
              <Link
                to="/dashboard/profile"
                className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-border-subtle bg-surface-subtle px-3 py-1.5 text-xs font-semibold text-primary-500 transition-colors hover:border-primary-500/40 hover:bg-primary-500/10 whitespace-nowrap shrink-0"
              >
                Configure
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {profile.techStack.map((skill) => (
                <span
                  key={skill}
                  className="rounded-lg border border-border-subtle bg-surface-subtle px-2.5 py-1 font-mono text-xs text-ink-muted"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          <div className="border-t border-border-subtle pt-3.5 flex items-center justify-between gap-2 text-xs text-ink-faint">
            <span className="truncate">Resume: {profile.resumeFileName}</span>
            <Link to="/dashboard/knowledge" className="font-medium text-primary-500 hover:underline whitespace-nowrap">
              Knowledge Engine
            </Link>
          </div>
        </Card>

        {/* Session Credits Card */}
        <Card className="flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="mono-label text-ink-faint">Session Credits</p>
                <p className="mt-1 font-display text-3xl sm:text-4xl font-bold text-ink tabular-nums">
                  {credits.minutesLeft} mins left
                </p>
              </div>
              <Badge variant="primary">{credits.planName}</Badge>
            </div>

            <div className="border-t border-border-subtle pt-4 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-ink-muted">
                  Screen captures &amp; written prompts:{' '}
                  <strong className="font-mono text-ink tabular-nums">
                    {credits.capturesUsed} / {credits.capturesLimit} used
                  </strong>
                </span>
                <Badge variant="lavender">{capturesLeft} left</Badge>
              </div>

              <div
                className="h-2 w-full overflow-hidden rounded-full bg-surface-elevated"
                role="progressbar"
                aria-valuenow={credits.capturesUsed}
                aria-valuemin={0}
                aria-valuemax={credits.capturesLimit}
                aria-label="Screen captures and written prompts used"
              >
                <div
                  className="h-full rounded-full bg-primary-500 transition-all"
                  style={{ width: `${Math.max(capturePct, credits.capturesUsed > 0 ? 4 : 0)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 text-xs text-ink-faint">
            <span>Credits never expire</span>
            <Link to="/dashboard/billing" className="font-semibold text-primary-500 hover:underline">
              Buy more credits
            </Link>
          </div>
        </Card>
      </div>

      {/* 2. Crackpilot Auth Token + Apps & QR Pairing */}
      <Card padding="lg" className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg sm:text-xl font-bold text-ink">Crackpilot Auth Token</h2>
              <Badge variant="neutral">Max 2 devices</Badge>
            </div>
            <p className="text-sm text-ink-muted">
              Generate a secure token (valid for 48 hours) to connect your app.
            </p>
          </div>
          <Button onClick={handleGenerateToken} loading={generatingToken} className="w-full sm:w-auto">
            <KeyRound className="h-4 w-4" />
            Generate 48h Token
          </Button>
        </div>

        {/* Download Apps & Helpers */}
        <div className="border-t border-border-subtle pt-5 space-y-3">
          <p className="mono-label text-ink-faint">Download Apps &amp; Helpers</p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Windows App', file: 'Crackpilot-Setup-2.4.exe', icon: Monitor },
              { label: 'Mac OS', file: 'Crackpilot-2.4-Universal.dmg', icon: Laptop },
              { label: 'Android (.apk)', file: 'Crackpilot-Mobile-2.4.apk', icon: Smartphone },
              { label: 'Lightweight Helper (.exe)', file: 'Crackpilot-LegacyHelper.exe', icon: Download },
            ].map((dl) => {
              const Icon = dl.icon;
              return (
                <button
                  key={dl.label}
                  type="button"
                  onClick={() => handleDownloadTrigger(dl.label, dl.file)}
                  className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-border-subtle bg-surface-subtle px-3.5 py-2.5 text-xs font-semibold text-ink transition-colors hover:border-primary-500/45 hover:bg-surface-elevated cursor-pointer"
                >
                  <Icon className="h-4 w-4 text-primary-500 shrink-0" aria-hidden="true" />
                  <span className="truncate">{dl.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Instant QR Pairing Info Banner */}
        <div className="rounded-xl border border-primary-500/25 bg-primary-500/8 p-4 sm:p-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-500/15 text-primary-500 dark:text-lavender-200">
              <QrCode className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-ink">Instant QR pairing</h3>
                <Badge variant="lavender">Zero install · Scan &amp; go</Badge>
              </div>
              <p className="text-xs sm:text-sm leading-relaxed text-ink-muted">
                After entering your Auth Token in the desktop app, a QR code appears. Scan it with your phone to pair the mobile remote—or open the local URL on the same Wi-Fi directly in your mobile browser.
              </p>
            </div>
          </div>
        </div>

        {/* 3 Mini Info Columns */}
        <div className="grid grid-cols-1 gap-4 border-t border-border-subtle pt-5 md:grid-cols-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-ink">Windows 11 &amp; 10</h3>
            <p className="text-xs leading-relaxed text-ink-muted">
              Full desktop app with WASAPI loopback audio, click-through overlay, and global Alt-key shortcuts out of the box.
            </p>
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-ink">Windows 7/8 &amp; older</h3>
            <p className="text-xs leading-relaxed text-ink-muted">
              Use the Lightweight Helper (.exe) to stream system audio with minimal RAM footprint and view answers on your phone remote.
            </p>
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-ink">Android phone app</h3>
            <p className="text-xs leading-relaxed text-ink-muted">
              Install the .apk for silent haptic alerts when answers finish streaming, or use browser-based QR pairing with zero install.
            </p>
          </div>
        </div>
      </Card>

      {/* 3. Highlight Banner (Royal Blue -> Lavender Gradient) */}
      <div className="relative overflow-hidden rounded-2xl border border-primary-400/35 bg-gradient-to-r from-primary-600 via-primary-500 to-lavender-400 p-5 sm:p-6 text-white">
        <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur-sm">
              <Camera className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="font-display text-lg font-bold text-white">1-Click Screen Capture</h2>
                <span className="inline-flex items-center rounded-full bg-navy-950/35 border border-white/25 px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-lavender-100">
                  ACTIVE
                </span>
              </div>
              <p className="text-xs sm:text-sm text-white/90 max-w-2xl">
                Press <strong className="font-mono">Alt+S</strong> on desktop or tap Capture on your paired mobile remote to read coding prompts, SQL schemas, or architecture diagrams and generate structured answers in under a second.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Recent Sessions Table (Desktop table / Mobile cards) */}
      <section className="space-y-3" aria-labelledby="recent-sessions-heading">
        <div className="flex items-center justify-between gap-3">
          <h2 id="recent-sessions-heading" className="text-lg font-bold text-ink">
            Recent Sessions
          </h2>
          <Link
            to="/dashboard/sessions"
            className="text-xs font-semibold text-primary-500 hover:text-primary-400 inline-flex items-center gap-1"
          >
            View all
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block">
          <TableWrapper>
            <TableHead>
              <tr>
                <TableHeaderCell>Date</TableHeaderCell>
                <TableHeaderCell>Role</TableHeaderCell>
                <TableHeaderCell>Duration</TableHeaderCell>
                <TableHeaderCell className="text-right">Status</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell className="font-mono text-xs text-ink-muted tabular-nums whitespace-nowrap">
                    {session.date}
                  </TableCell>
                  <TableCell>
                    <p className="font-semibold text-ink">{session.role}</p>
                    <p className="text-xs text-ink-faint">
                      {session.company} · {session.platform}
                    </p>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-ink-muted tabular-nums">
                    {session.durationMinutes} mins
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={session.status === 'Completed' ? 'success' : 'neutral'}>
                      {session.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </TableWrapper>
        </div>

        {/* Mobile Stacked Cards */}
        <div className="space-y-3 md:hidden">
          {sessions.map((session) => (
            <Card key={session.id} padding="sm" className="space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-ink">{session.role}</p>
                  <p className="text-xs text-ink-faint">
                    {session.company} · {session.platform}
                  </p>
                </div>
                <Badge variant={session.status === 'Completed' ? 'success' : 'neutral'}>
                  {session.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-xs font-mono text-ink-muted tabular-nums border-t border-border-subtle pt-2">
                <span>{session.date}</span>
                <span>{session.durationMinutes} mins</span>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* 5. Keyboard Shortcuts Table */}
      <section className="space-y-3" aria-labelledby="shortcuts-heading">
        <div>
          <h2 id="shortcuts-heading" className="text-lg font-bold text-ink">
            Keyboard Shortcuts
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Global controls active while the Crackpilot desktop app is running.
          </p>
        </div>

        {/* Desktop Table */}
        <div className="hidden sm:block">
          <TableWrapper>
            <TableHead>
              <tr>
                <TableHeaderCell className="w-56">Shortcut</TableHeaderCell>
                <TableHeaderCell>Action &amp; Description</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {KEYBOARD_SHORTCUTS.map((sc) => (
                <TableRow key={sc.id}>
                  <TableCell className="whitespace-nowrap">
                    <KeyCap keys={sc.keys} size="sm" />
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold text-ink">{sc.label}</span>
                    <span className="text-ink-faint"> — </span>
                    <span className="text-ink-muted">{sc.description}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </TableWrapper>
        </div>

        {/* Mobile Cards */}
        <div className="grid grid-cols-1 gap-2.5 sm:hidden">
          {KEYBOARD_SHORTCUTS.map((sc) => (
            <Card key={sc.id} padding="sm" className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink">{sc.label}</span>
                <KeyCap keys={sc.keys} size="sm" />
              </div>
              <p className="text-xs leading-relaxed text-ink-muted">{sc.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* 48h Token Modal */}
      <Modal
        open={tokenModalOpen}
        onClose={() => setTokenModalOpen(false)}
        title="Your 48-hour Auth Token"
        description="Paste this token into Crackpilot on Windows, macOS, or Android to authorize up to 2 devices."
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-primary-500/35 bg-surface-subtle px-4 py-3.5">
            <code className="font-mono text-base sm:text-lg font-semibold tracking-wider text-ink break-all">
              {activeToken}
            </code>
            <Button size="sm" variant="secondary" onClick={handleCopyToken}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface-subtle px-4 py-3 text-xs">
            <span className="inline-flex items-center gap-1.5 text-ink-muted">
              <Clock className="h-4 w-4 text-primary-500" />
              Expires in
            </span>
            <span className="font-mono font-semibold text-ink tabular-nums">
              {formatCountdown(remainingSecs)}
            </span>
          </div>

          <p className="text-xs leading-relaxed text-ink-muted">
            Generating a fresh token invalidates any previous expired session. Keep this code private—anyone with it can consume your interview minutes while active.
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setTokenModalOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

import { Zap, FileText, Layers, Eye, BarChart3, Headphones } from 'lucide-react';
import { Card } from '../ui/Card';

export function BentoFeaturesSection() {
  return (
    <section id="features" className="py-20 sm:py-24 border-t border-border-subtle">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="max-w-2xl space-y-3">
          <p className="mono-label text-primary-500 dark:text-lavender-200">Core Capabilities</p>
          <h2 className="text-section font-display font-bold text-ink">
            Built for live interview speed, not generic chat prompts.
          </h2>
          <p className="text-sm sm:text-base leading-relaxed text-ink-muted">
            Every surface is tuned for fast glanceability while speaking—short bullet hierarchies, resume grounding, and instant screen context.
          </p>
        </div>

        {/* Asymmetric Bento Grid: 1 col mobile, 2 col tablet, 6 col desktop */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-6">
          {/* Card 1: Large (span 4) */}
          <Card padding="lg" className="md:col-span-2 lg:col-span-4 flex flex-col justify-between gap-6">
            <div className="space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/12 text-primary-500 dark:text-lavender-200">
                <Zap className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-bold text-ink">Real-time streaming suggestions</h3>
              <p className="text-sm leading-relaxed text-ink-muted max-w-xl">
                System loopback audio transcribes the interviewer continuously and begins streaming bullet cues in under 850ms—giving you structure before an awkward silence starts.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 border-t border-border-subtle pt-4 font-mono">
              <div>
                <p className="text-lg font-bold text-ink tabular-nums">&lt; 850ms</p>
                <p className="text-[11px] text-ink-faint">First token latency</p>
              </div>
              <div>
                <p className="text-lg font-bold text-ink tabular-nums">3–4 bullets</p>
                <p className="text-[11px] text-ink-faint">Scannable cadence</p>
              </div>
              <div>
                <p className="text-lg font-bold text-ink tabular-nums">No bot</p>
                <p className="text-[11px] text-ink-faint">Local audio capture</p>
              </div>
            </div>
          </Card>

          {/* Card 2: Medium (span 2) */}
          <Card padding="lg" className="lg:col-span-2 flex flex-col justify-between gap-5">
            <div className="space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/12 text-primary-500 dark:text-lavender-200">
                <FileText className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-bold text-ink">Resume-aware answers</h3>
              <p className="text-sm leading-relaxed text-ink-muted">
                Upload your resume and paste the JD once. Suggestions reference your real shipped projects, stack, and metrics instead of boilerplate filler.
              </p>
            </div>
            <p className="font-mono text-xs text-primary-500 dark:text-lavender-200">
              Synced from Target Profile
            </p>
          </Card>

          {/* Card 3: Medium (span 2) */}
          <Card padding="lg" className="lg:col-span-2 space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/12 text-primary-500 dark:text-lavender-200">
              <Layers className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-bold text-ink">Voice + screen context</h3>
            <p className="text-sm leading-relaxed text-ink-muted">
              Combine spoken follow-ups with 1-click screen captures (<span className="font-mono text-ink">Alt+S</span>) for live SQL, LeetCode, case charts, and system diagrams.
            </p>
          </Card>

          {/* Card 4: Medium (span 2) */}
          <Card padding="lg" className="lg:col-span-2 space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/12 text-primary-500 dark:text-lavender-200">
              <Eye className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-bold text-ink">Low-distraction display</h3>
            <p className="text-sm leading-relaxed text-ink-muted">
              Adjust opacity, enable click-through mode, nudge the window under your webcam lens, and lock reading with one hotkey.
            </p>
          </Card>

          {/* Card 5: Medium (span 2) */}
          <Card padding="lg" className="lg:col-span-2 space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/12 text-primary-500 dark:text-lavender-200">
              <BarChart3 className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-bold text-ink">Post-session insights</h3>
            <p className="text-sm leading-relaxed text-ink-muted">
              Every completed round is saved in Session History with timestamped questions, captures, and answers so you can tighten weak spots before the next panel.
            </p>
          </Card>

          {/* Card 6: Wide bottom banner card (span 6) */}
          <Card padding="lg" className="md:col-span-2 lg:col-span-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-surface-elevated/60">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-500/15 text-primary-500 dark:text-lavender-200">
                <Headphones className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-ink">Practice mode before the real call</h3>
                <p className="text-sm text-ink-muted max-w-2xl">
                  Test your microphone, system audio loopback, teleprompter scroll speed, and hotkeys in a dry-run session so nothing surprises you five minutes before the panel joins.
                </p>
              </div>
            </div>
            <span className="font-mono text-xs text-primary-500 dark:text-lavender-200 whitespace-nowrap shrink-0">
              Included on all accounts
            </span>
          </Card>
        </div>
      </div>
    </section>
  );
}

import { useState } from 'react';
import { Check } from 'lucide-react';
import { ROLE_TRACKS } from '../../data/landing';
import { Tabs } from '../ui/Tabs';
import { Card } from '../ui/Card';

export function RoleShowcaseSection() {
  const [selectedId, setSelectedId] = useState(ROLE_TRACKS[0].id);
  const track = ROLE_TRACKS.find((r) => r.id === selectedId) ?? ROLE_TRACKS[0];

  return (
    <section className="py-20 sm:py-24 border-t border-border-subtle">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl space-y-3">
            <p className="mono-label text-primary-500 dark:text-lavender-200">Built for every role</p>
            <h2 className="text-section font-display font-bold text-ink">
              Adapts to your interview loop, not a single template.
            </h2>
          </div>
          <Tabs
            options={ROLE_TRACKS.map((r) => ({ id: r.id, label: r.label }))}
            value={selectedId}
            onChange={setSelectedId}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-stretch">
          <Card padding="lg" className="lg:col-span-6 flex flex-col justify-between gap-6">
            <div className="space-y-3">
              <p className="mono-label text-ink-faint">{track.label}</p>
              <h3 className="text-xl sm:text-2xl font-bold text-ink">{track.headline}</h3>
              <p className="text-sm sm:text-base leading-relaxed text-ink-muted">{track.summary}</p>
            </div>

            <ul className="space-y-2.5 border-t border-border-subtle pt-5">
              {track.highlights.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-ink">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>

          <div className="lg:col-span-6 rounded-2xl border border-navy-800 bg-navy-950 p-6 sm:p-8 text-white flex flex-col justify-between gap-5 shadow-xl shadow-navy-950/15">
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-mono text-navy-400">
                <span>SAMPLE LIVE CUE</span>
                <span className="text-lavender-200">{track.label.toUpperCase()}</span>
              </div>

              <div className="rounded-xl border border-navy-800 bg-navy-900 p-4">
                <p className="mono-label text-[10px] text-navy-400">Question</p>
                <p className="mt-1 text-sm font-semibold text-white">{track.sampleQuestion}</p>
              </div>

              <ul className="space-y-2.5 text-sm leading-relaxed text-navy-100">
                {track.sampleCue.map((line, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-400" aria-hidden="true" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-xs font-mono text-navy-400 border-t border-navy-800 pt-3">
              Grounded in your uploaded resume &amp; Knowledge Engine
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

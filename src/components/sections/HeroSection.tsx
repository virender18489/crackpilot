import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Download, Monitor, Laptop, Smartphone, Mic, Camera, RotateCcw } from 'lucide-react';
import { Button } from '../ui/Button';
import { LIVE_DEMO_SCENARIOS } from '../../data/landing';

export function HeroSection() {
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [visibleChars, setVisibleChars] = useState(0);

  const scenario = LIVE_DEMO_SCENARIOS[scenarioIdx];
  const fullAnswerText = scenario.bullets.join('\n');

  useEffect(() => {
    setVisibleChars(0);
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion) {
      setVisibleChars(fullAnswerText.length);
      return;
    }

    const interval = window.setInterval(() => {
      setVisibleChars((prev) => {
        if (prev >= fullAnswerText.length) {
          window.clearInterval(interval);
          return prev;
        }
        return prev + 4;
      });
    }, 24);

    return () => window.clearInterval(interval);
  }, [scenarioIdx, fullAnswerText]);

  const streamedBullets = fullAnswerText.slice(0, visibleChars).split('\n').filter(Boolean);
  const isStreaming = visibleChars < fullAnswerText.length;

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative overflow-hidden hero-glow pt-12 pb-16 sm:pt-16 sm:pb-24 lg:pt-20 lg:pb-28">
      <div className="pointer-events-none absolute inset-0 bg-noise" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center lg:gap-10">
          {/* Left Copy Column */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="lg:col-span-6 space-y-6"
          >
            <p className="mono-label text-primary-500 dark:text-lavender-200">
              AI Interview Prep &amp; Live Assist · Pay-per-use credits
            </p>

            <h1 className="text-hero font-display font-extrabold tracking-tight text-ink">
              Stay sharp when the{' '}
              <span className="text-primary-500 dark:text-lavender-200">hardest question</span>{' '}
              lands live.
            </h1>

            <p className="max-w-xl text-base sm:text-lg leading-relaxed text-ink-muted">
              Crackpilot listens to interviewer audio, reads captured coding prompts, and drafts concise talking points from your own resume in under a second—on Windows, macOS, and Android.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button size="lg" onClick={() => scrollTo('book-demo')}>
                Book a Demo
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => scrollTo('download')}>
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>

            {/* Trust Row */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5 pt-3 border-t border-border-subtle text-xs sm:text-sm text-ink-muted">
              <span className="inline-flex items-center gap-2">
                <Monitor className="h-4 w-4 text-primary-500" aria-hidden="true" />
                Windows 10/11
              </span>
              <span className="inline-flex items-center gap-2">
                <Laptop className="h-4 w-4 text-primary-500" aria-hidden="true" />
                macOS
              </span>
              <span className="inline-flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary-500" aria-hidden="true" />
                Android
              </span>
              <span className="font-mono text-xs text-ink-faint">From ₹799/hr · No subscription</span>
            </div>
          </motion.div>

          {/* Right Floating Answer Window Mockup — sleek dark teleprompter overlay */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="lg:col-span-6"
          >
            <div className="rounded-2xl border border-navy-700/80 bg-navy-950 text-white shadow-2xl shadow-navy-950/25 overflow-hidden">
              {/* Mockup Window Chrome */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-navy-800 bg-navy-900 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-display text-xs font-bold text-white">
                    Crack<span className="text-lavender-200">pilot</span>
                  </span>
                  <span className="text-xs text-navy-400" aria-hidden="true">·</span>
                  <span className="font-mono text-[11px] text-lavender-200/80">{scenario.tag}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] text-lavender-200">
                    <kbd className="rounded-md border border-navy-700 bg-navy-800 px-1.5 py-0.5">Alt</kbd>
                    <span className="text-navy-400">+</span>
                    <kbd className="rounded-md border border-navy-700 bg-navy-800 px-1.5 py-0.5">S</kbd>
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] text-lavender-200">
                    <kbd className="rounded-md border border-navy-700 bg-navy-800 px-1.5 py-0.5">Alt</kbd>
                    <span className="text-navy-400">+</span>
                    <kbd className="rounded-md border border-navy-700 bg-navy-800 px-1.5 py-0.5">H</kbd>
                  </span>
                </div>
              </div>

              {/* Scenario Switcher */}
              <div className="flex flex-wrap items-center gap-1.5 border-b border-navy-800 bg-navy-950 px-4 py-2.5">
                {[
                  { idx: 0, label: 'System Perf', icon: Mic },
                  { idx: 1, label: 'STAR Story', icon: Mic },
                  { idx: 2, label: 'SQL Capture', icon: Camera },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const active = scenarioIdx === tab.idx;
                  return (
                    <button
                      key={tab.label}
                      type="button"
                      onClick={() => setScenarioIdx(tab.idx)}
                      className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                        active
                          ? 'bg-primary-500 text-white'
                          : 'bg-navy-900 text-navy-300 hover:text-white'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      {tab.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setVisibleChars(0)}
                  aria-label="Replay streaming answer"
                  className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-navy-400 hover:bg-navy-800 hover:text-white cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Live Question Block */}
              <div className="p-4 sm:p-5 space-y-4">
                <div className="rounded-xl border border-navy-800 bg-navy-900/90 px-4 py-3">
                  <p className="mono-label text-[10px] text-navy-400">Incoming question</p>
                  <p className="mt-1 text-sm font-semibold text-white leading-snug">
                    {scenario.question}
                  </p>
                </div>

                {/* Streaming Structured Answer */}
                <div className="space-y-2.5 min-h-[188px]">
                  <div className="flex items-center justify-between text-[11px] font-mono text-navy-400">
                    <span className="text-lavender-200">
                      {isStreaming ? 'STREAMING TALKING POINTS' : 'READY · 780MS'}
                    </span>
                    <span>EYE-LEVEL TELEPROMPTER</span>
                  </div>

                  <ul className="space-y-2.5 text-sm leading-relaxed text-navy-100">
                    {streamedBullets.map((line, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-400" aria-hidden="true" />
                        <span>
                          {line}
                          {isStreaming && i === streamedBullets.length - 1 && (
                            <span className="ml-0.5 inline-block h-4 w-1.5 align-middle bg-lavender-200 animate-pulse" />
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="border-t border-navy-800 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-navy-300">
                  <span>{scenario.resumeRef}</span>
                  <span className="font-mono text-[11px] tabular-nums text-navy-400">Opacity 85%</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

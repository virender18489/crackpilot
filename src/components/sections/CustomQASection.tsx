import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen } from 'lucide-react';
import { INITIAL_KNOWLEDGE } from '../../data/dashboard';
import { Button } from '../ui/Button';

export function CustomQASection() {
  return (
    <section className="py-20 sm:py-24 border-t border-border-subtle bg-surface-subtle/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5 space-y-5">
            <p className="mono-label text-primary-500 dark:text-lavender-200">Knowledge Engine</p>
            <h2 className="text-section font-display font-bold text-ink">
              Pre-load your own answers so you sound like yourself.
            </h2>
            <p className="text-sm sm:text-base leading-relaxed text-ink-muted">
              Store your sharpest STAR stories, project architecture trade-offs, and compensation framing in advance. Whenever a matching question is asked, Crackpilot surfaces your saved notes first.
            </p>
            <div className="pt-1">
              <Link to="/signup">
                <Button variant="secondary">
                  Build your Knowledge Engine
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Code-built Saved Answers Mockup */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-border-subtle bg-surface overflow-hidden">
              <div className="flex items-center justify-between border-b border-border-subtle bg-surface-subtle px-5 py-3.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <BookOpen className="h-4 w-4 text-primary-500" aria-hidden="true" />
                  Saved Q&amp;A Library
                </div>
                <span className="font-mono text-xs text-ink-faint tabular-nums">
                  {INITIAL_KNOWLEDGE.length} active entries
                </span>
              </div>

              <div className="divide-y divide-border-subtle">
                {INITIAL_KNOWLEDGE.slice(0, 3).map((item) => (
                  <div key={item.id} className="p-5 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs font-mono">
                      <span className="text-primary-500 dark:text-lavender-200">{item.category}</span>
                      <span className="text-ink-faint">Priority match</span>
                    </div>
                    <p className="text-sm font-bold text-ink">{item.question}</p>
                    <p className="text-xs sm:text-sm leading-relaxed text-ink-muted line-clamp-2">
                      {item.answer}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

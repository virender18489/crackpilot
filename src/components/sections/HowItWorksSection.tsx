import { HOW_IT_WORKS_STEPS } from '../../data/landing';

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-20 sm:py-24 border-t border-border-subtle">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="max-w-2xl space-y-3">
          <p className="mono-label text-primary-500 dark:text-lavender-200">How it works</p>
          <h2 className="text-section font-display font-bold text-ink">
            Four minutes from signup to your first live session.
          </h2>
        </div>

        <ol className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS_STEPS.map((item) => (
            <li
              key={item.step}
              className="rounded-2xl border border-border-subtle bg-surface p-6 flex flex-col justify-between gap-4"
            >
              <span className="font-mono text-2xl font-semibold text-primary-500 dark:text-lavender-200 tabular-nums">
                {item.step}.
              </span>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-ink">{item.title}</h3>
                <p className="text-sm leading-relaxed text-ink-muted">{item.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

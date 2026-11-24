import { PLATFORMS } from '../../data/landing';

export function PlatformMarquee() {
  const repeated = [...PLATFORMS, ...PLATFORMS];

  return (
    <section
      aria-label="Supported meeting platforms"
      className="border-y border-border-subtle bg-surface-subtle/70 py-7 overflow-hidden"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-4">
        <p className="mono-label text-center text-ink-faint">
          Works alongside every desktop and browser interview platform
        </p>
      </div>

      <div className="relative flex overflow-hidden">
        <div className="animate-marquee flex items-center gap-6 pr-6 w-max">
          {repeated.map((platform, idx) => (
            <div
              key={`${platform.name}-${idx}`}
              className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface px-5 py-3 shrink-0"
            >
              <span className="font-display text-base font-bold text-ink whitespace-nowrap">
                {platform.name}
              </span>
              <span className="text-xs text-ink-faint" aria-hidden="true">·</span>
              <span className="font-mono text-[11px] text-ink-muted whitespace-nowrap">
                {platform.tag}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

import { KEYBOARD_SHORTCUTS } from '../../data/shortcuts';

export function ShortcutsSection() {
  const featured = KEYBOARD_SHORTCUTS.filter((s) => s.featured);

  return (
    <section className="relative overflow-hidden bg-navy-950 text-white py-20 sm:py-24">
      <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-40" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="max-w-2xl space-y-3">
          <p className="mono-label text-lavender-200">Keyboard First</p>
          <h2 className="text-section font-display font-bold text-white">
            Every control lives under your left thumb.
          </h2>
          <p className="text-sm sm:text-base text-navy-200">
            Capture a whiteboard, lock reading, adjust opacity, or hide the teleprompter without ever touching your mouse.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((sc) => (
            <div
              key={sc.id}
              className="rounded-2xl border border-navy-800 bg-navy-900/90 p-5 sm:p-6 flex flex-col justify-between gap-4"
            >
              <span className="inline-flex flex-wrap items-center gap-1">
                {sc.keys.map((part, idx) => {
                  if (part === '/') {
                    return (
                      <span key={`${part}-${idx}`} className="px-0.5 text-xs text-navy-400">
                        /
                      </span>
                    );
                  }
                  const prev = sc.keys[idx - 1];
                  const showPlus = idx > 0 && prev !== '/' && part !== '/';
                  return (
                    <span key={`${part}-${idx}`} className="inline-flex items-center gap-1">
                      {showPlus && <span className="text-[11px] text-navy-400">+</span>}
                      <kbd className="inline-flex items-center justify-center rounded-lg border border-navy-700 bg-navy-800 px-2.5 py-1 font-mono text-xs font-medium text-lavender-100 shadow-[0_2px_0_0_#090d1c] whitespace-nowrap">
                        {part}
                      </kbd>
                    </span>
                  );
                })}
              </span>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">{sc.label}</h3>
                <p className="text-xs leading-relaxed text-navy-300">{sc.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

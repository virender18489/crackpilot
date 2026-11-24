import { QrCode, Camera, Smartphone, Vibrate } from 'lucide-react';
import { MOBILE_REMOTE_POINTS } from '../../data/landing';

const POINT_ICONS = [QrCode, Camera, Smartphone, Vibrate];

export function MobileRemoteSection() {
  return (
    <section className="relative overflow-hidden bg-navy-950 text-white py-20 sm:py-24">
      <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-45" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[38rem] -translate-x-1/2 rounded-full bg-primary-500/20 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center">
          {/* Code-Built Phone Mockup */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-[320px] rounded-[2.25rem] border border-navy-700 bg-navy-900 p-3 text-white shadow-2xl shadow-black/45">
              <div className="rounded-[1.75rem] border border-navy-800 bg-navy-950 p-4 space-y-4">
                <div className="flex items-center justify-between text-[11px] font-mono text-lavender-200/75">
                  <span>10:42</span>
                  <span className="rounded-full bg-navy-900 border border-navy-800 px-3 py-0.5 text-[10px] text-lavender-200">
                    PAIRED · LAN
                  </span>
                  <span>Wi-Fi</span>
                </div>

                <div className="flex items-center justify-between border-b border-navy-800 pb-3">
                  <div>
                    <p className="font-display text-sm font-bold text-white">
                      Crack<span className="text-lavender-200">pilot</span> Remote
                    </p>
                    <p className="text-[11px] text-navy-300">MacBook Pro · Active session</p>
                  </div>
                  <span className="font-mono text-[11px] text-emerald-400 tabular-nums">42:18</span>
                </div>

                <div className="rounded-xl border border-navy-800 bg-navy-900/90 p-3.5 space-y-2">
                  <p className="font-mono text-[10px] tracking-wider uppercase text-lavender-200/80">
                    Latest cue · Haptic alert sent
                  </p>
                  <p className="text-xs font-semibold text-white">
                    Explain idempotency keys in payment webhooks.
                  </p>
                  <ul className="space-y-1.5 text-[11px] leading-relaxed text-navy-200">
                    <li>• Store client-supplied Idempotency-Key with a unique index and 24h TTL.</li>
                    <li>• Return cached response payload on retry instead of double-charging.</li>
                  </ul>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl bg-primary-500 px-3 py-3 text-center">
                    <Camera className="h-4 w-4 text-white" />
                    <span className="text-[11px] font-semibold text-white">1-Tap Capture</span>
                  </div>
                  <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-navy-700 bg-navy-900 px-3 py-3 text-center">
                    <QrCode className="h-4 w-4 text-lavender-200" />
                    <span className="text-[11px] font-semibold text-lavender-100">Lock Reading</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4 Points */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="mono-label text-lavender-200">Mobile Remote</span>
                <span className="inline-flex items-center rounded-full border border-lavender-200/25 bg-white/8 px-2.5 py-0.5 font-mono text-[11px] text-lavender-200">
                  Zero install · Scan &amp; go
                </span>
              </div>
              <h2 className="text-section font-display font-bold text-white">
                Control captures and read cues from your phone beside the screen.
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-navy-200 max-w-2xl">
                Prefer a clean desktop monitor during screen shares? Pair your phone in three seconds over local Wi-Fi and keep every answer and capture button under your thumb.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {MOBILE_REMOTE_POINTS.map((point, idx) => {
                const Icon = POINT_ICONS[idx];
                return (
                  <div
                    key={point.id}
                    className="rounded-2xl border border-navy-800 bg-navy-900/85 p-5 space-y-2.5"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/20 text-lavender-200">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <h3 className="text-base font-bold text-white">{point.title}</h3>
                    <p className="text-sm leading-relaxed text-navy-300">{point.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

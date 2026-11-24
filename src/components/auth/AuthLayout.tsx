import React from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../ui/BrandLogo';
import { StatCard } from '../ui/StatCard';
import { ThemeToggle } from '../ui/ThemeToggle';
import { WhatsAppButton } from '../ui/WhatsAppButton';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col lg:grid lg:grid-cols-12">
      {/* Left Brand Showcase Panel — desktop left, mobile below form */}
      <aside className="order-2 lg:order-1 lg:col-span-5 xl:col-span-6 relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-900 to-navy-950 text-white px-6 py-10 sm:px-10 lg:px-14 lg:py-12 flex flex-col justify-between">
        <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-80" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 bg-noise" aria-hidden="true" />
        <div
          className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-primary-400/25 blur-3xl"
          aria-hidden="true"
        />

        {/* Desktop top brand link */}
        <div className="relative z-10 hidden lg:flex items-center justify-between">
          <Link to="/" aria-label="Back to Crackpilot home">
            <BrandLogo size="lg" inverted />
          </Link>
        </div>

        <div className="relative z-10 my-auto py-4 lg:py-12 max-w-xl">
          <span className="inline-flex items-center rounded-full border border-lavender-200/30 bg-white/10 px-3 py-1 font-mono text-[11px] font-medium tracking-widest text-lavender-200">
            LIVE AI INTERVIEW ASSIST
          </span>

          <h1 className="mt-5 font-display text-3xl sm:text-4xl xl:text-[2.85rem] font-bold leading-[1.08] tracking-tight text-white">
            Never freeze in a{' '}
            <span className="text-lavender-200">live interview again.</span>
          </h1>

          <p className="mt-4 text-sm sm:text-base leading-relaxed text-lavender-100/85 max-w-lg">
            Crackpilot listens to system audio across Zoom, Meet, and Teams, pairing your resume and saved STAR stories into concise eye-level cues in real time.
          </p>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard
              inverted
              value="< 850ms"
              label="live speech to answer"
              sublabel="Streaming structured talking points"
            />
            <StatCard
              inverted
              value="Private"
              label="eye-level teleprompter"
              sublabel="Optional mobile QR remote mode"
            />
          </div>
        </div>

        <div className="relative z-10 mt-8 lg:mt-0 flex items-center justify-between text-xs text-lavender-200/70">
          <span>Windows 10/11 · macOS · Android</span>
          <Link to="/" className="hover:text-white underline-offset-4 hover:underline">
            Back to homepage
          </Link>
        </div>
      </aside>

      {/* Right Form Panel — mobile first */}
      <main className="order-1 lg:order-2 lg:col-span-7 xl:col-span-6 flex flex-col justify-between px-5 py-6 sm:px-10 lg:px-14 lg:py-10 bg-canvas">
        <header className="flex items-center justify-between gap-4">
          <Link to="/" aria-label="Crackpilot home" className="lg:invisible">
            <BrandLogo size="md" />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="text-xs font-medium text-ink-muted hover:text-ink px-2.5 py-2 rounded-lg transition-colors whitespace-nowrap"
            >
              Home
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <div className="mx-auto w-full max-w-md py-8 sm:py-12">{children}</div>

        <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-ink-faint border-t border-border-subtle pt-4">
          <span>© {new Date().getFullYear()} Crackpilot</span>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-ink transition-colors">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-ink transition-colors">
              Terms
            </Link>
          </div>
        </footer>
      </main>

      <WhatsAppButton />
    </div>
  );
}

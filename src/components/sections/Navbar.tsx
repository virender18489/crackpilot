import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Menu, X, Monitor, Laptop, Smartphone } from 'lucide-react';
import { BrandLogo } from '../ui/BrandLogo';
import { Button } from '../ui/Button';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';

export function Navbar() {
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDownloadOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDownloadOpen(false);
        setMobileOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const jumpToSection = (sectionId: string) => {
    setMobileOpen(false);
    setDownloadOpen(false);
    if (location.pathname !== '/') {
      navigate(`/#${sectionId}`);
      return;
    }
    const target = document.getElementById(sectionId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const triggerDownload = (os: string, file: string) => {
    setDownloadOpen(false);
    setMobileOpen(false);
    toast({
      title: `Downloading Crackpilot for ${os}`,
      description: `${file} — sign in to generate your 48-hour Auth Token.`,
      variant: 'info',
    });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-canvas/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Wordmark */}
        <Link to="/" aria-label="Crackpilot home" className="shrink-0">
          <BrandLogo size="md" />
        </Link>

        {/* Zone 2: Desktop Navigation */}
        <nav aria-label="Primary navigation" className="hidden lg:flex items-center gap-6 text-sm font-medium text-ink-muted">
          <button
            type="button"
            onClick={() => jumpToSection('features')}
            className="hover:text-ink transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Features
          </button>
          <button
            type="button"
            onClick={() => jumpToSection('how-it-works')}
            className="hover:text-ink transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            How it Works
          </button>

          {/* Download Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              aria-expanded={downloadOpen}
              aria-haspopup="menu"
              onClick={() => setDownloadOpen((prev) => !prev)}
              className="inline-flex items-center gap-1 hover:text-ink transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Download
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-150 ${downloadOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {downloadOpen && (
              <div
                role="menu"
                className="absolute left-0 top-full mt-3 w-64 rounded-2xl border border-border-subtle bg-surface p-2 shadow-2xl shadow-navy-950/30"
              >
                {[
                  { os: 'Windows', sub: 'Windows 10 & 11 (64-bit)', file: 'Crackpilot-Setup-2.4.exe', icon: Monitor },
                  { os: 'macOS', sub: 'Apple Silicon & Intel', file: 'Crackpilot-2.4-Universal.dmg', icon: Laptop },
                  { os: 'Android', sub: 'Android 10+ (.apk)', file: 'Crackpilot-Mobile-2.4.apk', icon: Smartphone },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.os}
                      type="button"
                      role="menuitem"
                      onClick={() => triggerDownload(item.os, item.file)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-elevated cursor-pointer"
                    >
                      <Icon className="h-4 w-4 text-primary-500 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-ink">{item.os}</p>
                        <p className="text-xs text-ink-faint">{item.sub}</p>
                      </div>
                    </button>
                  );
                })}
                <div className="mt-1 border-t border-border-subtle pt-1">
                  <button
                    type="button"
                    onClick={() => jumpToSection('download')}
                    className="w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-primary-500 hover:bg-surface-elevated cursor-pointer"
                  >
                    View system requirements
                  </button>
                </div>
              </div>
            )}
          </div>

          <Link
            to="/pricing"
            className="hover:text-ink transition-colors whitespace-nowrap shrink-0"
          >
            Pricing
          </Link>
          <button
            type="button"
            onClick={() => jumpToSection('faq')}
            className="hover:text-ink transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            FAQ
          </button>
          <button
            type="button"
            onClick={() => jumpToSection('reviews')}
            className="hover:text-ink transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Reviews
          </button>
        </nav>

        {/* Zone 3: Theme Toggle + Login / Workspace Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          <ThemeToggle />
          <Link to={user ? '/dashboard' : '/login'} className="hidden sm:inline-flex">
            <Button size="sm" variant="primary">
              {user ? 'Dashboard' : 'Login'}
            </Button>
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-subtle text-ink-muted hover:bg-surface-elevated hover:text-ink lg:hidden cursor-pointer"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Site navigation">
          <div
            className="fixed inset-0 bg-navy-950/75 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 right-0 z-10 flex w-80 max-w-[88vw] flex-col border-l border-border-subtle bg-surface shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-border-subtle px-5">
              <BrandLogo size="sm" />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation menu"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-elevated hover:text-ink cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
              <nav className="flex flex-col gap-1">
                {[
                  { label: 'Features', id: 'features' },
                  { label: 'How it Works', id: 'how-it-works' },
                  { label: 'FAQ', id: 'faq' },
                  { label: 'Reviews', id: 'reviews' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => jumpToSection(item.id)}
                    className="flex min-h-[44px] items-center rounded-xl px-3 text-left text-base font-semibold text-ink hover:bg-surface-elevated cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
                <Link
                  to="/pricing"
                  onClick={() => setMobileOpen(false)}
                  className="flex min-h-[44px] items-center rounded-xl px-3 text-base font-semibold text-ink hover:bg-surface-elevated"
                >
                  Pricing
                </Link>
                <Link
                  to="/partner"
                  onClick={() => setMobileOpen(false)}
                  className="flex min-h-[44px] items-center rounded-xl px-3 text-base font-semibold text-ink hover:bg-surface-elevated"
                >
                  Partner Program
                </Link>
              </nav>

              <div className="space-y-2 border-t border-border-subtle pt-4">
                <p className="mono-label px-3 text-ink-faint">Download Apps</p>
                {[
                  { os: 'Windows App', file: 'Crackpilot-Setup-2.4.exe' },
                  { os: 'macOS App', file: 'Crackpilot-2.4-Universal.dmg' },
                  { os: 'Android (.apk)', file: 'Crackpilot-Mobile-2.4.apk' },
                ].map((dl) => (
                  <button
                    key={dl.os}
                    type="button"
                    onClick={() => triggerDownload(dl.os, dl.file)}
                    className="flex min-h-[44px] w-full items-center justify-between rounded-xl px-3 text-sm font-medium text-ink-muted hover:bg-surface-elevated hover:text-ink cursor-pointer"
                  >
                    <span>{dl.os}</span>
                    <span className="font-mono text-[11px] text-primary-500">Get</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-border-subtle p-5 space-y-2.5">
              <Link to={user ? '/dashboard' : '/login'} onClick={() => setMobileOpen(false)} className="block">
                <Button fullWidth>{user ? 'Open Dashboard' : 'Login'}</Button>
              </Link>
              {!user && (
                <Link to="/signup" onClick={() => setMobileOpen(false)} className="block">
                  <Button fullWidth variant="outline">
                    Create Account
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

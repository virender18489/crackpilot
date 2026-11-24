import { Link } from 'react-router-dom';
import { BrandLogo } from '../ui/BrandLogo';

export function Footer() {
  return (
    <footer className="border-t border-navy-800 bg-navy-950 text-white py-14 pb-24 sm:pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-4 space-y-3">
            <Link to="/" aria-label="Crackpilot home">
              <BrandLogo size="md" inverted />
            </Link>
            <p className="text-sm leading-relaxed text-navy-300 max-w-xs">
              AI interview preparation and live-assist workspace for Windows, macOS, and Android. Pay only for the hours you use.
            </p>
          </div>

          <div className="lg:col-span-2 space-y-3">
            <p className="mono-label text-lavender-200/70">Product</p>
            <ul className="space-y-2 text-sm text-navy-300">
              <li>
                <a href="/#features" className="hover:text-white transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="/#how-it-works" className="hover:text-white transition-colors">
                  How it Works
                </a>
              </li>
              <li>
                <a href="/#download" className="hover:text-white transition-colors">
                  Download Apps
                </a>
              </li>
              <li>
                <Link to="/pricing" className="hover:text-white transition-colors">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-3 space-y-3">
            <p className="mono-label text-lavender-200/70">Account &amp; Programs</p>
            <ul className="space-y-2 text-sm text-navy-300">
              <li>
                <Link to="/login" className="hover:text-white transition-colors">
                  Sign In
                </Link>
              </li>
              <li>
                <Link to="/signup" className="hover:text-white transition-colors">
                  Create Account
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="hover:text-white transition-colors">
                  Workspace Dashboard
                </Link>
              </li>
              <li>
                <Link to="/partner" className="hover:text-white transition-colors">
                  Agent Partner Program
                </Link>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-3 space-y-3">
            <p className="mono-label text-lavender-200/70">Legal &amp; Support</p>
            <ul className="space-y-2 text-sm text-navy-300">
              <li>
                <Link to="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <a href="/#book-demo" className="hover:text-white transition-colors">
                  Book a Demo
                </a>
              </li>
              <li>
                <span className="font-mono text-xs text-navy-400">support@crackpilot.dev</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-navy-800 pt-6 text-xs text-navy-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Crackpilot Technologies. All rights reserved.</p>
          <p className="font-mono">Windows 10/11 · macOS · Android</p>
        </div>
      </div>
    </footer>
  );
}

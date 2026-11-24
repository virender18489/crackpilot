import { useState } from 'react';
import { MessageCircle, X, Copy, Check, ExternalLink } from 'lucide-react';

export function WhatsAppButton() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const phoneRaw = import.meta.env.VITE_WHATSAPP_NUMBER || '919876543210';
  const displayPhone = '+91 98765 43210';
  const waHref = `https://wa.me/${phoneRaw}?text=${encodeURIComponent(
    'Hi Crackpilot team, I have a question about live interview setup and credits.'
  )}`;

  const copyPhone = async () => {
    try {
      await navigator.clipboard.writeText(displayPhone);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2.5 sm:bottom-5 sm:right-5">
      {open && (
        <div
          role="dialog"
          aria-label="WhatsApp Support"
          className="w-72 rounded-2xl border border-border-subtle bg-surface p-4 shadow-2xl shadow-navy-950/35"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">WhatsApp Support</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                Setup help, audio checks, or quick credit top-ups. Usually replies in 5 mins.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close WhatsApp support card"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-faint hover:bg-surface-elevated hover:text-ink cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl border border-border-subtle bg-surface-subtle px-3 py-2">
            <span className="font-mono text-xs text-ink tabular-nums">{displayPhone}</span>
            <button
              type="button"
              onClick={copyPhone}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary-500 hover:text-primary-400 cursor-pointer"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            Open WhatsApp Chat
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Chat on WhatsApp"
        aria-expanded={open}
        className="flex h-12 items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-600 px-4 text-sm font-semibold text-white shadow-lg shadow-emerald-950/30 transition-transform duration-150 hover:scale-[1.03] hover:bg-emerald-700 cursor-pointer"
      >
        <MessageCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="hidden sm:inline whitespace-nowrap">WhatsApp</span>
      </button>
    </div>
  );
}

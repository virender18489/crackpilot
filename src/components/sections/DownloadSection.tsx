import { Download, Monitor, Laptop, Smartphone, Check } from 'lucide-react';
import { DOWNLOAD_PLATFORMS } from '../../data/landing';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useToast } from '../../lib/toast';

const OS_ICONS = {
  windows: Monitor,
  macos: Laptop,
  android: Smartphone,
};

export function DownloadSection() {
  const { toast } = useToast();

  const handleDownload = (name: string, fileName: string) => {
    toast({
      title: `Starting ${name} download`,
      description: `${fileName} — connect with a 48h Auth Token from your dashboard.`,
      variant: 'info',
    });
  };

  return (
    <section id="download" className="py-20 sm:py-24 border-t border-border-subtle bg-surface-subtle/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="max-w-2xl space-y-3">
          <p className="mono-label text-primary-500 dark:text-lavender-200">Native Apps</p>
          <h2 className="text-section font-display font-bold text-ink">
            Download for Windows, macOS, and Android.
          </h2>
          <p className="text-sm sm:text-base text-ink-muted">
            Lightweight native binaries with direct system-audio capture—no browser plugins or meeting bots required.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {DOWNLOAD_PLATFORMS.map((platform) => {
            const Icon = OS_ICONS[platform.id as keyof typeof OS_ICONS];
            return (
              <Card key={platform.id} padding="lg" className="flex flex-col justify-between gap-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-500/12 text-primary-500 dark:text-lavender-200">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <span className="font-mono text-xs text-ink-faint tabular-nums">{platform.size}</span>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-ink">{platform.name}</h3>
                    <p className="mt-0.5 font-mono text-xs text-primary-500 dark:text-lavender-200">
                      {platform.badge}
                    </p>
                  </div>

                  <ul className="space-y-2 border-t border-border-subtle pt-4">
                    {platform.requirements.map((req) => (
                      <li key={req} className="flex items-start gap-2 text-xs sm:text-sm text-ink-muted">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" aria-hidden="true" />
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-3">
                  <Button
                    fullWidth
                    onClick={() => handleDownload(platform.name, platform.fileName)}
                  >
                    <Download className="h-4 w-4" />
                    Download {platform.name}
                  </Button>
                  <p className="text-xs leading-relaxed text-ink-faint">{platform.helperNote}</p>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

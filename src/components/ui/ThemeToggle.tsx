import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../lib/theme';
import { cn } from '../../lib/cn';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className, showLabel = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cn(
        'inline-flex min-h-[40px] min-w-[40px] items-center justify-center gap-2 rounded-xl border border-border-subtle bg-surface-subtle px-2.5 text-sm font-medium text-ink-muted transition-colors hover:border-border-strong hover:text-ink cursor-pointer',
        className
      )}
    >
      {isDark ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
      {showLabel && <span className="whitespace-nowrap">{isDark ? 'Light mode' : 'Dark mode'}</span>}
    </button>
  );
}

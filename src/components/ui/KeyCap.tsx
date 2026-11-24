import { cn } from '../../lib/cn';

interface KeyCapProps {
  keys: string[];
  className?: string;
  size?: 'sm' | 'md';
}

export function KeyCap({ keys, className, size = 'md' }: KeyCapProps) {
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1', className)}>
      {keys.map((part, idx) => {
        if (part === '/') {
          return (
            <span key={`${part}-${idx}`} className="px-0.5 text-xs text-ink-faint">
              /
            </span>
          );
        }
        const prev = keys[idx - 1];
        const showPlus = idx > 0 && prev !== '/' && part !== '/';
        return (
          <span key={`${part}-${idx}`} className="inline-flex items-center gap-1">
            {showPlus && <span className="text-[11px] text-ink-faint">+</span>}
            <kbd
              className={cn(
                'inline-flex items-center justify-center rounded-lg border border-border-strong bg-surface-elevated font-mono font-medium text-ink shadow-[0_2px_0_0_var(--cp-border-strong)] whitespace-nowrap',
                size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
              )}
            >
              {part}
            </kbd>
          </span>
        );
      })}
    </span>
  );
}

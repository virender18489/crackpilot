import { cn } from '../../lib/cn';

export interface TabOption {
  id: string;
  label: string;
}

interface TabsProps {
  options: TabOption[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ options, value, onChange, className }: TabsProps) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex flex-wrap items-center gap-1 rounded-xl border border-border-subtle bg-surface-subtle p-1',
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={cn(
              'min-h-[40px] rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer',
              active
                ? 'bg-primary-500 text-white shadow-sm shadow-primary-500/20'
                : 'text-ink-muted hover:text-ink hover:bg-surface-elevated'
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

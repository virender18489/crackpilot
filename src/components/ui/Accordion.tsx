import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface AccordionItem {
  id: string;
  question: string;
  answer: string;
}

interface AccordionProps {
  items: AccordionItem[];
  defaultOpenId?: string;
  className?: string;
}

export function Accordion({ items, defaultOpenId, className }: AccordionProps) {
  const [openId, setOpenId] = useState<string | null>(defaultOpenId ?? items[0]?.id ?? null);

  return (
    <div className={cn('divide-y divide-border-subtle rounded-2xl border border-border-subtle bg-surface', className)}>
      {items.map((item) => {
        const isOpen = openId === item.id;
        return (
          <div key={item.id}>
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={`acc-panel-${item.id}`}
              id={`acc-btn-${item.id}`}
              onClick={() => setOpenId(isOpen ? null : item.id)}
              className="flex min-h-[56px] w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-elevated/60 cursor-pointer sm:px-6"
            >
              <span className="text-sm sm:text-base font-semibold text-ink">{item.question}</span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-ink-muted transition-transform duration-200',
                  isOpen && 'rotate-180 text-primary-500'
                )}
                aria-hidden="true"
              />
            </button>
            <div
              id={`acc-panel-${item.id}`}
              role="region"
              aria-labelledby={`acc-btn-${item.id}`}
              hidden={!isOpen}
              className="px-5 pb-5 text-sm leading-relaxed text-ink-muted sm:px-6"
            >
              {item.answer}
            </div>
          </div>
        );
      })}
    </div>
  );
}

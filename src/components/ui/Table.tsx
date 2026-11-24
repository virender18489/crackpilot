import React from 'react';
import { cn } from '../../lib/cn';

export function TableWrapper({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('w-full overflow-x-auto rounded-2xl border border-border-subtle bg-surface', className)}>
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export function TableHead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-border-subtle bg-surface-subtle text-xs font-mono uppercase tracking-wider text-ink-faint">
      {children}
    </thead>
  );
}

export function TableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-border-subtle">{children}</tbody>;
}

export function TableRow({
  className,
  onClick,
  children,
}: {
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'transition-colors',
        onClick && 'cursor-pointer hover:bg-surface-elevated/70',
        className
      )}
    >
      {children}
    </tr>
  );
}

export function TableHeaderCell({ className, children }: { className?: string; children: React.ReactNode }) {
  return <th className={cn('px-4 py-3.5 font-medium whitespace-nowrap', className)}>{children}</th>;
}

export function TableCell({ className, children }: { className?: string; children: React.ReactNode }) {
  return <td className={cn('px-4 py-3.5 text-ink align-middle', className)}>{children}</td>;
}

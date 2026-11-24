import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/cn';

export interface SidebarNavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
}

interface SidebarProps {
  items: SidebarNavItem[];
  collapsed?: boolean;
  onNavigate?: () => void;
  footer?: React.ReactNode;
}

export function Sidebar({ items, collapsed = false, onNavigate, footer }: SidebarProps) {
  return (
    <div className="flex h-full flex-col justify-between">
      <nav aria-label="Workspace navigation" className="space-y-1 p-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                cn(
                  'flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                  collapsed && 'justify-center px-2',
                  isActive
                    ? 'bg-primary-500/15 text-primary-600 dark:bg-primary-500/18 dark:text-lavender-200 border border-primary-500/25'
                    : 'text-ink-muted hover:bg-surface-elevated hover:text-ink border border-transparent'
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>
      {footer && <div className="border-t border-border-subtle p-3">{footer}</div>}
    </div>
  );
}

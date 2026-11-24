import { useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  UserCheck,
  BookOpen,
  History,
  CreditCard,
  KeyRound,
  Settings,
  LifeBuoy,
  CalendarClock,
  Star,
  Menu,
  X,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { BrandLogo } from '../ui/BrandLogo';
import { Badge } from '../ui/Badge';
import { Sidebar, type SidebarNavItem } from '../ui/Sidebar';
import { ThemeToggle } from '../ui/ThemeToggle';
import { WhatsAppButton } from '../ui/WhatsAppButton';
import { Skeleton } from '../ui/Skeleton';
import { cn } from '../../lib/cn';

const DASHBOARD_NAV: SidebarNavItem[] = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/dashboard/profile', label: 'Target Profile', icon: UserCheck },
  { to: '/dashboard/knowledge', label: 'Knowledge Engine', icon: BookOpen },
  { to: '/dashboard/sessions', label: 'Session History', icon: History },
  { to: '/dashboard/billing', label: 'Billing & Credits', icon: CreditCard },
  { to: '/dashboard/password', label: 'Update Password', icon: KeyRound },
  { to: '/dashboard/settings', label: 'Account Settings', icon: Settings },
  { to: '/dashboard/support', label: 'Support Ticket', icon: LifeBuoy },
  { to: '/dashboard/demo', label: 'Book a Demo', icon: CalendarClock },
  { to: '/dashboard/review', label: 'Review Crackpilot', icon: Star },
];

export function DashboardLayout() {
  const { user, loading, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas p-6 sm:p-10">
        <div className="mx-auto max-w-6xl space-y-6">
          <Skeleton className="h-14 w-full" />
          <div className="grid gap-6 lg:grid-cols-12">
            <Skeleton className="hidden lg:block lg:col-span-3 h-[540px]" />
            <div className="lg:col-span-9 space-y-4">
              <Skeleton className="h-44 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }

  const handleLogout = async () => {
    await logout();
    toast({ title: 'Signed out', description: 'Your session has been closed.' });
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col">
      {/* Sticky Dashboard Top Bar */}
      <header className="sticky top-0 z-30 h-16 border-b border-border-subtle bg-surface/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open workspace navigation"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-subtle text-ink-muted hover:bg-surface-elevated hover:text-ink lg:hidden cursor-pointer shrink-0"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link to="/dashboard" className="flex items-center gap-2.5 min-w-0">
            <BrandLogo size="sm" />
            <Badge variant="primary" className="hidden xs:inline-flex sm:inline-flex">
              WORKSPACE
            </Badge>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="hidden md:inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            System Ready
          </div>

          <span
            title={user.email}
            className="hidden sm:inline-flex max-w-[190px] truncate rounded-xl border border-border-subtle bg-surface-subtle px-3 py-1.5 font-mono text-xs text-ink-muted"
          >
            {user.email}
          </span>

          <ThemeToggle />

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-border-subtle bg-surface-subtle px-3 py-2 text-xs font-semibold text-ink-muted transition-colors hover:border-rose-500/40 hover:text-rose-500 cursor-pointer whitespace-nowrap"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Log Out</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Desktop Collapsible Sidebar */}
        <aside
          className={cn(
            'hidden lg:flex flex-col shrink-0 border-r border-border-subtle bg-surface transition-[width] duration-200 sticky top-16 h-[calc(100vh-4rem)]',
            collapsed ? 'w-[76px]' : 'w-64'
          )}
        >
          <Sidebar
            items={DASHBOARD_NAV}
            collapsed={collapsed}
            footer={
              <button
                type="button"
                onClick={() => setCollapsed((prev) => !prev)}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className={cn(
                  'flex min-h-[40px] w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-elevated hover:text-ink cursor-pointer',
                  collapsed && 'justify-center px-0'
                )}
              >
                {collapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <>
                    <PanelLeftClose className="h-4 w-4 shrink-0" />
                    <span>Collapse menu</span>
                  </>
                )}
              </button>
            }
          />
        </aside>

        {/* Mobile / Tablet Slide-In Drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Workspace menu">
            <div
              className="fixed inset-0 bg-navy-950/75 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <div className="fixed inset-y-0 left-0 z-10 flex w-72 max-w-[85vw] flex-col border-r border-border-subtle bg-surface shadow-2xl">
              <div className="flex h-16 items-center justify-between border-b border-border-subtle px-4">
                <div className="flex items-center gap-2">
                  <BrandLogo size="sm" />
                  <Badge variant="primary">WORKSPACE</Badge>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation menu"
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-elevated hover:text-ink cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="border-b border-border-subtle px-4 py-3 text-xs text-ink-muted flex items-center justify-between gap-2">
                <span className="truncate font-mono">{user.email}</span>
                <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-300 shrink-0">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Ready
                </span>
              </div>
              <div className="flex-1 overflow-y-auto">
                <Sidebar items={DASHBOARD_NAV} onNavigate={() => setMobileOpen(false)} />
              </div>
            </div>
          </div>
        )}

        {/* Main Workspace Content */}
        <main className="flex-1 min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8 pb-24">
          <div className="mx-auto max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>

      <WhatsAppButton />
    </div>
  );
}

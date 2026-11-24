import { useEffect, useMemo, useState } from 'react';
import { Search, ArrowUpDown, X, ChevronLeft, ChevronRight, History } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  TableWrapper,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from '../../components/ui/Table';
import { INITIAL_SESSIONS, type InterviewSession } from '../../data/sessions';
import { usePageMeta } from '../../lib/seo';

const PAGE_SIZE = 4;

export default function SessionHistoryPage() {
  usePageMeta({
    title: 'Session History — Crackpilot',
    description: 'Review past interview sessions, filter by date or status, and inspect full question-and-answer transcripts.',
  });

  const [sessions, setSessions] = useState<InterviewSession[]>(INITIAL_SESSIONS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Completed' | 'Practice'>('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'duration'>('date');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<InterviewSession | null>(null);

  useEffect(() => {
    fetch('/api/sessions', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data?.sessions)) setSessions(data.sessions);
      })
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sessions
      .filter((s) => {
        if (statusFilter !== 'All' && s.status !== statusFilter) return false;
        if (dateFrom && s.isoDate < dateFrom) return false;
        if (dateTo && s.isoDate > dateTo) return false;
        if (
          q &&
          !s.role.toLowerCase().includes(q) &&
          !s.company.toLowerCase().includes(q) &&
          !s.platform.toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const cmp =
          sortBy === 'date'
            ? a.isoDate.localeCompare(b.isoDate)
            : a.durationMinutes - b.durationMinutes;
        return sortDir === 'desc' ? -cmp : cmp;
      });
  }, [sessions, search, statusFilter, dateFrom, dateTo, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const toggleSort = (col: 'date' | 'duration') => {
    if (sortBy === col) {
      setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink">Session History</h1>
        <p className="text-sm text-ink-muted">
          Click any session to inspect captured prompts, questions, and generated answers.
        </p>
      </div>

      {/* Filters */}
      <Card padding="sm" className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="relative md:col-span-5">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search role, company, platform..."
              aria-label="Search sessions"
              className="min-h-[44px] w-full rounded-xl border border-border-subtle bg-surface-subtle pl-10 pr-3.5 text-sm text-ink placeholder:text-ink-faint focus:border-primary-500 focus:outline-none"
            />
          </div>
          <div className="md:col-span-2">
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'All' | 'Completed' | 'Practice');
                setPage(1);
              }}
              className="min-h-[44px] w-full rounded-xl border border-border-subtle bg-surface-subtle px-3 text-sm text-ink focus:border-primary-500 focus:outline-none"
            >
              <option value="All">All statuses</option>
              <option value="Completed">Completed</option>
              <option value="Practice">Practice</option>
            </select>
          </div>
          <div className="md:col-span-5 grid grid-cols-2 gap-2">
            <input
              type="date"
              aria-label="From date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="min-h-[44px] w-full rounded-xl border border-border-subtle bg-surface-subtle px-3 text-xs font-mono text-ink focus:border-primary-500 focus:outline-none"
            />
            <input
              type="date"
              aria-label="To date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="min-h-[44px] w-full rounded-xl border border-border-subtle bg-surface-subtle px-3 text-xs font-mono text-ink focus:border-primary-500 focus:outline-none"
            />
          </div>
        </div>
      </Card>

      {/* Results */}
      {pageItems.length === 0 ? (
        <EmptyState
          icon={<History className="h-6 w-6" />}
          title="No sessions match your filter"
          description="Adjust the date range or search terms to view your recorded sessions."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setSearch('');
                setStatusFilter('All');
                setDateFrom('');
                setDateTo('');
              }}
            >
              Reset filters
            </Button>
          }
        />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <TableWrapper>
              <TableHead>
                <tr>
                  <TableHeaderCell>
                    <button
                      type="button"
                      onClick={() => toggleSort('date')}
                      className="inline-flex items-center gap-1 hover:text-ink cursor-pointer"
                    >
                      Date
                      <ArrowUpDown className="h-3.5 w-3.5" />
                    </button>
                  </TableHeaderCell>
                  <TableHeaderCell>Role &amp; Company</TableHeaderCell>
                  <TableHeaderCell>Platform</TableHeaderCell>
                  <TableHeaderCell>
                    <button
                      type="button"
                      onClick={() => toggleSort('duration')}
                      className="inline-flex items-center gap-1 hover:text-ink cursor-pointer"
                    >
                      Duration
                      <ArrowUpDown className="h-3.5 w-3.5" />
                    </button>
                  </TableHeaderCell>
                  <TableHeaderCell>Captures</TableHeaderCell>
                  <TableHeaderCell className="text-right">Status</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {pageItems.map((session) => (
                  <TableRow key={session.id} onClick={() => setSelected(session)}>
                    <TableCell className="font-mono text-xs text-ink-muted tabular-nums whitespace-nowrap">
                      {session.date}
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold text-ink">{session.role}</p>
                      <p className="text-xs text-ink-faint">{session.company}</p>
                    </TableCell>
                    <TableCell className="text-xs text-ink-muted">{session.platform}</TableCell>
                    <TableCell className="font-mono text-xs text-ink-muted tabular-nums">
                      {session.durationMinutes} mins
                    </TableCell>
                    <TableCell className="font-mono text-xs text-ink-muted tabular-nums">
                      {session.capturesUsed}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={session.status === 'Completed' ? 'success' : 'neutral'}>
                        {session.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </TableWrapper>
          </div>

          {/* Mobile Cards */}
          <div className="space-y-3 md:hidden">
            {pageItems.map((session) => (
              <Card
                key={session.id}
                padding="sm"
                interactive
                onClick={() => setSelected(session)}
                className="cursor-pointer space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-ink">{session.role}</p>
                    <p className="text-xs text-ink-faint">
                      {session.company} · {session.platform}
                    </p>
                  </div>
                  <Badge variant={session.status === 'Completed' ? 'success' : 'neutral'}>
                    {session.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between border-t border-border-subtle pt-2 font-mono text-xs text-ink-muted tabular-nums">
                  <span>{session.date}</span>
                  <span>
                    {session.durationMinutes}m · {session.capturesUsed} captures
                  </span>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between gap-4 pt-1">
            <p className="text-xs font-mono text-ink-faint tabular-nums">
              Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of{' '}
              {filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Session Transcript Slide-Over Drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Session transcript">
          <div
            className="fixed inset-0 bg-navy-950/70 backdrop-blur-sm"
            onClick={() => setSelected(null)}
            aria-hidden="true"
          />
          <div className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-border-subtle bg-surface shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-6 py-5">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-ink">{selected.role}</h2>
                  <Badge variant={selected.status === 'Completed' ? 'success' : 'neutral'}>
                    {selected.status}
                  </Badge>
                </div>
                <p className="text-xs text-ink-muted font-mono">
                  {selected.company} · {selected.platform} · {selected.date} · {selected.durationMinutes} mins
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close session drawer"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-elevated hover:text-ink cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div className="rounded-xl border border-border-subtle bg-surface-subtle p-4">
                <p className="mono-label text-ink-faint">Session summary</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{selected.summary}</p>
              </div>

              <div className="space-y-4">
                <p className="mono-label text-ink-faint">Transcript &amp; Live Answers</p>
                {selected.transcript.map((item, idx) => (
                  <div
                    key={`${selected.id}-qa-${idx}`}
                    className="rounded-xl border border-border-subtle bg-surface-subtle/60 p-4 space-y-2.5"
                  >
                    <div className="flex items-center justify-between text-xs font-mono text-ink-faint">
                      <span>{item.timestamp}</span>
                      <span className="uppercase">{item.source}</span>
                    </div>
                    <p className="text-sm font-semibold text-ink">{item.question}</p>
                    <p className="text-sm leading-relaxed text-ink-muted border-t border-border-subtle pt-2.5">
                      {item.answer}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

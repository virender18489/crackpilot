export interface SessionQA {
  timestamp: string;
  question: string;
  answer: string;
  source: 'voice' | 'screen' | 'knowledge';
}

export interface InterviewSession {
  id: string;
  date: string;
  isoDate: string;
  role: string;
  company: string;
  platform: 'Zoom' | 'Google Meet' | 'Microsoft Teams' | 'Webex';
  durationMinutes: number;
  capturesUsed: number;
  status: 'Completed' | 'Practice' | 'Paused';
  summary: string;
  transcript: SessionQA[];
}

export const INITIAL_SESSIONS: InterviewSession[] = [
  {
    id: 'ses-1042',
    date: 'Nov 18, 2026',
    isoDate: '2026-11-18',
    role: 'Senior Frontend Engineer',
    company: 'Linearity Cloud',
    platform: 'Google Meet',
    durationMinutes: 48,
    capturesUsed: 4,
    status: 'Completed',
    summary: 'React rendering optimization, design system architecture, and live state-machine coding round.',
    transcript: [
      {
        timestamp: '04:12',
        question: 'How would you prevent unnecessary re-renders in a 10,000-row editable data grid?',
        answer: 'Start with row virtualization (TanStack Virtual) so only ~30 rows mount at once. Keep edit state localized to the active cell or store rows in a normalized atom map so editing one cell notifies only its subscriber. Memoize column definitions and avoid inline object allocations in row renderers.',
        source: 'voice',
      },
      {
        timestamp: '19:45',
        question: 'Screen capture: Implement a debounced async search hook that ignores stale responses.',
        answer: 'Track an AbortController or monotonically increasing requestId ref inside useEffect. Clear the debounce timer on cleanup, abort the in-flight request when the query changes, and commit setState only if the response matches the latest requestId.',
        source: 'screen',
      },
      {
        timestamp: '36:10',
        question: 'Tell me about a time you pushed back on a product scope decision.',
        answer: 'Matched from Knowledge Engine: At FinStack, Q3 analytics redesign risked delaying checkout performance fixes. Proposed a 2-week phased release that shipped core latency wins first (p95 dropped 410ms) and landed the full dashboard one sprint later.',
        source: 'knowledge',
      },
    ],
  },
  {
    id: 'ses-1039',
    date: 'Nov 14, 2026',
    isoDate: '2026-11-14',
    role: 'Senior Frontend Engineer',
    company: 'Veridian Pay',
    platform: 'Zoom',
    durationMinutes: 62,
    capturesUsed: 6,
    status: 'Completed',
    summary: 'System design round covering collaborative document editing and offline sync queues.',
    transcript: [
      {
        timestamp: '08:20',
        question: 'Compare CRDTs vs Operational Transformation for browser-based collaborative tables.',
        answer: 'OT relies on a central server to sequence and transform concurrent operations, keeping payload sizes smaller. CRDTs allow peer-to-peer or offline-first convergence without central coordination (e.g., Yjs LWW-Map per cell), trading slightly higher metadata overhead for simpler reconnect logic.',
        source: 'voice',
      },
      {
        timestamp: '31:05',
        question: 'Screen capture: Diagram an IndexedDB outbox queue with exponential backoff.',
        answer: 'Persist mutations in an IndexedDB store tagged with clientMutationId and createdAt. A single background flusher drains in FIFO order, applies idempotency headers, and backs off with jitter (2^n * 500ms capped at 30s) on 5xx or offline events.',
        source: 'screen',
      },
    ],
  },
  {
    id: 'ses-1034',
    date: 'Nov 09, 2026',
    isoDate: '2026-11-09',
    role: 'Staff UI Architect',
    company: 'Kiteworks AI',
    platform: 'Microsoft Teams',
    durationMinutes: 35,
    capturesUsed: 2,
    status: 'Completed',
    summary: 'Hiring manager behavioral round focused on cross-team migrations and accessibility standards.',
    transcript: [
      {
        timestamp: '06:50',
        question: 'How do you enforce WCAG AA compliance across 40+ engineers without slowing shipping?',
        answer: 'Bake contrast tokens and focus-ring primitives directly into the shared component library, add axe-core assertions to Storybook CI for PR checks, and run quarterly keyboard-only audits on top revenue flows.',
        source: 'voice',
      },
    ],
  },
  {
    id: 'ses-1028',
    date: 'Nov 03, 2026',
    isoDate: '2026-11-03',
    role: 'Senior Frontend Engineer',
    company: 'Mock Practice Drill',
    platform: 'Google Meet',
    durationMinutes: 25,
    capturesUsed: 3,
    status: 'Practice',
    summary: 'Timed practice run on TypeScript generics and browser event loop scheduling.',
    transcript: [
      {
        timestamp: '02:40',
        question: 'Explain microtasks vs macrotasks when scheduling DOM updates.',
        answer: 'Promise callbacks and queueMicrotask drain completely after the current call stack before the browser paints. setTimeout and MessageChannel run in subsequent task turns, letting layout and paint occur between chunks.',
        source: 'voice',
      },
    ],
  },
  {
    id: 'ses-1021',
    date: 'Oct 27, 2026',
    isoDate: '2026-10-27',
    role: 'Frontend Tech Lead',
    company: 'Northstar Logistics',
    platform: 'Webex',
    durationMinutes: 55,
    capturesUsed: 5,
    status: 'Completed',
    summary: 'Deep dive into micro-frontend module federation, bundle budgets, and observability.',
    transcript: [
      {
        timestamp: '14:15',
        question: 'When would you advise against micro-frontends?',
        answer: 'Avoid them when a single org of under 25 frontend engineers shares one release cadence. Shared dependency drift, duplicated runtime bytes, and cross-boundary routing bugs usually outweigh independent deploy gains at small scale.',
        source: 'voice',
      },
    ],
  },
  {
    id: 'ses-1015',
    date: 'Oct 19, 2026',
    isoDate: '2026-10-19',
    role: 'Senior Frontend Engineer',
    company: 'Arcadia Health',
    platform: 'Zoom',
    durationMinutes: 44,
    capturesUsed: 1,
    status: 'Completed',
    summary: 'Architecture review of HIPAA-safe client caching and multi-step patient intake forms.',
    transcript: [
      {
        timestamp: '11:30',
        question: 'How do you handle sensitive form drafts in the browser?',
        answer: 'Avoid localStorage for PHI. Keep draft state in memory or encrypt transient drafts with a session-scoped WebCrypto key cleared immediately on logout or idle timeout.',
        source: 'voice',
      },
    ],
  },
];

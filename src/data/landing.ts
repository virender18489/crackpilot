export const PLATFORMS = [
  { name: 'Zoom', tag: 'Desktop & Web' },
  { name: 'Google Meet', tag: 'Chrome & Edge' },
  { name: 'Microsoft Teams', tag: 'Work & Personal' },
  { name: 'Webex', tag: 'Enterprise Audio' },
  { name: 'GoToMeeting', tag: 'System Loopback' },
  { name: 'Discord', tag: 'Voice Channels' },
];

export const MOBILE_REMOTE_POINTS = [
  {
    id: 'qr-pairing',
    title: 'Instant QR pairing',
    description: 'Scan the code displayed in your desktop app on the same Wi-Fi. No cable, no Bluetooth fuss, zero extra phone install required.',
  },
  {
    id: 'one-tap-capture',
    title: '1-tap screen capture',
    description: 'Trigger a clean desktop capture straight from your phone thumb while your hands stay natural on the keyboard.',
  },
  {
    id: 'dual-device',
    title: 'Dual-device mode',
    description: 'Read structured bullet points on a propped phone beside your monitor while your primary screen stays completely clear.',
  },
  {
    id: 'haptic-cues',
    title: 'Silent haptic cues',
    description: 'Feel a subtle vibration when a fresh answer finishes streaming so you only glance down at the exact right moment.',
  },
];

export const HOW_IT_WORKS_STEPS = [
  {
    step: '01',
    title: 'Load your resume & role',
    description: 'Add your target title, core stack, job description, and custom Q&A stories in the web workspace.',
  },
  {
    step: '02',
    title: 'Connect with a 48h token',
    description: 'Download the Windows, macOS, or Android app and paste your generated Auth Token to link up to two devices.',
  },
  {
    step: '03',
    title: 'Run live or pair mobile',
    description: 'Join your interview on Zoom, Meet, or Teams. Crackpilot listens to system audio and drafts concise, resume-grounded talking points.',
  },
  {
    step: '04',
    title: 'Review session notes',
    description: 'After the call, inspect the full Q&A transcript, tighten weak answers in your Knowledge Engine, and keep unused minutes for the next round.',
  },
];

export interface RoleTrack {
  id: string;
  label: string;
  headline: string;
  summary: string;
  highlights: string[];
  sampleQuestion: string;
  sampleCue: string[];
}

export const ROLE_TRACKS: RoleTrack[] = [
  {
    id: 'software',
    label: 'Software Engineering',
    headline: 'Algorithms, system design, and code walkthroughs without blanking out.',
    summary: 'Capture coding prompts or architecture diagrams with Alt+S and receive complexity trade-offs, edge cases, and clean mental models.',
    highlights: [
      'Time & space complexity checks on captured prompts',
      'Distributed systems trade-off checklists (CAP, queues, caching)',
      'Debugging and PR review talking points tied to your stack',
    ],
    sampleQuestion: 'How would you rate-limit an API gateway across multiple regions?',
    sampleCue: [
      'Use sliding-window counters in regional Redis clusters to keep p99 check latency under 5ms.',
      'Replicate quota buckets asynchronously with soft burst buffers; fail open or local-cap on partition.',
      'Key limits by API key + route tier and return Retry-After headers.',
    ],
  },
  {
    id: 'product',
    label: 'Product Management',
    headline: 'Sharp product sense, metrics trees, and prioritization under pressure.',
    summary: 'Structure ambiguous case prompts into clear user segments, north-star metrics, and trade-offs grounded in your past launches.',
    highlights: [
      'Instant metric-drop root cause checklists',
      'STAR stories mapped to roadmap & stakeholder questions',
      'Pricing, GTM, and experiment-design guardrails',
    ],
    sampleQuestion: 'Checkout conversion dropped 6% overnight on mobile web. Walk me through your investigation.',
    sampleCue: [
      'Segment first: isolate iOS vs Android, browser version, geography, and payment provider.',
      'Check recent deploys, third-party PSP error rates, and funnel step drop-off (cart vs OTP).',
      'Confirm logging integrity before rolling back or opening an incident bridge.',
    ],
  },
  {
    id: 'sales',
    label: 'Sales & Solutions',
    headline: 'Objection handling, discovery prompts, and competitor battlecards live.',
    summary: 'Keep discovery frameworks, ROI math, and security answers pre-loaded in your Knowledge Engine for executive roleplays and panels.',
    highlights: [
      'MEDDPICC and discovery follow-up cues',
      'Instant objection reframes for budget and security reviews',
      'Custom product specs retrieved from saved Q&A',
    ],
    sampleQuestion: 'We already built an internal script for this—why should we pay for a vendor?',
    sampleCue: [
      'Acknowledge the team’s engineering investment and ask what ongoing maintenance costs each quarter.',
      'Contrast core roadmap focus vs maintaining edge-case integrations and compliance audits.',
      'Propose a 30-day pilot measuring hours saved for their ops engineers.',
    ],
  },
  {
    id: 'students',
    label: 'Students & Freshers',
    headline: 'Structured confidence for campus placements and first internships.',
    summary: 'Rehearse core CS fundamentals, project deep-dives, and HR rounds in Practice Mode—and pay only for the exact interview hours you book.',
    highlights: [
      'Project architecture cues drawn straight from your resume',
      'Concise OOP, DBMS, OS, and networking refreshers',
      'Pay-per-use hours that carry over across placement season',
    ],
    sampleQuestion: 'Explain the database schema decisions in your capstone project.',
    sampleCue: [
      'Reference your PostgreSQL schema: normalized users/orders for ACID integrity, indexed foreign keys.',
      'Explain why you added Redis caching for leaderboard reads (cut query time from 180ms to 12ms).',
      'Mention one trade-off you would revisit at 10x traffic.',
    ],
  },
];

export const DOWNLOAD_PLATFORMS = [
  {
    id: 'windows',
    name: 'Windows App',
    badge: 'Windows 10 & 11',
    fileName: 'Crackpilot-Setup-2.4.exe',
    size: '64 MB',
    requirements: ['Windows 10 (1903+) or Windows 11 64-bit', 'WASAPI native system audio capture', '4 GB RAM, 150 MB disk space'],
    helperNote: 'Running Windows 7/8 or older hardware? Grab the Lightweight Helper (.exe) in your dashboard.',
  },
  {
    id: 'macos',
    name: 'macOS App',
    badge: 'Apple Silicon & Intel',
    fileName: 'Crackpilot-2.4-Universal.dmg',
    size: '58 MB',
    requirements: ['macOS 13 Ventura or later', 'Universal binary (M1/M2/M3/M4 & Intel)', 'Built-in ScreenCaptureKit audio'],
    helperNote: 'Signed and notarized DMG with guided audio permission setup in under 60 seconds.',
  },
  {
    id: 'android',
    name: 'Android App',
    badge: 'Android 10+ (.apk)',
    fileName: 'Crackpilot-Mobile-2.4.apk',
    size: '22 MB',
    requirements: ['Android 10 or newer', 'Pairs via QR code or runs standalone', 'Silent haptic alerts & thumb capture'],
    helperNote: 'Prefer zero install on iOS or Android? Open the local QR URL directly in your mobile browser.',
  },
];

export const LIVE_DEMO_SCENARIOS = [
  {
    id: 'react-perf',
    tag: 'Technical · Voice detected',
    question: '“Our dashboard lags when 500 WebSocket events arrive per second. How would you stabilize the UI?”',
    bullets: [
      'Batch incoming frames in a mutable ref queue and flush to React state once per animation frame (16ms) or 100ms throttle window.',
      'Move heavy aggregation or sorting into a Web Worker so the main thread stays free for input and paint.',
      'Virtualize the feed container and subscribe individual rows by ID so unchanged rows skip reconciliation.',
    ],
    resumeRef: 'Matched from your resume: FinStack live ticker optimization (-68% main-thread blocking).',
  },
  {
    id: 'behavioral-conflict',
    tag: 'Behavioral · Knowledge Engine',
    question: '“Tell me about a time you shipped under a tight deadline and had to make a tough trade-off.”',
    bullets: [
      'Situation: Enterprise SSO launch had a fixed 3-week customer contract deadline across web and auth API.',
      'Action: Cut custom role-builder UI from v1, shipped SAML + preset roles first, and automated smoke tests for token refresh.',
      'Result: Launched 2 days early with zero Sev-1 incidents; added custom roles in Sprint +1.',
    ],
    resumeRef: 'Pulled from saved Q&A #2: Phased launch trade-off story.',
  },
  {
    id: 'screen-sql',
    tag: 'Screen capture · Alt+S',
    question: 'Captured prompt: Optimize SELECT * FROM orders WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 50',
    bullets: [
      'Replace SELECT * with explicit projected columns to enable index-only scans where possible.',
      'Create a composite B-tree index on (tenant_id, created_at DESC) to eliminate filesort on large tenants.',
      'Switch deep pagination from OFFSET to keyset cursor (created_at, id) < (?, ?).',
    ],
    resumeRef: 'Capture #1 of 80 · Response streamed in 740ms.',
  },
];

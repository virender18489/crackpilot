import { useState } from "react";
import {
  ArrowRight,
  Calendar,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  Eye,
  FileText,
  Headphones,
  Laptop,
  Layers,
  MessageCircle,
  Mic,
  Monitor,
  QrCode,
  RefreshCw,
  Send,
  Smartphone,
  Sparkles,
  Sun,
  Users,
  Vibrate,
  Zap,
  BarChart3,
} from "lucide-react";
import {
  WINDOWS_EXE_FILENAME,
  WINDOWS_EXE_URL,
  type DownloadPlatform,
} from "../data/crackpilotPackages";

interface LandingPageProps {
  isLoggedIn: boolean;
  onGoLogin: () => void;
  onGoDashboard: () => void;
  onOpenTestingLab: () => void;
  onOpenSoftware: () => void;
}

const HERO_TABS = [
  {
    id: "perf",
    label: "System Perf",
    icon: Mic,
    tag: "Technical · Voice detected",
    question:
      "“Our dashboard lags when 500 WebSocket events arrive per second. How would you stabilize the UI?”",
    latency: "ready in 780ms",
    bullets: [
      "Batch incoming frames in a mutable ref queue and flush to React state once per animation frame (16ms) or 100ms throttle window.",
      "Move heavy aggregation or sorting into a Web Worker so the main thread stays free for input and paint.",
      "Virtualize the feed container and subscribe individual rows by ID so unchanged rows skip reconciliation.",
    ],
    resumeNote:
      "Matched from your resume: FinStack live ticker optimization (-68% main-thread blocking).",
  },
  {
    id: "star",
    label: "STAR Story",
    icon: Mic,
    tag: "Behavioral · Voice detected",
    question:
      "“Tell me about a time a production launch went sideways and how you led the recovery.”",
    latency: "ready in 640ms",
    bullets: [
      "Situation: Checkout latency spiked 4x after a schema migration during peak Friday traffic.",
      "Action: Rolled back read-heavy queries to the replica cache within 6 minutes and shipped a batched index patch.",
      "Result: Restored p95 latency to 140ms with zero lost orders and introduced automated migration canary checks.",
    ],
    resumeNote:
      "Matched from your Knowledge Engine: Q3 Checkout Incident STAR note.",
  },
  {
    id: "sql",
    label: "SQL Capture",
    icon: Camera,
    tag: "Screen Capture · Alt+S",
    question:
      "“Find the top 3 departments by rolling 30-day revenue growth excluding refunded orders.”",
    latency: "ready in 820ms",
    bullets: [
      "Filter status != 'refunded' inside a CTE before aggregating daily totals per department_id.",
      "Use SUM(amount) OVER (PARTITION BY department_id ORDER BY dt RANGE BETWEEN INTERVAL '29 days' PRECEDING AND CURRENT ROW).",
      "Rank with DENSE_RANK() on growth percentage and filter rn <= 3; index (status, department_id, created_at).",
    ],
    resumeNote:
      "Captured from active coding prompt · Complexity: O(N log N) with composite index.",
  },
];

const PLATFORMS = [
  { badge: "W", color: "bg-emerald-600", name: "Webex", sub: "Enterprise Audio" },
  { badge: "G", color: "bg-orange-500", name: "GoToMeeting", sub: "System Loopback" },
  { badge: "D", color: "bg-indigo-500", name: "Discord", sub: "Voice Channels" },
  { badge: "Z", color: "bg-sky-500", name: "Zoom", sub: "Desktop & Web" },
  { badge: "M", color: "bg-teal-500", name: "Google Meet", sub: "Browser Tab" },
  { badge: "T", color: "bg-violet-600", name: "Microsoft Teams", sub: "System Audio" },
];

const TESTIMONIALS = [
  {
    metric: "Cleared 4 onsite loops in 3 weeks",
    quote:
      "“System design rounds used to throw me off whenever the interviewer pivoted mid-whiteboard. Having my own architecture notes surface as short bullets at eye level kept my delivery calm and structured.”",
    name: "Rohan Kulkarni",
    role: "Senior Frontend Engineer · FinTech Series C · Bengaluru",
  },
  {
    metric: "Landed 32% compensation lift",
    quote:
      "“I loaded twelve STAR stories into the Knowledge Engine before my final panel. When the VP asked about a pricing rollback I led two years ago, my exact metrics appeared in under a second.”",
    name: "Meera Nair",
    role: "Group Product Manager · B2B SaaS · Mumbai",
  },
  {
    metric: "Closed offer after 2nd final round",
    quote:
      "“The mobile QR remote is what sold me. I paired my phone on home Wi-Fi, tapped capture during a live discovery roleplay, and stayed completely focused on the panel without fumbling tabs.”",
    name: "Daniel Park",
    role: "Account Executive · Enterprise Security · Austin",
  },
  {
    metric: "Cracked staff system design panel",
    quote:
      "“Alt+S captured the multi-region architecture prompt cleanly and surfaced CAP trade-offs plus Redis rate-limit math in two seconds—zero awkward silence.”",
    name: "Ananya Verma",
    role: "Staff Backend Engineer · Cloud Infra · Hyderabad",
  },
];

const ROLE_TABS = [
  {
    id: "swe",
    label: "Software Engineering",
    eyebrow: "Software Engineering",
    title: "Algorithms, system design, and code walkthroughs without blanking out.",
    desc: "Capture coding prompts or architecture diagrams with Alt+S and receive complexity trade-offs, edge cases, and clean mental models.",
    checks: [
      "Time & space complexity checks on captured prompts",
      "Distributed systems trade-off checklists (CAP, queues, caching)",
      "Debugging and PR review talking points tied to your stack",
    ],
    sampleTag: "SOFTWARE ENGINEERING",
    sampleQ: "How would you rate-limit an API gateway across multiple regions?",
    sampleBullets: [
      "Use sliding-window counters in regional Redis clusters to keep p99 check latency under 5ms.",
      "Replicate quota buckets asynchronously with soft burst buffers; fail open or local-cap on partition.",
      "Key limits by API key + route tier and return Retry-After headers.",
    ],
  },
  {
    id: "pm",
    label: "Product Management",
    eyebrow: "Product Management",
    title: "Structured product sense, metrics trees, and prioritization under pressure.",
    desc: "Keep your north-star frameworks, funnel diagnostics, and past launch trade-offs right at eye level during case interviews.",
    checks: [
      "Root-cause metric drop checklists segmented by geo, platform, and cohort",
      "Clear user-segment → pain point → MVP → guardrail structure",
      "Pre-loaded launch impact numbers pulled straight from your resume",
    ],
    sampleTag: "PRODUCT MANAGEMENT",
    sampleQ: "Checkout conversion dropped 14% overnight on Android. Walk me through your investigation.",
    sampleBullets: [
      "Verify telemetry integrity first, then slice by app version, payment rail, and OS build.",
      "Compare funnel drop-off between cart, address, and UPI/card authorization steps.",
      "Correlate with recent experiments or SDK releases and define immediate rollback criteria.",
    ],
  },
  {
    id: "sales",
    label: "Sales & Solutions",
    eyebrow: "Sales & Solutions",
    title: "Handle technical objections and discovery pivots smoothly in real time.",
    desc: "Surface competitive differentiators, security answers, and ROI case metrics during mock discovery calls and executive roleplays.",
    checks: [
      "MEDDPICC & discovery follow-up cues matched to buyer personas",
      "Instant security, SOC2, and deployment architecture responses",
      "Customer proof points and quota attainment stories from your notes",
    ],
    sampleTag: "SALES & SOLUTIONS",
    sampleQ: "Why should we switch from our incumbent vendor if migration takes two quarters?",
    sampleBullets: [
      "Anchor on cost of inaction: quantify manual engineering hours lost each sprint.",
      "Propose a 14-day parallel pilot on one non-critical workflow to de-risk cutover.",
      "Share our FinTech migration case that reached positive ROI inside 9 weeks.",
    ],
  },
  {
    id: "freshers",
    label: "Students & Freshers",
    eyebrow: "Students & Freshers",
    title: "Turn academic projects and DSA fundamentals into confident spoken answers.",
    desc: "Structure internship stories, core CS fundamentals, and project deep-dives clearly without freezing during campus or off-campus loops.",
    checks: [
      "Clear brute-force → optimized approach explanation templates",
      "OS, DBMS, CN, and OOP quick-recall bullet hierarchies",
      "Project architecture walkthroughs grounded in your GitHub & resume",
    ],
    sampleTag: "STUDENTS & FRESHERS",
    sampleQ: "Explain the difference between a process and a thread, and when threads can hurt performance.",
    sampleBullets: [
      "Processes have isolated virtual memory; threads share heap/code within a process with separate stacks.",
      "Excessive threads cause context-switching overhead, cache thrashing, and lock contention.",
      "Use thread pools or async event loops for I/O-heavy workloads like Node.js servers.",
    ],
  },
];

const SHORTCUT_CARDS = [
  {
    keys: ["Alt", "S"],
    title: "Screen capture",
    desc: "Capture active coding prompt, whiteboard, or slide for instant structured guidance.",
  },
  {
    keys: ["Alt", "V"],
    title: "Video scan",
    desc: "Scan shared screen frames continuously during live code walkthroughs.",
  },
  {
    keys: ["Alt", "X"],
    title: "Instant answer",
    desc: "Trigger an immediate response from the latest spoken interviewer question.",
  },
  {
    keys: ["Alt", "H"],
    title: "Hide / show window",
    desc: "Toggle the teleprompter window visibility instantly without breaking focus.",
  },
  {
    keys: ["Alt", "U"],
    title: "Toggle layer",
    desc: "Switch between compact bullet-cue mode and full detailed answer layout.",
  },
  {
    keys: ["Alt", "J"],
    title: "Lock reading",
    desc: "Pause incoming updates so you can finish reading the current talking points.",
  },
  {
    keys: ["Alt", "T"],
    title: "Teleprompter auto-scroll",
    desc: "Start or pause smooth eye-level pacing for multi-paragraph walkthroughs.",
  },
  {
    keys: ["Alt", "Up", "/", "Alt", "Down"],
    title: "Window opacity",
    desc: "Adjust window translucency in 10% increments to match your lighting.",
  },
];

const FAQ_ITEMS = [
  {
    q: "How does pay-per-use credit billing work?",
    a: "You buy interview hours up front starting at ₹799 per hour (or $10/hr). Time is deducted only while an active live-assist session is running—pause or close the app and your remaining minutes stay in your account with no expiration date and no recurring subscription.",
  },
  {
    q: "Which video calling platforms does Crackpilot work with?",
    a: "Crackpilot works alongside Google Meet, Zoom, Microsoft Teams, Webex, GoToMeeting, Discord, and WhatsApp calls because it captures system/tab audio locally—no meeting bots ever join your call.",
  },
  {
    q: "How does the Mobile Remote QR pairing work?",
    a: "After entering your Auth Token in the desktop app, scan the displayed local QR code with your phone on the same Wi-Fi to view streaming bullets and trigger captures directly from your phone.",
  },
  {
    q: "Does Crackpilot tailor answers to my resume and target role?",
    a: "Yes. Upload your Resume and Job Description once in Dashboard → Target Profile. Every spoken question, screen capture, and video scan is automatically grounded in your actual projects, metrics, and target role.",
  },
  {
    q: "Can I pre-load my own behavioral stories and custom Q&A?",
    a: "Yes. Save your STAR stories, system trade-offs, and compensation notes in your workspace so Crackpilot surfaces your exact experiences when related questions come up.",
  },
  {
    q: "How fast are live speech-to-answer suggestions?",
    a: "First-token streaming typically starts in under 850ms so you receive a clean opener and 3–4 bullet points before an awkward silence begins.",
  },
  {
    q: "What devices and OS versions are supported?",
    a: "Windows 10 (1903+) and Windows 11 64-bit, macOS 13 Ventura or later (Apple Silicon & Intel), plus Chrome/Edge desktop companion extension and mobile browser remote.",
  },
  {
    q: "Can I test Crackpilot before an important interview?",
    a: "Yes! Practice Mode / Testing Lab is included so you can verify cross-tab always-on-top floating, headphone/WhatsApp/Meet audio capture levels, and every keyboard shortcut before your real round.",
  },
  {
    q: "How many devices can I link to my account?",
    a: "Each generated Auth Token supports linking up to two devices simultaneously, and you can regenerate or revoke tokens anytime from Dashboard → Overview.",
  },
  {
    q: "How is my resume and transcript data handled?",
    a: "Your resume, JD, and active session settings are used exclusively to personalize your interview answers during your session and are never shared publicly.",
  },
];

function computePricing(hours: number, currency: "INR" | "USD") {
  // Progressive volume discount from 0% at 1 hr up to ~68.7% at 40 hrs (21% off at 3 hrs -> ₹1,894)
  const baseUnit = currency === "INR" ? 799 : 10;
  let discountPct = 0;
  if (hours === 1) discountPct = 0;
  else if (hours === 2) discountPct = 12;
  else if (hours === 3) discountPct = 21;
  else if (hours <= 5) discountPct = 28;
  else if (hours <= 10) discountPct = 40;
  else if (hours <= 20) discountPct = 52;
  else if (hours <= 30) discountPct = 60;
  else discountPct = 68.7;

  const original = Math.round(hours * baseUnit);
  const total = Math.round(original * (1 - discountPct / 100));
  const perHour = Math.round(total / hours);
  return { original, total, perHour, discountPct: Math.round(discountPct) };
}

export function LandingPage({
  isLoggedIn,
  onGoLogin,
  onGoDashboard,
  onOpenTestingLab,
  onOpenSoftware,
}: LandingPageProps) {
  const [heroTab, setHeroTab] = useState(0);
  const [roleTab, setRoleTab] = useState(0);
  const [testimonialOffset, setTestimonialOffset] = useState(0);
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");
  const [hours, setHours] = useState(3);
  const [openFaq, setOpenFaq] = useState<number>(0);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);

  // Demo form state
  const [demoName, setDemoName] = useState("");
  const [demoEmail, setDemoEmail] = useState("");
  const [demoPhone, setDemoPhone] = useState("");
  const [demoRole, setDemoRole] = useState("");
  const [demoDate, setDemoDate] = useState("");
  const [demoPlatform, setDemoPlatform] = useState("Google Meet");
  const [demoNotes, setDemoNotes] = useState("");
  const [demoSubmitted, setDemoSubmitted] = useState(false);

  const activeHero = HERO_TABS[heroTab];
  const activeRole = ROLE_TABS[roleTab];
  const price = computePricing(hours, currency);
  const sym = currency === "INR" ? "₹" : "$";

  const visibleTestimonials = [0, 1, 2].map(
    (idx) => TESTIMONIALS[(testimonialOffset + idx) % TESTIMONIALS.length]
  );

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDemoSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#050709] text-white selection:bg-[#c6f527] selection:text-black">
      {/* Top Navbar (exact match to final-1) */}
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#050709]/92 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5">
          {/* Brand */}
          <a
            href="#top"
            className="flex items-center gap-2.5 text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-[5px] bg-[#c6f527] text-xs font-extrabold text-[#050709]">
              C
            </span>
            <span className="tracking-tight">crackpilot</span>
          </a>

          {/* Center Links */}
          <nav className="hidden md:flex items-center gap-6 text-[13px] font-medium text-zinc-300">
            <a href="#features" className="hover:text-white transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-white transition-colors">
              How it Works
            </a>

            <div className="relative">
              <button
                type="button"
                onClick={() => setDownloadMenuOpen((v) => !v)}
                className="inline-flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
              >
                <span>Download</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {downloadMenuOpen && (
                <div className="absolute left-0 top-9 w-56 rounded-xl border border-white/10 bg-[#0d1117] p-1.5 shadow-2xl">
                  <a
                    href={WINDOWS_EXE_URL}
                    download={WINDOWS_EXE_FILENAME}
                    rel="noopener noreferrer"
                    onClick={() => setDownloadMenuOpen(false)}
                    className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs text-zinc-200 hover:bg-white/[0.06] cursor-pointer"
                  >
                    <span>Download for Windows (.exe)</span>
                    <Download className="h-3.5 w-3.5 text-[#c6f527]" />
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setDownloadMenuOpen(false);
                      onOpenSoftware();
                    }}
                    className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs text-[#c6f527] hover:bg-white/[0.06] cursor-pointer"
                  >
                    <span>Open Live Software Overlay</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            <a href="#pricing" className="hover:text-white transition-colors">
              Pricing
            </a>
            <a href="#faq" className="hover:text-white transition-colors">
              FAQ
            </a>
            <a href="#reviews" className="hover:text-white transition-colors">
              Reviews
            </a>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onOpenTestingLab}
              title="Practice Mode / Testing Lab"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#0d1117] text-zinc-300 hover:text-white hover:border-white/25 transition-colors cursor-pointer"
            >
              <Sun className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={isLoggedIn ? onGoDashboard : onGoLogin}
              className="rounded-full bg-[#c6f527] px-5 py-1.5 text-[13px] font-semibold text-[#050709] hover:bg-[#b5e41c] transition-colors cursor-pointer"
            >
              {isLoggedIn ? "Dashboard" : "Login"}
            </button>
          </div>
        </div>
      </header>

      {/* SECTION 1: HERO (final-1 dark) */}
      <section id="top" className="mx-auto max-w-6xl px-5 pt-16 pb-20 lg:pt-24 lg:pb-24">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          {/* Left copy */}
          <div className="lg:col-span-6 space-y-6">
            <h1 className="text-[40px] sm:text-[50px] lg:text-[56px] font-extrabold leading-[1.04] tracking-[-0.03em] text-white">
              The hardest interview question, answered before you finish nodding.
            </h1>

            <p className="max-w-lg text-[15px] leading-relaxed text-zinc-400">
              Crackpilot listens to interviewer audio, reads captured coding
              prompts, and drafts concise talking points from your own resume in
              under a second—on Windows, macOS, and Android.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <a
                href="#demo"
                className="inline-flex items-center gap-2 rounded-full bg-[#c6f527] px-6 py-3 text-sm font-semibold text-[#050709] hover:bg-[#b5e41c] transition-colors"
              >
                <span>Book a Demo</span>
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href={WINDOWS_EXE_URL}
                download={WINDOWS_EXE_FILENAME}
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#0c1015] px-5 py-3 text-sm font-medium text-zinc-100 hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <Download className="h-4 w-4 text-zinc-300" />
                <span>Download for Windows (.exe)</span>
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 text-xs text-zinc-400">
              <span className="inline-flex items-center gap-1.5 text-zinc-200">
                <Monitor className="h-3.5 w-3.5 text-[#c6f527]" />
                Windows 10/11
              </span>
              <span className="inline-flex items-center gap-1.5 text-zinc-200">
                <Laptop className="h-3.5 w-3.5 text-[#c6f527]" />
                macOS
              </span>
              <span className="inline-flex items-center gap-1.5 text-zinc-200">
                <Smartphone className="h-3.5 w-3.5 text-[#c6f527]" />
                Android
              </span>
              <span className="font-mono text-[11px] text-zinc-400">
                ₹799 per hour, no subscription
              </span>
            </div>
          </div>

          {/* Right interactive live HUD preview */}
          <div className="lg:col-span-6">
            <div className="rounded-2xl border border-white/10 bg-[#0b0f14] p-4 shadow-2xl space-y-3.5">
              {/* Top strip */}
              <div className="flex items-center justify-between gap-2 text-[11px] border-b border-white/[0.07] pb-3">
                <div className="flex items-center gap-1.5 font-mono text-zinc-400">
                  <span className="font-semibold text-white">Crackpilot</span>
                  <span>/</span>
                  <span>{activeHero.tag}</span>
                </div>
                <div className="flex items-center gap-1 font-mono text-[10px] text-zinc-300">
                  <kbd className="rounded border border-white/15 bg-white/[0.04] px-1.5 py-0.5">
                    Alt
                  </kbd>
                  <span>+</span>
                  <kbd className="rounded border border-white/15 bg-white/[0.04] px-1.5 py-0.5">
                    S
                  </kbd>
                  <kbd className="ml-1 rounded border border-white/15 bg-white/[0.04] px-1.5 py-0.5">
                    Alt
                  </kbd>
                  <span>+</span>
                  <kbd className="rounded border border-white/15 bg-white/[0.04] px-1.5 py-0.5">
                    H
                  </kbd>
                </div>
              </div>

              {/* Tab Switcher */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {HERO_TABS.map((t, idx) => {
                    const Icon = t.icon;
                    const active = heroTab === idx;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setHeroTab(idx)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                          active
                            ? "bg-[#c6f527] text-[#050709]"
                            : "border border-white/10 bg-[#11161d] text-zinc-300 hover:text-white"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setHeroTab((i) => (i + 1) % HERO_TABS.length)}
                  title="Cycle sample"
                  className="rounded-md p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-white cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Incoming question box */}
              <div className="rounded-xl border border-white/[0.08] bg-[#11161d] p-4 space-y-1.5">
                <p className="text-[11px] font-medium text-zinc-400">
                  Incoming question
                </p>
                <p className="text-sm font-semibold leading-snug text-white">
                  {activeHero.question}
                </p>
              </div>

              {/* Ready latency line */}
              <div className="flex items-center justify-between font-mono text-[11px] px-1">
                <span className="text-[#c6f527]">{activeHero.latency}</span>
                <span className="text-zinc-500">eye-level teleprompter</span>
              </div>

              {/* Bullet talking points */}
              <ul className="space-y-2.5 px-1 text-[13px] leading-relaxed text-zinc-200">
                {activeHero.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2.5">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#c6f527] shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              {/* Footer line */}
              <div className="border-t border-white/[0.07] pt-3 px-1 space-y-0.5 font-mono text-[10px] text-zinc-500">
                <p>{activeHero.resumeNote}</p>
                <p>opacity 85%</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Strip (final-1) */}
      <section className="border-y border-white/[0.07] bg-[#070a0e] py-8">
        <div className="mx-auto max-w-6xl px-5 space-y-5">
          <p className="text-center text-xs font-medium text-zinc-400">
            Works alongside every desktop and browser interview platform
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {PLATFORMS.map((p) => (
              <div
                key={p.name}
                className="inline-flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-[#0c1015] px-4 py-2.5 text-xs"
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded ${p.color} text-[10px] font-bold text-white`}
                >
                  {p.badge}
                </span>
                <span className="font-semibold text-white">{p.name}</span>
                <span className="text-zinc-600">·</span>
                <span className="font-mono text-[11px] text-zinc-400">
                  {p.sub}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 2: MOBILE QR REMOTE (final-1 dark with right olive-lime glow) */}
      <section
        className="relative overflow-hidden py-24"
        style={{
          background:
            "radial-gradient(ellipse 65% 85% at 88% 50%, rgba(132, 184, 24, 0.28), rgba(5, 7, 9, 1) 70%)",
        }}
      >
        <div className="mx-auto max-w-6xl px-5 grid gap-12 lg:grid-cols-12 lg:items-center">
          {/* Left Phone Mockup */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-[270px] rounded-[34px] border-2 border-white/15 bg-[#090d12] p-4 shadow-2xl space-y-4">
              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 px-1">
                <span>10:42</span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-zinc-300">
                  paired on LAN
                </span>
                <span>Wi-Fi</span>
              </div>

              <div className="flex items-center justify-between px-1">
                <div>
                  <p className="text-xs font-bold text-white">
                    Crackpilot Remote
                  </p>
                  <p className="text-[10px] text-zinc-400">
                    MacBook Pro · Active session
                  </p>
                </div>
                <span className="font-mono text-[11px] text-emerald-400">
                  42:18
                </span>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#11161e] p-3.5 space-y-2">
                <p className="font-mono text-[10px] text-[#c6f527]">
                  Latest cue: haptic alert sent
                </p>
                <p className="text-xs font-semibold text-white leading-snug">
                  Explain idempotency keys in payment webhooks.
                </p>
                <ul className="space-y-1.5 text-[11px] leading-relaxed text-zinc-300">
                  <li>
                    • Store client-supplied Idempotency-Key with a unique index
                    and 24h TTL.
                  </li>
                  <li>
                    • Return cached response payload on retry instead of
                    double-charging.
                  </li>
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={onOpenSoftware}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl bg-[#c6f527] py-3 text-[11px] font-semibold text-[#050709] cursor-pointer"
                >
                  <Camera className="h-4 w-4" />
                  <span>1-Tap Capture</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenSoftware}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-[#121820] py-3 text-[11px] font-medium text-zinc-200 cursor-pointer"
                >
                  <QrCode className="h-4 w-4" />
                  <span>Lock Reading</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Copy + 2x2 Cards */}
          <div className="lg:col-span-7 space-y-6">
            <span className="inline-block rounded-md border border-[#c6f527]/35 bg-[#c6f527]/10 px-2.5 py-1 font-mono text-[11px] text-[#c6f527]">
              No install, just scan the QR
            </span>

            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-[1.1]">
              Control captures and read cues from your phone beside the screen.
            </h2>

            <p className="max-w-xl text-sm leading-relaxed text-zinc-300">
              Prefer a clean desktop monitor during screen shares? Pair your
              phone in three seconds over local Wi-Fi and keep every answer and
              capture button under your thumb.
            </p>

            <div className="grid gap-4 sm:grid-cols-2 pt-2">
              {[
                {
                  icon: QrCode,
                  title: "Instant QR pairing",
                  desc: "Scan the code displayed in your desktop app on the same Wi-Fi. No cable, no Bluetooth fuss, zero extra phone install required.",
                },
                {
                  icon: Camera,
                  title: "1-tap screen capture",
                  desc: "Trigger a clean desktop capture straight from your phone thumb while your hands stay natural on the keyboard.",
                },
                {
                  icon: Smartphone,
                  title: "Dual-device mode",
                  desc: "Read structured bullet points on a propped phone beside your monitor while your primary screen stays completely clear.",
                },
                {
                  icon: Vibrate,
                  title: "Silent haptic cues",
                  desc: "Feel a subtle vibration when a fresh answer finishes streaming so you only glance down at the exact right moment.",
                },
              ].map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.title}
                    className="rounded-xl border border-white/[0.08] bg-[#0b1015]/90 p-5 space-y-2.5"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#131a21] text-[#c6f527]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <h3 className="text-sm font-bold text-white">
                      {card.title}
                    </h3>
                    <p className="text-xs leading-relaxed text-zinc-400">
                      {card.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: FEATURES GRID (final-1 + top of final-2, light #f4f5ef) */}
      <section id="features" className="bg-[#f4f5ef] text-[#0c100d] py-20">
        <div className="mx-auto max-w-6xl px-5 space-y-10">
          <div className="max-w-2xl space-y-2.5">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-[1.1]">
              Built for live interview speed, not generic chat prompts.
            </h2>
            <p className="text-sm text-[#545a4f] leading-relaxed">
              Every surface is tuned for fast glanceability while speaking—short
              bullet hierarchies, resume grounding, and instant screen context.
            </p>
          </div>

          {/* Row 1: 8 + 4 */}
          <div className="grid gap-5 lg:grid-cols-12">
            <div className="lg:col-span-8 rounded-2xl border border-[#e2e5da] bg-[#fbfcf8] p-6 flex flex-col justify-between gap-8">
              <div className="space-y-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#edf4d3] text-[#55710e]">
                  <Zap className="h-4 w-4" />
                </span>
                <h3 className="text-lg font-bold">
                  Real-time streaming suggestions
                </h3>
                <p className="max-w-lg text-sm leading-relaxed text-[#545a4f]">
                  System loopback audio transcribes the interviewer continuously
                  and begins streaming bullet cues in under 850ms—giving you
                  structure before an awkward silence starts.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4 border-t border-[#e8ebe0] pt-4">
                <div>
                  <p className="font-mono text-sm font-bold">&lt; 850ms</p>
                  <p className="text-[11px] text-[#6d7367]">
                    First token latency
                  </p>
                </div>
                <div>
                  <p className="font-mono text-sm font-bold">3–4 bullets</p>
                  <p className="text-[11px] text-[#6d7367]">
                    Scannable cadence
                  </p>
                </div>
                <div>
                  <p className="font-mono text-sm font-bold">No bot</p>
                  <p className="text-[11px] text-[#6d7367]">
                    Local audio capture
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 rounded-2xl border border-[#e2e5da] bg-[#fbfcf8] p-6 flex flex-col justify-between gap-6">
              <div className="space-y-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#edf4d3] text-[#55710e]">
                  <FileText className="h-4 w-4" />
                </span>
                <h3 className="text-lg font-bold">Resume-aware answers</h3>
                <p className="text-sm leading-relaxed text-[#545a4f]">
                  Upload your resume and paste the JD once. Suggestions
                  reference your real shipped projects, stack, and metrics
                  instead of boilerplate filler.
                </p>
              </div>
              <p className="font-mono text-[11px] font-medium text-[#5c7811]">
                Synced from Target Profile
              </p>
            </div>
          </div>

          {/* Row 2: 3 equal cards */}
          <div className="grid gap-5 md:grid-cols-3">
            {[
              {
                icon: Layers,
                title: "Voice + screen context",
                desc: "Combine spoken follow-ups with 1-click screen captures (Alt+S) for live SQL, LeetCode, case charts, and system diagrams.",
              },
              {
                icon: Eye,
                title: "Low-distraction display",
                desc: "Adjust opacity, enable click-through mode, nudge the window under your webcam lens, and lock reading with one hotkey.",
              },
              {
                icon: BarChart3,
                title: "Post-session insights",
                desc: "Every completed round is saved in Session History with timestamped questions, captures, and answers so you can tighten weak spots before the next panel.",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-2xl border border-[#e2e5da] bg-[#fbfcf8] p-6 space-y-3"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#edf4d3] text-[#55710e]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <h3 className="text-base font-bold">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-[#545a4f]">
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Bottom Practice Mode strip */}
          <div
            onClick={onOpenTestingLab}
            className="rounded-2xl border border-[#e2e5da] bg-[#f8f9f3] p-5 flex flex-wrap items-center justify-between gap-4 hover:border-[#b9cf7c] transition-colors cursor-pointer"
          >
            <div className="flex items-start gap-3.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#edf4d3] text-[#55710e] shrink-0">
                <Headphones className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold">
                  Practice mode before the real call
                </h3>
                <p className="text-xs text-[#545a4f] mt-0.5">
                  Test your microphone, system audio loopback, teleprompter
                  scroll speed, and hotkeys in a dry-run session so nothing
                  surprises you five minutes before the panel joins.
                </p>
              </div>
            </div>
            <span className="font-mono text-[11px] font-medium text-[#5c7811] whitespace-nowrap">
              Included on all accounts
            </span>
          </div>
        </div>
      </section>

      {/* SECTION 4: WORKSPACE SHOWCASE (final-2, dark) */}
      <section className="bg-[#050709] py-20">
        <div className="mx-auto max-w-6xl px-5 space-y-10">
          <div className="max-w-xl space-y-2">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-[1.1]">
              One workspace for prep, live sessions and review.
            </h2>
            <p className="text-sm text-zinc-400">
              Set up your profile once, run the interview from the desktop app,
              then come back here to see exactly what was asked.
            </p>
          </div>

          {/* Large macOS Workspace Dashboard Preview */}
          <div
            onClick={isLoggedIn ? onGoDashboard : onGoLogin}
            className="rounded-2xl border border-white/10 bg-[#0b0e13] overflow-hidden shadow-2xl cursor-pointer group hover:border-[#c6f527]/40 transition-colors"
          >
            {/* Window dots */}
            <div className="flex items-center gap-1.5 border-b border-white/[0.06] bg-[#080b0f] px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
            </div>

            <div className="grid lg:grid-cols-12">
              {/* Mock Sidebar */}
              <div className="hidden lg:flex lg:col-span-3 flex-col justify-between border-r border-white/[0.06] bg-[#090c10] p-4 text-xs">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-[#c6f527] text-[10px] font-extrabold text-black">
                      C
                    </span>
                    <span className="font-bold text-white">crackpilot</span>
                    <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9px] text-zinc-400">
                      WORKSPACE
                    </span>
                  </div>
                  <div className="space-y-1">
                    {[
                      "Overview",
                      "Target Profile",
                      "Knowledge Engine",
                      "Session History",
                      "Billing & Credits",
                      "Update Password",
                      "Account Settings",
                      "Support Ticket",
                      "Book a Demo",
                    ].map((item, i) => (
                      <div
                        key={item}
                        className={`rounded-lg px-2.5 py-1.5 text-[11px] ${
                          i === 0
                            ? "bg-[#1a2211] text-[#c6f527] font-semibold"
                            : "text-zinc-400"
                        }`}
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
                <span className="text-[10px] text-zinc-500">Collapse menu</span>
              </div>

              {/* Mock Main Panel */}
              <div className="lg:col-span-9 p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Workspace Overview
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      Quick glance at your active settings and recent sessions.
                    </p>
                  </div>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-400">
                    System Ready
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/[0.08] bg-[#10141b] p-4 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-400">Active Profile</span>
                      <span className="rounded bg-white/[0.06] px-2 py-0.5 text-[#c6f527]">
                        Configure ↗
                      </span>
                    </div>
                    <p className="text-sm font-bold text-white">
                      Senior Frontend Engineer
                    </p>
                    <p className="text-[11px] text-zinc-400">
                      5–8 years (Senior) · Product-led SaaS (Series B–D)
                    </p>
                    <p className="pt-1 font-mono text-[10px] text-zinc-500">
                      Resume: Candidate_Resume_2026.pdf
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/[0.08] bg-[#10141b] p-4 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-400">Session Credits</span>
                      <span className="font-mono text-[10px] text-[#c6f527]">
                        PRO PLAN
                      </span>
                    </div>
                    <p className="text-2xl font-extrabold text-white">
                      240 mins left
                    </p>
                    <p className="text-[11px] text-zinc-400">
                      Screen captures &amp; written prompts: 0 / 80 used
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.08] bg-[#10141b] p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-white">
                        Crackpilot Auth Token{" "}
                        <span className="font-normal text-zinc-500 ml-1">
                          Max 2 devices
                        </span>
                      </p>
                      <p className="text-[11px] text-zinc-400">
                        Generate a secure token (valid for 48 hours) to connect
                        your app.
                      </p>
                    </div>
                    <span className="rounded-full bg-[#c6f527] px-3.5 py-1.5 text-[11px] font-bold text-black group-hover:scale-105 transition-transform">
                      Generate 48h Token
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-zinc-300">
                    <div className="rounded-lg border border-white/10 bg-[#0a0d12] py-2 text-center">
                      Windows App
                    </div>
                    <div className="rounded-lg border border-white/10 bg-[#0a0d12] py-2 text-center">
                      Mac OS
                    </div>
                    <div className="rounded-lg border border-white/10 bg-[#0a0d12] py-2 text-center">
                      Android (.apk)
                    </div>
                    <div className="rounded-lg border border-white/10 bg-[#0a0d12] py-2 text-center">
                      Lightweight Helper (.exe)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2 Sub-previews below */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-[#0c1015] p-5 space-y-3">
                <div className="flex items-center justify-between text-xs border-b border-white/[0.06] pb-2.5">
                  <span className="font-semibold text-white">
                    Session History
                  </span>
                  <span className="font-mono text-[10px] text-zinc-500">
                    4 rounds saved
                  </span>
                </div>
                {[
                  {
                    role: "Senior Frontend Engineer",
                    meta: "Google Meet · 48 mins · 4 captures",
                  },
                  {
                    role: "Staff UI Architect",
                    meta: "Microsoft Teams · 35 mins · 2 captures",
                  },
                  {
                    role: "Lead Frontend Engineer",
                    meta: "Zoom · 62 mins · 6 captures",
                  },
                ].map((s) => (
                  <div
                    key={s.role}
                    className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-[#11161d] px-3 py-2 text-[11px]"
                  >
                    <div>
                      <p className="font-semibold text-zinc-100">{s.role}</p>
                      <p className="text-[10px] text-zinc-500">{s.meta}</p>
                    </div>
                    <span className="font-mono text-[10px] text-emerald-400">
                      Completed
                    </span>
                  </div>
                ))}
              </div>
              <h3 className="text-sm font-bold text-white">Every round, saved</h3>
              <p className="text-xs text-zinc-400">
                Questions, captures and answers from each interview, searchable
                by company, platform and date.
              </p>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-[#0c1015] p-5 space-y-3">
                <div className="flex items-center justify-between text-xs border-b border-white/[0.06] pb-2.5">
                  <span className="font-semibold text-white">
                    Knowledge Engine
                  </span>
                  <span className="rounded bg-[#c6f527] px-2 py-0.5 text-[10px] font-bold text-black">
                    + Add Q&amp;A
                  </span>
                </div>
                {[
                  {
                    cat: "General",
                    q: "Tell me about yourself and your recent impact.",
                  },
                  {
                    cat: "Behavioral",
                    q: "Describe a conflict with product or design and how you resolved it.",
                  },
                  {
                    cat: "Technical",
                    q: "How do you diagnose a React production memory leak?",
                  },
                ].map((k) => (
                  <div
                    key={k.q}
                    className="rounded-lg border border-white/[0.06] bg-[#11161d] px-3 py-2 space-y-0.5 text-[11px]"
                  >
                    <p className="font-mono text-[10px] text-[#c6f527]">
                      {k.cat}
                    </p>
                    <p className="font-semibold text-zinc-100">{k.q}</p>
                  </div>
                ))}
              </div>
              <h3 className="text-sm font-bold text-white">
                Your stories, ready to use
              </h3>
              <p className="text-xs text-zinc-400">
                Keep your resume, STAR stories and project notes in one place so
                every answer sounds like you.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: KNOWLEDGE ENGINE CALLOUT (bottom of final-2, light #f4f5ef) */}
      <section className="bg-[#f4f5ef] text-[#0c100d] py-20">
        <div className="mx-auto max-w-6xl px-5 grid gap-10 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5 space-y-5">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-[1.08]">
              Pre-load your own answers so you sound like yourself.
            </h2>
            <p className="text-sm leading-relaxed text-[#545a4f]">
              Store your sharpest STAR stories, project architecture trade-offs,
              and compensation framing in advance. Whenever a matching question
              is asked, Crackpilot surfaces your saved notes first.
            </p>
            <button
              type="button"
              onClick={isLoggedIn ? onGoDashboard : onGoLogin}
              className="inline-flex items-center gap-2 rounded-full bg-[#dff394] px-5 py-2.5 text-xs font-bold text-[#141e06] hover:bg-[#c6f527] transition-colors cursor-pointer"
            >
              <span>Build your Knowledge Engine</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-[#dfe3d6] bg-[#fbfcf8] overflow-hidden shadow-sm">
              <div className="flex items-center justify-between border-b border-[#e8ebe0] bg-[#f2f4ec] px-5 py-3 text-xs">
                <span className="font-semibold text-[#181f14]">
                  Saved Q&amp;A Library
                </span>
                <span className="font-mono text-[11px] text-[#6d7367]">
                  4 active entries
                </span>
              </div>
              <div className="divide-y divide-[#ecefe5]">
                {[
                  {
                    tag: "General",
                    q: "Tell me about yourself and your recent impact.",
                    a: "Lead with 6 years building data-heavy React & TypeScript apps. Highlight cutting checkout p95 latency by 410ms at FinStack, leading a 4-engineer design system migration across 18 product...",
                  },
                  {
                    tag: "Behavioral",
                    q: "Describe a conflict with product or design and how you resolved it.",
                    a: "During Q3 analytics launch, scope threatened our sprint stability window. Built a 1-day interactive prototype showing a phased rollout, aligned PM and Design on shipping core table virtualization...",
                  },
                  {
                    tag: "Technical",
                    q: "How do you diagnose a React production memory leak?",
                    a: "Capture two Chrome DevTools Heap Snapshots before and after repeating the user flow, filter by Detached DOM nodes and closure retainers, check uncleaned WebSocket/ResizeObserver...",
                  },
                ].map((entry) => (
                  <div key={entry.q} className="p-5 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="font-semibold text-[#5c7811]">
                        {entry.tag}
                      </span>
                      <span className="text-[#7c8276]">Priority match</span>
                    </div>
                    <p className="text-sm font-bold text-[#0c100d]">
                      {entry.q}
                    </p>
                    <p className="text-xs leading-relaxed text-[#545a4f]">
                      {entry.a}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6: 4 STEPS (top of final-3, dark) */}
      <section id="how-it-works" className="bg-[#050709] py-20">
        <div className="mx-auto max-w-6xl px-5 space-y-10">
          <h2 className="max-w-lg text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-[1.1]">
            Four minutes from signup to your first live session.
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                num: "01.",
                title: "Load your resume & role",
                desc: "Add your target title, core stack, job description, and custom Q&A stories in the web workspace.",
              },
              {
                num: "02.",
                title: "Connect with a 48h token",
                desc: "Download the Windows, macOS, or Android app and paste your generated Auth Token to link up to two devices.",
              },
              {
                num: "03.",
                title: "Run live or pair mobile",
                desc: "Join your interview on Zoom, Meet, or Teams. Crackpilot listens to system audio and drafts concise, resume-grounded talking points.",
              },
              {
                num: "04.",
                title: "Review session notes",
                desc: "After the call, inspect the full Q&A transcript, tighten weak answers in your Knowledge Engine, and keep unused minutes for the next round.",
              },
            ].map((s) => (
              <div
                key={s.num}
                className="rounded-xl border border-white/[0.08] bg-[#0c1015] p-5 space-y-3"
              >
                <span className="font-mono text-sm font-bold text-[#c6f527]">
                  {s.num}
                </span>
                <h3 className="text-sm font-bold text-white">{s.title}</h3>
                <p className="text-xs leading-relaxed text-zinc-400">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 7: TESTIMONIALS (final-3, light #f4f5ef) */}
      <section id="reviews" className="bg-[#f4f5ef] text-[#0c100d] py-20">
        <div className="mx-auto max-w-6xl px-5 space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="max-w-xl text-3xl sm:text-4xl font-extrabold tracking-tight leading-[1.1]">
              Used across technical panels, product cases, and final loops.
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setTestimonialOffset(
                    (o) => (o - 1 + TESTIMONIALS.length) % TESTIMONIALS.length
                  )
                }
                aria-label="Previous testimonial"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#d6dacd] bg-white text-[#1c2218] hover:bg-[#eef1e6] cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setTestimonialOffset((o) => (o + 1) % TESTIMONIALS.length)
                }
                aria-label="Next testimonial"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#d6dacd] bg-white text-[#1c2218] hover:bg-[#eef1e6] cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {visibleTestimonials.map((t) => (
              <div
                key={t.name}
                className="rounded-2xl border border-[#e2e5da] bg-[#fbfcf8] p-6 flex flex-col justify-between gap-6"
              >
                <div className="space-y-3">
                  <p className="font-mono text-[11px] font-medium text-[#5c7811]">
                    {t.metric}
                  </p>
                  <p className="text-sm leading-relaxed text-[#252b21]">
                    {t.quote}
                  </p>
                </div>
                <div className="border-t border-[#ecefe5] pt-3.5">
                  <p className="text-xs font-bold text-[#0c100d]">{t.name}</p>
                  <p className="text-[11px] text-[#6d7367] mt-0.5">{t.role}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-1.5">
            {TESTIMONIALS.map((t, idx) => (
              <button
                key={t.name}
                type="button"
                onClick={() => setTestimonialOffset(idx)}
                aria-label={`Slide ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  testimonialOffset === idx
                    ? "w-6 bg-[#98ca14]"
                    : "w-1.5 bg-[#c9cec0]"
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 8: ROLE ADAPTATION TABS (final-3, dark) */}
      <section className="bg-[#050709] py-20">
        <div className="mx-auto max-w-6xl px-5 space-y-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <h2 className="max-w-md text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-[1.1]">
              Adapts to your interview loop, not a single template.
            </h2>

            <div className="rounded-xl border border-white/[0.08] bg-[#0c1015] p-1.5 flex flex-wrap gap-1.5 max-w-md">
              {ROLE_TABS.map((rt, idx) => (
                <button
                  key={rt.id}
                  type="button"
                  onClick={() => setRoleTab(idx)}
                  className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                    roleTab === idx
                      ? "bg-[#c6f527] text-[#050709]"
                      : "text-zinc-300 hover:text-white hover:bg-white/[0.05]"
                  }`}
                >
                  {rt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-12">
            {/* Left summary card */}
            <div className="lg:col-span-6 rounded-2xl border border-white/[0.08] bg-[#0c1015] p-6 sm:p-7 flex flex-col justify-between gap-6">
              <div className="space-y-3">
                <p className="text-xs font-medium text-zinc-400">
                  {activeRole.eyebrow}
                </p>
                <h3 className="text-xl sm:text-2xl font-bold text-white leading-snug">
                  {activeRole.title}
                </h3>
                <p className="text-sm leading-relaxed text-zinc-400">
                  {activeRole.desc}
                </p>
              </div>
              <ul className="space-y-2.5 text-xs text-zinc-300">
                {activeRole.checks.map((c) => (
                  <li key={c} className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-[#c6f527] shrink-0 mt-0.5" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right sample live cue */}
            <div className="lg:col-span-6 rounded-2xl border border-white/[0.08] bg-[#0c1015] p-6 sm:p-7 flex flex-col justify-between gap-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between font-mono text-[10px]">
                  <span className="text-zinc-400">SAMPLE LIVE CUE</span>
                  <span className="text-[#c6f527]">{activeRole.sampleTag}</span>
                </div>

                <div className="rounded-xl border border-white/[0.08] bg-[#131820] p-4 space-y-1">
                  <p className="text-[11px] text-zinc-400">Question</p>
                  <p className="text-sm font-semibold text-white">
                    {activeRole.sampleQ}
                  </p>
                </div>

                <ul className="space-y-2.5 text-xs leading-relaxed text-zinc-200">
                  {activeRole.sampleBullets.map((b) => (
                    <li key={b} className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#c6f527] shrink-0" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <p className="font-mono text-[10px] text-zinc-500 pt-2 border-t border-white/[0.06]">
                Grounded in your uploaded resume &amp; Knowledge Engine
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 9: DOWNLOADS (bottom of final-3 + top of final-4, light #f4f5ef) */}
      <section id="download" className="bg-[#f4f5ef] text-[#0c100d] py-20">
        <div className="mx-auto max-w-6xl px-5 space-y-10">
          <div className="max-w-xl space-y-2">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-[1.1]">
              Download for Windows, macOS, and Android.
            </h2>
            <p className="text-sm text-[#545a4f]">
              Lightweight native binaries with direct system-audio capture—no
              browser plugins or meeting bots required.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {[
              {
                icon: Monitor,
                size: "64 MB",
                title: "Windows App",
                sub: "Windows 10 & 11",
                checks: [
                  "Windows 10 (1903+) or Windows 11 64-bit",
                  "WASAPI native system audio capture",
                  "4 GB RAM, 150 MB disk space",
                ],
                cta: "Download for Windows (.exe)",
                foot: "Running Windows 7/8 or older hardware? Grab the Lightweight Helper (.exe) in your dashboard.",
                platform: "windows" as DownloadPlatform,
              },
              {
                icon: Laptop,
                size: "58 MB",
                title: "macOS App",
                sub: "Apple Silicon & Intel",
                checks: [
                  "macOS 13 Ventura or later",
                  "Universal binary (M1/M2/M3/M4 & Intel)",
                  "Built-in ScreenCaptureKit audio",
                ],
                cta: "Download macOS App",
                foot: "Signed and notarized DMG with guided audio permission setup in under 60 seconds.",
                platform: "macos" as DownloadPlatform,
              },
              {
                icon: Smartphone,
                size: "22 MB",
                title: "Android App",
                sub: "Android 10+ (.apk)",
                checks: [
                  "Android 10 or newer",
                  "Pairs via QR code or runs standalone",
                  "Silent haptic alerts & thumb capture",
                ],
                cta: "Download Android App",
                foot: "Prefer zero install on iOS or Android? Open the local QR URL directly in your mobile browser.",
                platform: "windows" as DownloadPlatform,
              },
            ].map((dl) => {
              const Icon = dl.icon;
              return (
                <div
                  key={dl.title}
                  className="rounded-2xl border border-[#e2e5da] bg-[#fbfcf8] p-6 flex flex-col justify-between gap-6"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#edf4d3] text-[#55710e]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="font-mono text-[11px] text-[#7c8276]">
                        {dl.size}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold">{dl.title}</h3>
                      <p className="font-mono text-[11px] text-[#5c7811]">
                        {dl.sub}
                      </p>
                    </div>

                    <ul className="space-y-2 border-t border-[#ecefe5] pt-4 text-xs text-[#3b4136]">
                      {dl.checks.map((c) => (
                        <li key={c} className="flex items-start gap-2">
                          <Check className="h-3.5 w-3.5 text-[#628010] shrink-0 mt-0.5" />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2.5">
                    <a
                      href={WINDOWS_EXE_URL}
                      download={WINDOWS_EXE_FILENAME}
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#c6f527] px-4 py-2.5 text-xs font-bold text-[#050709] hover:bg-[#b5e41c] transition-colors cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>{dl.cta}</span>
                    </a>
                    <p className="text-[11px] leading-relaxed text-[#6d7367]">
                      {dl.foot}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 10: KEYBOARD SHORTCUTS (final-4, dark with olive-lime right radial glow) */}
      <section
        className="py-20"
        style={{
          background:
            "radial-gradient(ellipse 60% 80% at 92% 35%, rgba(132, 184, 24, 0.28), rgba(5, 7, 9, 1) 70%)",
        }}
      >
        <div className="mx-auto max-w-6xl px-5 space-y-10">
          <div className="max-w-md space-y-2.5">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-[1.08]">
              Every control lives under your left thumb.
            </h2>
            <p className="text-sm text-zinc-400">
              Capture a whiteboard, lock reading, adjust opacity, or hide the
              teleprompter without ever touching your mouse.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SHORTCUT_CARDS.map((sc) => (
              <div
                key={sc.title}
                className="rounded-xl border border-white/[0.08] bg-[#0c1015]/90 p-5 space-y-3"
              >
                <div className="flex flex-wrap items-center gap-1 font-mono text-[11px] text-zinc-200">
                  {sc.keys.map((k, idx) =>
                    k === "/" ? (
                      <span key={idx} className="px-1 text-zinc-500">
                        /
                      </span>
                    ) : (
                      <span key={idx} className="inline-flex items-center gap-1">
                        {idx > 0 && sc.keys[idx - 1] !== "/" && (
                          <span className="text-zinc-500">+</span>
                        )}
                        <kbd className="rounded border border-white/15 bg-[#151b23] px-2 py-0.5 text-[10px]">
                          {k}
                        </kbd>
                      </span>
                    )
                  )}
                </div>
                <h3 className="text-sm font-bold text-white">{sc.title}</h3>
                <p className="text-xs leading-relaxed text-zinc-400">
                  {sc.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 11: PRICING CALCULATOR (final-4, light #f4f5ef) */}
      <section id="pricing" className="bg-[#f4f5ef] text-[#0c100d] py-20">
        <div className="mx-auto max-w-2xl px-5 space-y-8">
          <div className="text-center space-y-2.5">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Pay only for the interview hours you use.
            </h2>
            <p className="text-sm text-[#545a4f]">
              No subscription, no recurring charges. Usage time never expires.
            </p>

            {/* Currency Toggle */}
            <div className="pt-2 flex justify-center">
              <div className="inline-flex rounded-lg border border-[#d9ddd0] bg-white p-1 text-xs font-mono font-semibold">
                <button
                  type="button"
                  onClick={() => setCurrency("INR")}
                  className={`rounded-md px-3.5 py-1.5 transition-colors cursor-pointer ${
                    currency === "INR"
                      ? "bg-[#c6f527] text-black"
                      : "text-[#545a4f] hover:text-black"
                  }`}
                >
                  INR (₹)
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency("USD")}
                  className={`rounded-md px-3.5 py-1.5 transition-colors cursor-pointer ${
                    currency === "USD"
                      ? "bg-[#c6f527] text-black"
                      : "text-[#545a4f] hover:text-black"
                  }`}
                >
                  USD ($)
                </button>
              </div>
            </div>
          </div>

          {/* Pricing Card */}
          <div className="rounded-2xl border border-[#d6e5a8] bg-white p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#3c4337]">
                  Selected Time &amp; Quota
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-[#0c100d] tabular-nums">
                    {hours}
                  </span>
                  <span className="text-lg font-medium text-[#545a4f]">
                    {hours === 1 ? "Hour" : "Hours"}
                  </span>
                </div>
              </div>
              <span className="rounded bg-[#eef7cf] px-2.5 py-1 font-mono text-[10px] font-bold text-[#526c0c]">
                ONE-TIME PACK
              </span>
            </div>

            {/* Quota summary badges */}
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dce8af] bg-[#f8fce8] px-3 py-1 text-[#4c640c]">
                <Zap className="h-3 w-3" />
                {hours * 20} Screen Captures &amp; Written Questions (20/hr)
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                <Mic className="h-3 w-3" />
                Unlimited Live Audio Listening
              </span>
              {price.discountPct > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">
                  <Sparkles className="h-3 w-3" />
                  {price.discountPct}% OFF
                </span>
              )}
            </div>

            {/* Interactive Hour Slider */}
            <div className="rounded-xl border border-[#e6e9de] bg-[#f3f5ee] p-4 space-y-2.5">
              <input
                type="range"
                min={1}
                max={40}
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                className="w-full accent-[#b8e81c] cursor-pointer"
              />
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#3c4337]">
                <span>1 Hr (20 Qs)</span>
                <span>40 Hrs (800 Qs · Up to 68.7% Off)</span>
              </div>
            </div>

            {/* Coupon Banner */}
            <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-medium text-[#2c3329]">
                Need an exclusive discount or coupon code?
              </p>
              <a
                href="#demo"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#10b981] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#059669] transition-colors"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>Get Discount on WhatsApp →</span>
              </a>
            </div>

            {/* Total Amount */}
            <div className="flex flex-wrap items-end justify-between gap-4 border-t border-[#ecefe5] pt-5">
              <div>
                <p className="text-xs text-[#6d7367]">Total Amount</p>
                <div className="mt-1 flex items-baseline gap-2.5">
                  {price.discountPct > 0 && (
                    <span className="text-base text-[#909689] line-through tabular-nums">
                      {sym}
                      {price.original.toLocaleString()}
                    </span>
                  )}
                  <span className="text-3xl sm:text-4xl font-extrabold text-[#0c100d] tabular-nums">
                    {sym}
                    {price.total.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-[#6d7367]">Effective rate:</p>
                <p className="text-sm font-bold text-[#526c0c] tabular-nums">
                  {sym}
                  {price.perHour.toLocaleString()}/hour
                </p>
              </div>
            </div>

            {/* Perks */}
            <ul className="space-y-2 text-xs text-[#3b4136]">
              {[
                "Instant activation in Crackpilot app via Auth Token",
                "Unused minutes, screen captures & written prompts never expire",
                "Private eye-level teleprompter mode and zero-cursor copying supported",
                "Includes unlimited live audio listening & local QR mobile remote",
              ].map((perk) => (
                <li key={perk} className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-[#628010] shrink-0 mt-0.5" />
                  <span>{perk}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={isLoggedIn ? onGoDashboard : onGoLogin}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#c6f527] py-3.5 text-sm font-bold text-[#050709] hover:bg-[#b5e41c] transition-colors cursor-pointer"
            >
              <span>
                Proceed to Checkout ({sym}
                {price.total.toLocaleString()}) →
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 12: FAQ + PARTNER + FINAL CTA (bottom of final-4 + final-5, dark) */}
      <section id="faq" className="bg-[#050709] py-20">
        <div className="mx-auto max-w-4xl px-5 space-y-16">
          {/* FAQ Accordion */}
          <div className="space-y-8">
            <h2 className="text-center text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              Straight answers before you install.
            </h2>

            <div className="rounded-2xl border border-white/[0.08] bg-[#0b0f14] divide-y divide-white/[0.07] overflow-hidden">
              {FAQ_ITEMS.map((item, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div key={item.q}>
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? -1 : idx)}
                      className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-white hover:bg-white/[0.02] transition-colors cursor-pointer"
                    >
                      <span>{item.q}</span>
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4 text-zinc-400 shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 text-xs leading-relaxed text-zinc-400">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Partner Banner */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#0c1015] p-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3.5 max-w-xl">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#18220f] text-[#c6f527] shrink-0">
                <Users className="h-5 w-5" />
              </span>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  Coach candidates or run a placement community? Earn recurring
                  payouts.
                </h3>
                <p className="text-xs leading-relaxed text-zinc-400">
                  Refer job seekers with your custom partner code, track
                  conversions in real time, and earn 25% commission on every
                  credit pack purchased.
                </p>
              </div>
            </div>
            <a
              href="#demo"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#c6f527]/35 bg-[#151e0c] px-5 py-2.5 text-xs font-semibold text-[#c6f527] hover:bg-[#1e2c11] transition-colors"
            >
              <span>Apply as Partner</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>

          {/* Pre-Footer Lime-Glow Banner */}
          <div
            className="rounded-2xl border border-white/[0.08] p-8 sm:p-12 space-y-5"
            style={{
              background:
                "radial-gradient(ellipse 65% 110% at 92% 20%, rgba(132, 184, 24, 0.35), rgba(11, 15, 20, 1) 70%)",
            }}
          >
            <h2 className="max-w-xl text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-[1.08]">
              Walk into your next interview with your sharpest stories at eye
              level.
            </h2>
            <p className="max-w-lg text-sm leading-relaxed text-zinc-300">
              Create your workspace, test audio loopback in Practice Mode, and
              keep pay-per-use hours ready whenever the next loop is scheduled.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={isLoggedIn ? onGoDashboard : onGoLogin}
                className="inline-flex items-center gap-2 rounded-full border border-[#c6f527]/40 bg-[#1a250e] px-5 py-2.5 text-xs font-semibold text-[#c6f527] hover:bg-[#c6f527] hover:text-black transition-colors cursor-pointer"
              >
                <span>Create Free Account</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <a
                href="#demo"
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.06] px-5 py-2.5 text-xs font-semibold text-white hover:bg-white/[0.12] transition-colors"
              >
                Book a 15-min Demo
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 13: BOOK A LIVE SETUP DEMO FORM (final-5, light #f4f5ef) */}
      <section id="demo" className="bg-[#f4f5ef] text-[#0c100d] py-20">
        <div className="mx-auto max-w-2xl px-5 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Book a live setup demo
            </h2>
            <p className="text-sm text-[#545a4f]">
              See real-time voice transcription, Alt+S screen capture, and
              mobile QR pairing tested on your preferred meeting platform.
            </p>
          </div>

          <form
            onSubmit={handleDemoSubmit}
            className="rounded-2xl border border-[#e2e5da] bg-white p-6 sm:p-8 shadow-sm space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#1f261b]">
                  Full name
                </span>
                <input
                  type="text"
                  required
                  value={demoName}
                  onChange={(e) => setDemoName(e.target.value)}
                  placeholder="Aarav Mehta"
                  className="w-full rounded-lg border border-[#d7dbce] bg-[#dfe3d7]/70 px-3.5 py-2.5 text-xs text-[#0c100d] placeholder-[#7c8276] focus:border-[#7ca313] focus:bg-white focus:outline-none"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#1f261b]">
                  Email address
                </span>
                <input
                  type="email"
                  required
                  value={demoEmail}
                  onChange={(e) => setDemoEmail(e.target.value)}
                  placeholder="aarav@example.com"
                  className="w-full rounded-lg border border-[#d7dbce] bg-[#dfe3d7]/70 px-3.5 py-2.5 text-xs text-[#0c100d] placeholder-[#7c8276] focus:border-[#7ca313] focus:bg-white focus:outline-none"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#1f261b]">
                  Phone / WhatsApp
                </span>
                <input
                  type="tel"
                  value={demoPhone}
                  onChange={(e) => setDemoPhone(e.target.value)}
                  placeholder="+91 98204 51190"
                  className="w-full rounded-lg border border-[#d7dbce] bg-[#dfe3d7]/70 px-3.5 py-2.5 text-xs text-[#0c100d] placeholder-[#7c8276] focus:border-[#7ca313] focus:bg-white focus:outline-none"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#1f261b]">
                  Target interview role
                </span>
                <input
                  type="text"
                  value={demoRole}
                  onChange={(e) => setDemoRole(e.target.value)}
                  placeholder="Senior Frontend Engineer"
                  className="w-full rounded-lg border border-[#d7dbce] bg-[#dfe3d7]/70 px-3.5 py-2.5 text-xs text-[#0c100d] placeholder-[#7c8276] focus:border-[#7ca313] focus:bg-white focus:outline-none"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#1f261b]">
                  Preferred date &amp; time
                </span>
                <input
                  type="datetime-local"
                  value={demoDate}
                  onChange={(e) => setDemoDate(e.target.value)}
                  className="w-full rounded-lg border border-[#d7dbce] bg-[#dfe3d7]/70 px-3.5 py-2.5 text-xs text-[#0c100d] focus:border-[#7ca313] focus:bg-white focus:outline-none"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#1f261b]">
                  Meeting platform
                </span>
                <select
                  value={demoPlatform}
                  onChange={(e) => setDemoPlatform(e.target.value)}
                  className="w-full rounded-lg border border-[#d7dbce] bg-[#dfe3d7]/70 px-3.5 py-2.5 text-xs text-[#0c100d] focus:border-[#7ca313] focus:bg-white focus:outline-none"
                >
                  <option>Google Meet</option>
                  <option>Zoom</option>
                  <option>Microsoft Teams</option>
                  <option>Webex</option>
                  <option>WhatsApp Desktop / Web</option>
                </select>
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-[#1f261b]">
                Anything specific you want to test?{" "}
                <span className="font-normal text-[#7c8276]">(optional)</span>
              </span>
              <textarea
                rows={3}
                value={demoNotes}
                onChange={(e) => setDemoNotes(e.target.value)}
                placeholder="e.g., macOS audio setup, mobile QR remote, or system design screen capture..."
                className="w-full rounded-lg border border-[#d7dbce] bg-[#dfe3d7]/70 p-3 text-xs text-[#0c100d] placeholder-[#7c8276] focus:border-[#7ca313] focus:bg-white focus:outline-none"
              />
            </label>

            {demoSubmitted && (
              <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800">
                Demo request received for {demoName || "your team"} on{" "}
                {demoPlatform}! Meanwhile, you can also test audio &amp; overlay
                right now in Practice Mode.
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-[#6d7367]">
                <Calendar className="h-3.5 w-3.5 text-[#5c7811]" />
                15-minute live walkthrough. No credit card needed.
              </span>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full bg-[#c6f527] px-5 py-2.5 text-xs font-bold text-[#050709] hover:bg-[#b5e41c] transition-colors cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Request Live Demo</span>
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* SECTION 14: FOOTER (final-5, dark) */}
      <footer className="border-t border-white/[0.08] bg-[#050709] pt-14 pb-10 text-xs text-zinc-400">
        <div className="mx-auto max-w-6xl px-5 space-y-12">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-[#c6f527] text-[10px] font-extrabold text-black">
                  C
                </span>
                <span>crackpilot</span>
              </div>
              <p className="leading-relaxed text-zinc-500">
                AI interview preparation and live-assist workspace for Windows,
                macOS, and Android. Pay only for the hours you use.
              </p>
            </div>

            <div className="space-y-2.5">
              <p className="font-semibold text-[#c6f527]">Product</p>
              <ul className="space-y-2">
                <li>
                  <a href="#features" className="hover:text-white">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#how-it-works" className="hover:text-white">
                    How it Works
                  </a>
                </li>
                <li>
                  <a href="#download" className="hover:text-white">
                    Download Apps
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="hover:text-white">
                    Pricing
                  </a>
                </li>
              </ul>
            </div>

            <div className="space-y-2.5">
              <p className="font-semibold text-[#c6f527]">
                Account &amp; Programs
              </p>
              <ul className="space-y-2">
                <li>
                  <button
                    type="button"
                    onClick={onGoLogin}
                    className="hover:text-white cursor-pointer"
                  >
                    Sign In
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={onGoLogin}
                    className="hover:text-white cursor-pointer"
                  >
                    Create Account
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={isLoggedIn ? onGoDashboard : onGoLogin}
                    className="hover:text-white cursor-pointer"
                  >
                    Workspace Dashboard
                  </button>
                </li>
                <li>
                  <a href="#demo" className="hover:text-white">
                    Agent Partner Program
                  </a>
                </li>
              </ul>
            </div>

            <div className="space-y-2.5">
              <p className="font-semibold text-[#c6f527]">
                Legal &amp; Support
              </p>
              <ul className="space-y-2">
                <li>
                  <a href="#faq" className="hover:text-white">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-white">
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="#demo" className="hover:text-white">
                    Book a Demo
                  </a>
                </li>
                <li className="font-mono text-[11px] text-zinc-500">
                  support@crackpilot.dev
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.07] pt-6 text-[11px] text-zinc-500">
            <span>© 2026 Crackpilot Technologies. All rights reserved.</span>
            <span className="font-mono">Windows 10/11, macOS, Android</span>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp Support Pill (exact match to final-1) */}
      <a
        href="#demo"
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-[#10b981] px-4 py-2.5 text-xs font-semibold text-white shadow-lg hover:bg-[#059669] transition-colors"
      >
        <MessageCircle className="h-4 w-4" />
        <span>WhatsApp</span>
      </a>
    </div>
  );
}

export interface KnowledgeEntry {
  id: string;
  question: string;
  answer: string;
  category: 'Behavioral' | 'Technical' | 'System Design' | 'Leadership' | 'General';
  updatedAt: string;
}

export interface SupportTicket {
  id: string;
  subject: string;
  category: 'Technical Setup' | 'Audio & Capture' | 'Billing & Credits' | 'Account';
  status: 'Open' | 'In Progress' | 'Resolved';
  createdAt: string;
  description: string;
  attachmentName?: string;
}

export interface InvoiceRecord {
  id: string;
  date: string;
  description: string;
  amount: string;
  status: 'Paid';
}

export interface UserProfileData {
  fullName: string;
  email: string;
  phone: string;
  targetRole: string;
  experienceLevel: string;
  companyType: string;
  techStack: string[];
  resumeFileName: string;
  jobDescription: string;
}

export const INITIAL_PROFILE: UserProfileData = {
  fullName: 'Aarav Mehta',
  email: 'aarav.mehta@crackpilot.dev',
  phone: '+91 98204 51190',
  targetRole: 'Senior Frontend Engineer',
  experienceLevel: '5–8 years (Senior)',
  companyType: 'Product-led SaaS (Series B–D)',
  techStack: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS', 'GraphQL', 'Node.js', 'Web Performance'],
  resumeFileName: 'Aarav_Mehta_Senior_FE_2026.pdf',
  jobDescription:
    'Building high-throughput real-time web applications, owning core design system architecture, optimizing Core Web Vitals, and mentoring mid-level engineers across cross-functional pods.',
};

export const INITIAL_CREDITS = {
  planName: 'PRO PLAN',
  minutesLeft: 240,
  capturesUsed: 0,
  capturesLimit: 80,
};

export const INITIAL_KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: 'qa-1',
    question: 'Tell me about yourself and your recent impact.',
    answer: 'Lead with 6 years building data-heavy React & TypeScript apps. Highlight cutting checkout p95 latency by 410ms at FinStack, leading a 4-engineer design system migration across 18 product views, and why this Senior FE role fits my focus on architecture + craft.',
    category: 'General',
    updatedAt: 'Nov 16, 2026',
  },
  {
    id: 'qa-2',
    question: 'Describe a conflict with product or design and how you resolved it.',
    answer: 'During Q3 analytics launch, scope threatened our sprint stability window. Built a 1-day interactive prototype showing a phased rollout, aligned PM and Design on shipping core table virtualization first, and hit both latency targets and full feature delivery two weeks later.',
    category: 'Behavioral',
    updatedAt: 'Nov 12, 2026',
  },
  {
    id: 'qa-3',
    question: 'How do you diagnose a React production memory leak?',
    answer: 'Capture two Chrome DevTools Heap Snapshots before and after repeating the user flow, filter by Detached DOM nodes and closure retainers, check uncleaned WebSocket/ResizeObserver listeners in useEffect, and verify fix with Allocation Timeline.',
    category: 'Technical',
    updatedAt: 'Nov 10, 2026',
  },
  {
    id: 'qa-4',
    question: 'What are your compensation expectations?',
    answer: 'Anchor on total scope and market band for Senior Frontend roles at Series B–D companies. Share willingness to look at total comp (base + equity) once we confirm mutual role fit after the technical panel.',
    category: 'General',
    updatedAt: 'Nov 04, 2026',
  },
];

export const INITIAL_TICKETS: SupportTicket[] = [
  {
    id: 'TKT-4821',
    subject: 'macOS Screen Recording permission prompt after Sonoma update',
    category: 'Technical Setup',
    status: 'Resolved',
    createdAt: 'Nov 11, 2026',
    description: 'After updating macOS, Alt+S showed a blank frame until I re-toggled permission in System Settings.',
  },
  {
    id: 'TKT-4859',
    subject: 'Confirming GST invoice download for 4-hour bundle',
    category: 'Billing & Credits',
    status: 'In Progress',
    createdAt: 'Nov 17, 2026',
    description: 'Need company GSTIN added to invoice INV-2026-1104 for reimbursement.',
    attachmentName: 'gst-details.pdf',
  },
];

export const INITIAL_INVOICES: InvoiceRecord[] = [
  {
    id: 'INV-2026-1104',
    date: 'Nov 15, 2026',
    description: '4-Hour Interview Credit Pack (240 mins + 80 captures)',
    amount: '₹2,940',
    status: 'Paid',
  },
  {
    id: 'INV-2026-1018',
    date: 'Oct 18, 2026',
    description: '2-Hour Interview Credit Pack (120 mins + 40 captures)',
    amount: '₹1,598',
    status: 'Paid',
  },
];

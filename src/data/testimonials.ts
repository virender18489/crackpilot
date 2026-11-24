export interface TestimonialItem {
  id: string;
  name: string;
  role: string;
  company: string;
  location: string;
  quote: string;
  outcome: string;
}

export const TESTIMONIALS: TestimonialItem[] = [
  {
    id: 't-1',
    name: 'Rohan Kulkarni',
    role: 'Senior Frontend Engineer',
    company: 'FinTech Series C',
    location: 'Bengaluru',
    quote: 'System design rounds used to throw me off whenever the interviewer pivoted mid-whiteboard. Having my own architecture notes surface as short bullets at eye level kept my delivery calm and structured.',
    outcome: 'Cleared 4 onsite loops in 3 weeks',
  },
  {
    id: 't-2',
    name: 'Meera Nair',
    role: 'Group Product Manager',
    company: 'B2B SaaS',
    location: 'Mumbai',
    quote: 'I loaded twelve STAR stories into the Knowledge Engine before my final panel. When the VP asked about a pricing rollback I led two years ago, my exact metrics appeared in under a second.',
    outcome: 'Landed 32% compensation lift',
  },
  {
    id: 't-3',
    name: 'Daniel Park',
    role: 'Account Executive',
    company: 'Enterprise Security',
    location: 'Austin',
    quote: 'The mobile QR remote is what sold me. I paired my phone on home Wi-Fi, tapped capture during a live discovery roleplay, and stayed completely focused on the panel without fumbling tabs.',
    outcome: 'Closed offer after 2nd final round',
  },
  {
    id: 't-4',
    name: 'Ananya Deshmukh',
    role: 'Software Engineer I',
    company: 'Cloud Infrastructure',
    location: 'Pune',
    quote: 'As a final-year grad, paying only for the 3 hours I actually needed beat every monthly subscription. Practice Mode helped me fix my pacing before campus placements started.',
    outcome: 'Converted campus offer on first attempt',
  },
  {
    id: 't-5',
    name: 'Karthik Subramanian',
    role: 'Staff Backend Engineer',
    company: 'Payments Platform',
    location: 'Hyderabad',
    quote: 'Alt+S screen capture on SQL query optimization prompts gave me clean index trade-off checklists without dumping walls of text. I still explained everything in my own words, just without blanking out.',
    outcome: 'Passed 2 Staff-level technical loops',
  },
];

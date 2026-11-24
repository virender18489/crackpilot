export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-1',
    question: 'How does pay-per-use credit billing work?',
    answer: 'You buy interview hours up front starting at ₹799 per hour (or $10/hr). Time is deducted only while an active live-assist session is running—pause or close the app and your remaining minutes stay in your account with no expiration date and no recurring subscription.',
  },
  {
    id: 'faq-2',
    question: 'Which video calling platforms does Crackpilot work with?',
    answer: 'Crackpilot captures system audio locally, so it works alongside Zoom, Google Meet, Microsoft Teams, Webex, GoToMeeting, Discord, HackerRank, and browser-based coding platforms without needing browser extensions or meeting bots.',
  },
  {
    id: 'faq-3',
    question: 'How does the Mobile Remote QR pairing work?',
    answer: 'After signing in with your 48-hour Auth Token on Windows or macOS, Crackpilot displays a local QR code. Scan it from your Android phone or any mobile browser on the same Wi-Fi to trigger screen captures, scroll answers, and read cues away from your primary monitor.',
  },
  {
    id: 'faq-4',
    question: 'Does Crackpilot tailor answers to my resume and target role?',
    answer: 'Yes. Upload your resume, add your tech stack, and paste the job description in Target Profile. Every suggestion references your real projects, metrics, and role terminology rather than generic textbook prose.',
  },
  {
    id: 'faq-5',
    question: 'Can I pre-load my own behavioral stories and custom Q&A?',
    answer: 'Yes. Use the Knowledge Engine in your dashboard to store STAR stories, salary framing, and project deep-dives. When a matching question comes up, Crackpilot surfaces your saved talking points first.',
  },
  {
    id: 'faq-6',
    question: 'How fast are live speech-to-answer suggestions?',
    answer: 'Streaming transcription begins as the interviewer finishes speaking, with initial structured bullet points appearing in under 850ms on a standard broadband connection.',
  },
  {
    id: 'faq-7',
    question: 'What devices and OS versions are supported?',
    answer: 'We provide native desktop apps for Windows 10/11 (64-bit) and macOS 13+ (Apple Silicon & Intel), a lightweight helper (.exe) for Windows 7/8 and older hardware, plus an Android (.apk) companion app.',
  },
  {
    id: 'faq-8',
    question: 'Can I test Crackpilot before an important interview?',
    answer: 'Yes. Practice Mode lets you rehearse with your microphone, test keyboard shortcuts, verify audio loopback routing, and check your eye-level teleprompter placement before any real call. You can also book a 15-minute live walkthrough with our team.',
  },
  {
    id: 'faq-9',
    question: 'How many devices can I link to my account?',
    answer: 'Each 48-hour Auth Token supports up to 2 active devices simultaneously—for example, your laptop running the desktop app paired with your phone running the mobile remote.',
  },
  {
    id: 'faq-10',
    question: 'How is my resume and transcript data handled?',
    answer: 'Audio streams are processed in real time and never used to train external models. You can delete individual session transcripts, custom Q&A entries, or your entire account directly from Account Settings.',
  },
];

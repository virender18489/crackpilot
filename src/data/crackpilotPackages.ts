export type DownloadPlatform = "windows" | "macos" | "extension";

export const WINDOWS_EXE_URL: string =
  import.meta.env.VITE_WINDOWS_EXE_URL ||
  "https://github.com/virender18489/crackpilot/releases/latest/download/Crackpilot-Setup.exe";

export const WINDOWS_EXE_FILENAME = "Crackpilot-Setup.exe";

export const SAMPLE_INTERVIEW_QUESTIONS = [
  {
    label: "React Re-renders",
    text: "How do you diagnose and eliminate unnecessary re-renders in a large React application?",
  },
  {
    label: "Node.js Scaling",
    text: "How would you design a rate-limited Node.js API that handles 5,000 requests per second?",
  },
  {
    label: "Resume Deep-Dive",
    text: "Walk me through the most challenging project on your resume and the technical trade-offs you made.",
  },
  {
    label: "Hinglish Scenario",
    text: "Agar production deployment ke baad memory leak aa jaye toh aap step-by-step kaise debug karoge?",
  },
];

export type RootView = "landing" | "login" | "dashboard" | "software";

export type DashboardTab = "overview" | "profile" | "testing" | "downloads";

export type AnswerLanguage = "English" | "Hinglish" | "Hindi";

export type AnswerStyle = "Concise Bullets" | "STAR Method" | "Technical + Code";

export type UILanguage = "en" | "hi";

export interface UserAccount {
  id: string;
  name: string;
  email: string;
}

export interface SessionTokenState {
  token: string;
  createdAt: string;
  authenticated: boolean;
  sessionActive: boolean;
}

export interface TargetProfile {
  role: string;
  experience: string;
  skills: string;
  resumeFileName: string;
  resumeText: string;
  jdFileName: string;
  jdText: string;
  answerLanguage: AnswerLanguage;
  answerStyle: AnswerStyle;
  updatedAt?: string;
}

export interface QAItem {
  id: string;
  timestamp: string;
  question: string;
  answer: string;
  engine: string;
  isStreaming: boolean;
  error?: string;
}

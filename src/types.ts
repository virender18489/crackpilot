export type RootView = "landing" | "login" | "dashboard" | "software" | "admin";

export type DashboardTab = "overview" | "profile" | "testing" | "downloads";

export type AnswerLanguage = "English" | "Hinglish" | "Hindi";

export type AnswerStyle = "Concise Bullets" | "STAR Method" | "Technical + Code";

export type UILanguage = "en" | "hi";

export type AccountType = "REGULAR" | "DEMO";

export type AccountStatus = "Active" | "Suspended" | "Expired";

export interface AccountQuotaSnapshot {
  token: string;
  label: string;
  accountType: AccountType;
  status: AccountStatus;
  remainingSeconds: number;
  remainingMinutes: number;
  capturesUsed: number;
  captureLimit: number;
  promptsUsed: number;
  promptLimit: number;
  expiresAt: string | null;
  blockedReason: string | null;
}

export interface AdminAccountRecord {
  id: string;
  token: string;
  label: string;
  email: string;
  accountType: AccountType;
  status: AccountStatus;
  remainingSeconds: number;
  totalMinutesGranted: number;
  capturesUsed: number;
  captureLimit: number;
  promptsUsed: number;
  promptLimit: number;
  createdAt: string;
  expiresAt: string | null;
  lastActiveAt: string | null;
  notes?: string;
}

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
  quota?: AccountQuotaSnapshot;
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

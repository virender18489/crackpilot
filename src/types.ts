export type RootView = "landing" | "login" | "dashboard" | "software" | "admin";

export type DashboardTab = "overview" | "profile" | "testing" | "downloads";

export type AnswerLanguage = "English" | "Hinglish" | "Hindi";

export type AnswerStyle =
  | "Point-to-Point (Direct Human Answer)"
  | "Detailed Explanation (In-Depth Human Answer)";

export type ProgrammingLanguage =
  | "Python"
  | "Java"
  | "C++"
  | "JavaScript"
  | "TypeScript"
  | "Go"
  | "C#"
  | "Rust";

export type UILanguage = "en" | "hi";

export type AccountType = "REGULAR" | "DEMO";

export type PlanType = "Demo" | "Starter" | "Pro Plan" | "Unlimited";

export type PaymentStatus = "Pending" | "Paid";

export type AccountStatus = "Active" | "Suspended" | "Expired";

export type DsaAssessmentType = "live_coding_interview" | "online_assessment";

export type OaQuestionKind = "full_coding" | "debugging" | "mcq" | "work_style";

export interface ActiveProblemContext {
  id: string;
  title: string;
  assessmentType: DsaAssessmentType;
  oaQuestionKind?: OaQuestionKind;
  topicPattern: string;
  problemStatement: string;
  ioFormat: string;
  constraints: string;
  examples: string;
  starterCode: string;
  preferredLanguage: ProgrammingLanguage;
  source: "alt_s" | "alt_v" | "mobile_companion" | "text_simulator";
  capturedAt: string;
}

export interface DsaClarifyingQuestion {
  question: string;
  ifYes: string;
  ifNo: string;
}

export interface DsaTeleprompterData {
  assessmentType: DsaAssessmentType;
  oaQuestionKind?: OaQuestionKind;
  problemContext: ActiveProblemContext;
  step1?: {
    topicPattern: string;
    summary: string;
    ioConstraints: string;
  };
  step2?: {
    clarifyingQuestions: DsaClarifyingQuestion[];
    fallbackAssumptions: string[];
  };
  step3?: {
    explanation: string;
    timeComplexity: string;
    spaceComplexity: string;
    code: string;
    language: ProgrammingLanguage;
  };
  step4?: {
    intuition: string;
    code: string;
    language: ProgrammingLanguage;
  };
  step5?: {
    spokenDryRun: string;
    edgeCases: string[];
    timeComplexity: string;
    spaceComplexity: string;
  };
  oa?: {
    questionKind: OaQuestionKind;
    directAnswer: string;
    explanation: string;
    code?: string;
    language?: ProgrammingLanguage;
    edgeCases?: string[];
    timeComplexity?: string;
    spaceComplexity?: string;
  };
}

export interface AccountQuotaSnapshot {
  token: string;
  label: string;
  email: string;
  accountType: AccountType;
  planType: PlanType;
  paymentStatus: PaymentStatus;
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
  planType: PlanType;
  paymentStatus: PaymentStatus;
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

export interface AdminDashboardStats {
  totalUsers: number;
  activeDemoIds: number;
  totalPaidAccounts: number;
  totalMinutesAllocated: number;
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
  dsaModeEnabled?: boolean;
  preferredLanguage?: ProgrammingLanguage;
  updatedAt?: string;
}

export interface QAItem {
  id: string;
  timestamp: string;
  question: string;
  answer: string;
  engine: string;
  isStreaming: boolean;
  latencyMs?: number;
  error?: string;
  dsaData?: DsaTeleprompterData;
}

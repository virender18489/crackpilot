import "dotenv/config";
import crypto from "crypto";
import fs from "fs";
import http from "http";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import {
  attachLiveQaWebSocketServer,
  getLiveQaServerStatus,
} from "./server/liveQaBridge.ts";
import {
  DEFAULT_ANSWER_STYLE,
  analyzeDsaProblem,
  buildDsaAnalysisSummaryMarkdown,
  buildDsaFollowUpSystemPrompt,
  buildHumanInterviewSystemPrompt,
  generateContentStreamResilient,
  isCodeCreationRequest,
  normalizeAnswerStyle,
  normalizeProgrammingLanguage,
} from "./server/dsaEngine.ts";
import { streamGroqChatCompletion } from "./server/groqHelper.ts";
import {
  transcribeWithDeepgramEnglish,
  transcribeWithGroqWhisperEnglish,
} from "./server/sttConfig.ts";
import type {
  ActiveProblemContext,
  AnswerStyle,
  DsaAssessmentType,
  OaQuestionKind,
  ProgrammingLanguage,
} from "./src/types.ts";
import {
  type AccountStatus,
  type AccountType,
  type PaymentStatus,
  type PlanType,
  adjustAccountQuotas,
  buildAdminClearCookieHeader,
  buildAdminSetCookieHeader,
  buildQuotaSnapshot,
  checkQuotaForAction,
  claimFirstRunAdmin,
  computeAdminStats,
  consumeAccountUsage,
  createManagedAccount,
  deleteAccountByToken,
  findAccountByEmail,
  findAccountByToken,
  getAdminAuthConfigStatus,
  getAdminCookieName,
  listAllAccounts,
  parseCookieHeader,
  registerRegularToken,
  signAdminSessionToken,
  updateAccountPaymentStatus,
  updateAccountStatus,
  verifyAdminCredentials,
  verifyAdminSessionToken,
} from "./server/adminStore.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const isProd = process.env.NODE_ENV === "production";

interface StoredProfile {
  role: string;
  experience: string;
  skills: string;
  resumeFileName: string;
  resumeText: string;
  jdFileName: string;
  jdText: string;
  answerLanguage: "English" | "Hinglish" | "Hindi";
  answerStyle: AnswerStyle;
  dsaModeEnabled: boolean;
  preferredLanguage: ProgrammingLanguage;
  updatedAt: string;
}

interface StoredToken {
  token: string;
  createdAt: string;
  authenticated: boolean;
  sessionActive: boolean;
}

interface StoredUser {
  id: string;
  name: string;
  email: string;
}

let currentUser: StoredUser | null = null;

let activeToken: StoredToken | null = null;

let activeProblemContext: ActiveProblemContext | null = null;

let activeProfile: StoredProfile = {
  role: "Frontend Development (React, Next.js, Vue, Web)",
  experience: "Junior (1-3 Years)",
  skills: "",
  resumeFileName: "",
  resumeText: "",
  jdFileName: "",
  jdText: "",
  answerLanguage: "English",
  answerStyle: DEFAULT_ANSWER_STYLE,
  dsaModeEnabled: false,
  preferredLanguage: "Python",
  updatedAt: new Date().toISOString(),
};

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function hasOpenAIKey(): boolean {
  const key = process.env.OPENAI_API_KEY?.trim();
  return Boolean(key && key !== "MY_OPENAI_API_KEY" && key.startsWith("sk-"));
}

function buildInterviewSystemPrompt(params: {
  role?: string;
  experience?: string;
  skills?: string;
  resumeText?: string;
  jdText?: string;
  answerLanguage?: string;
  answerStyle?: string;
  fastMode?: boolean;
  question?: string;
}): string {
  return buildHumanInterviewSystemPrompt({
    role: params.role || activeProfile.role,
    experience: params.experience || activeProfile.experience,
    skills: params.skills ?? activeProfile.skills,
    resumeText: params.resumeText ?? activeProfile.resumeText,
    jdText: params.jdText ?? activeProfile.jdText,
    answerLanguage: params.answerLanguage || activeProfile.answerLanguage,
    answerStyle: params.answerStyle || activeProfile.answerStyle,
    fastMode: params.fastMode,
    question: params.question,
  });
}

interface TranscribeProfileContext {
  role?: string;
  experience?: string;
  skills?: string;
  jdText?: string;
}

async function transcribeWithOpenAI(
  audioBase64: string,
  mimeType: string,
  language?: string,
  profileCtx?: TranscribeProfileContext
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY!;
  const buffer = Buffer.from(audioBase64, "base64");
  const ext = mimeType.includes("wav")
    ? "wav"
    : mimeType.includes("mp4") || mimeType.includes("m4a")
      ? "m4a"
      : mimeType.includes("ogg")
        ? "ogg"
        : "webm";

  const formData = new FormData();
  const blob = new Blob([buffer], { type: mimeType || "audio/webm" });
  formData.append("file", blob, `chunk.${ext}`);
  formData.append("model", "whisper-1");
  if (language && language !== "auto") {
    formData.append("language", language);
  }
  const vocabParts = [
    profileCtx?.role ? `Interview role: ${profileCtx.role}.` : "",
    profileCtx?.skills ? `Key domain terms: ${profileCtx.skills}.` : "",
  ].filter(Boolean);
  if (vocabParts.length > 0) {
    formData.append("prompt", vocabParts.join(" ").slice(0, 800));
  }

  const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`OpenAI Whisper error (${resp.status}): ${errText}`);
  }

  const data = (await resp.json()) as { text?: string };
  return (data.text || "").trim();
}

async function transcribeWithGemini(
  audioBase64: string,
  mimeType: string,
  language?: string,
  profileCtx?: TranscribeProfileContext
): Promise<string> {
  const ai = getGeminiClient();
  const cleanMime = (mimeType || "audio/webm").split(";")[0].trim();
  const role = (profileCtx?.role || activeProfile.role || "").trim();
  const skills = (profileCtx?.skills || activeProfile.skills || "").trim();
  const jdSnippet = (profileCtx?.jdText || activeProfile.jdText || "").trim().slice(0, 600);

  const profileHint = [
    role ? `Target Role: ${role}` : "",
    skills ? `Domain Core Skills & Tech Terms: ${skills}` : "",
    jdSnippet ? `JD Context: ${jdSnippet}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const hint = [
    language === "hi"
      ? "Transcribe the remote interviewer's spoken question from this laptop/meeting system audio accurately in Hindi/Hinglish (keep technical/domain terms in English)."
      : "Transcribe the remote interviewer's spoken question from this laptop/meeting system audio accurately.",
    "PRONUNCIATION AUTO-ADJUSTMENT: The speaker may have a regional accent or slightly mispronounce technical/domain terms. Using the Target Profile below, automatically correct any phonetically similar or slightly mispronounced words into the exact intended domain terminology (for example: 'eye dock' -> 'IDoc', 'bappy' -> 'BAPI', 'cube netties' -> 'Kubernetes', 'red ducks' -> 'Redux', 'pie spark' -> 'PySpark', 's four hana' -> 'S/4HANA').",
    profileHint ? `TARGET PROFILE CONTEXT:\n${profileHint}` : "",
    "Output ONLY the clean, adjusted spoken question text with no timestamps, labels, or commentary. If silent or only background noise, return an empty string.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const models = ["gemini-3.5-transcribe", "gemini-2.5-flash"] as const;
  let lastErr: unknown;
  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: {
          parts: [
            { inlineData: { mimeType: cleanMime, data: audioBase64 } },
            { text: hint },
          ],
        },
      });
      return (response.text || "").trim();
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error("Gemini transcription unavailable.");
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "20mb" }));

  // Allow the packaged Electron Desktop (.exe) app to call non-admin backend APIs & SSE.
  // Never emit wildcard CORS on authenticated /api/admin/* routes.
  app.use("/api", (req, res, next) => {
    if (req.path.startsWith("/admin")) {
      next();
      return;
    }
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  // Strict CSRF protection for cookie-authenticated admin state mutations
  const verifyAdminCsrf = (req: express.Request, res: express.Response): boolean => {
    const requestedWith = req.get("x-requested-with");
    if (requestedWith !== "CrackpilotAdmin") {
      res.status(403).json({ error: "Missing required admin request header." });
      return false;
    }
    const origin = req.get("origin");
    if (origin) {
      try {
        const parsedOrigin = new URL(origin);
        const forwardedHost = (req.get("x-forwarded-host") || req.get("host") || "")
          .split(",")[0]
          .trim()
          .toLowerCase();
        if (forwardedHost && parsedOrigin.host.toLowerCase() !== forwardedHost) {
          res.status(403).json({ error: "Cross-origin admin mutation blocked." });
          return false;
        }
      } catch {
        res.status(403).json({ error: "Invalid Origin header." });
        return false;
      }
    }
    return true;
  };

  // Read & verify super-admin signed JWT from HttpOnly cookie
  const getAuthenticatedAdmin = (req: express.Request): { subject: string; exp: number } | null => {
    const cookies = parseCookieHeader(req.headers.cookie);
    const cookieJwt = cookies[getAdminCookieName()];
    if (!cookieJwt) return null;
    const verified = verifyAdminSessionToken(cookieJwt);
    if (!verified.valid) return null;
    return { subject: verified.subject, exp: verified.exp };
  };

  const requireAdminAuth: express.RequestHandler = (req, res, next) => {
    const admin = getAuthenticatedAdmin(req);
    if (!admin) {
      res.status(401).json({ error: "Unauthorized. Super-Admin sign-in required." });
      return;
    }
    (req as express.Request & { adminSubject?: string }).adminSubject = admin.subject;
    next();
  };

  const sseClients = new Set<express.Response>();

  const broadcastEvent = (payload: Record<string, unknown>) => {
    const data = `data: ${JSON.stringify(payload)}\n\n`;
    for (const client of sseClients) {
      client.write(data);
    }
  };

  // Health & Config
  app.get("/api/health", (_req, res) => {
    const cleanEnv = (k: string) => {
      const v = (process.env[k] || "").trim().replace(/^['"]|['"]$/g, "");
      return Boolean(v && !/your_|placeholder/i.test(v));
    };
    const groq = cleanEnv("GROQ_API_KEY");
    const deepgram = cleanEnv("DEEPGRAM_API_KEY");
    const openai = hasOpenAIKey();
    const gemini = cleanEnv("GEMINI_API_KEY");
    res.json({
      ok: true,
      sseSupported: true,
      ts: Date.now(),
      engines: {
        groq,
        deepgram,
        openai,
        gemini,
        sttReady: deepgram || groq || openai || gemini,
        llmReady: groq || openai || gemini,
      },
    });
  });

  app.get("/api/config", (_req, res) => {
    const openaiReady = hasOpenAIKey();
    const geminiReady = Boolean(process.env.GEMINI_API_KEY);
    res.json({
      activeEngine: openaiReady ? "openai" : "gemini",
      hasOpenAI: openaiReady,
      hasGemini: geminiReady,
    });
  });

  app.get("/api/live-qa/status", (_req, res) => {
    res.json(getLiveQaServerStatus());
  });

  // Auth routes
  app.get("/api/auth/me", (_req, res) => {
    res.json({ user: currentUser, token: activeToken, profile: activeProfile });
  });

  app.post("/api/auth/login", (req, res) => {
    const { email, name } = req.body as { email?: string; name?: string };
    const cleanEmail = (email || "candidate@crackpilot.app").trim();
    const managed = findAccountByEmail(cleanEmail);
    const cleanName = (
      name ||
      managed?.label ||
      cleanEmail.split("@")[0] ||
      "Candidate"
    ).trim();
    currentUser = {
      id: managed?.id || "usr-" + crypto.randomBytes(4).toString("hex"),
      name: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
      email: cleanEmail,
    };

    let linkedTokenPayload: (StoredToken & { quota?: ReturnType<typeof buildQuotaSnapshot> }) | null = null;
    if (managed) {
      const quota = buildQuotaSnapshot(managed);
      activeToken = {
        token: managed.token,
        createdAt: managed.createdAt,
        authenticated: false,
        sessionActive: false,
      };
      linkedTokenPayload = { ...activeToken, quota };
    }

    res.json({ ok: true, user: currentUser, token: linkedTokenPayload });
  });

  app.post("/api/auth/logout", (_req, res) => {
    currentUser = null;
    res.json({ ok: true });
  });

  // Token Generation & Software Authentication Flow (integrated with AdminStore quotas)
  app.get("/api/token/current", (_req, res) => {
    if (!activeToken) {
      res.json({ token: null });
      return;
    }
    const acc = findAccountByToken(activeToken.token);
    res.json({
      token: {
        ...activeToken,
        quota: acc ? buildQuotaSnapshot(acc) : undefined,
      },
    });
  });

  app.post("/api/token/generate", (_req, res) => {
    const raw = `CP-${crypto.randomBytes(3).toString("hex").toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
    const acc = registerRegularToken({
      token: raw,
      label: currentUser?.name || "Candidate Session",
      email: currentUser?.email || "",
      minutes: 240,
      captureLimit: 80,
      promptLimit: 80,
    });
    const quota = buildQuotaSnapshot(acc);
    activeToken = {
      token: raw,
      createdAt: acc.createdAt,
      authenticated: false,
      sessionActive: false,
    };
    const tokenPayload = { ...activeToken, quota };
    broadcastEvent({ type: "token_generated", token: tokenPayload });
    res.json({ ok: true, token: tokenPayload });
  });

  app.post("/api/token/verify", (req, res) => {
    const { token } = req.body as { token?: string };
    const submitted = (token || "").trim();
    if (!submitted) {
      res.status(400).json({ error: "Please paste your generated token or Demo ID." });
      return;
    }

    const managedAccount = findAccountByToken(submitted);
    const matchesActive = Boolean(activeToken && submitted === activeToken.token);

    if (!managedAccount && !matchesActive) {
      res.status(401).json({
        error: "Invalid token or Demo ID. Copy the exact token from Dashboard → Overview or Admin Panel.",
      });
      return;
    }

    const account =
      managedAccount ||
      registerRegularToken({
        token: submitted,
        label: currentUser?.name || "Candidate Session",
        email: currentUser?.email || "",
      });

    const quota = buildQuotaSnapshot(account);
    if (quota.blockedReason) {
      res.status(403).json({ error: quota.blockedReason, quota });
      return;
    }

    activeToken = {
      token: account.token,
      createdAt: account.createdAt,
      authenticated: true,
      // Demo IDs created by Admin activate straight into live overlay ready state
      sessionActive: account.accountType === "DEMO" ? true : Boolean(activeToken?.sessionActive),
    };
    const tokenPayload = { ...activeToken, quota };
    broadcastEvent({ type: "token_authenticated", token: tokenPayload });
    res.json({ ok: true, token: tokenPayload, profile: activeProfile, quota });
  });

  // Live Quota Sync for Desktop Overlay (on Reconnect + periodic background sync)
  app.get("/api/token/quota", (req, res) => {
    const requestedToken = String(req.query.token || activeToken?.token || "").trim();
    if (!requestedToken) {
      res.status(404).json({ error: "No active token provided." });
      return;
    }
    const acc = findAccountByToken(requestedToken);
    if (!acc) {
      res.status(404).json({
        error: "This token has been revoked or deleted by the administrator.",
        revoked: true,
      });
      return;
    }
    const quota = buildQuotaSnapshot(acc);
    res.json({ ok: true, quota });
  });

  // Sync elapsed active session seconds from desktop overlay
  app.post("/api/token/consume", (req, res) => {
    const { token, elapsedSeconds } = req.body as {
      token?: string;
      elapsedSeconds?: number;
    };
    const targetToken = (token || activeToken?.token || "").trim();
    if (!targetToken) {
      res.status(400).json({ error: "Missing token." });
      return;
    }
    const updated = consumeAccountUsage(targetToken, {
      elapsedSeconds: typeof elapsedSeconds === "number" ? elapsedSeconds : 0,
    });
    if (!updated) {
      res.status(404).json({
        error: "This token has been revoked or deleted by the administrator.",
        revoked: true,
      });
      return;
    }
    res.json({ ok: true, quota: updated });
  });

  app.post("/api/session/start", (_req, res) => {
    if (!activeToken || !activeToken.authenticated) {
      res.status(401).json({
        error: "Authenticate your Crackpilot software token first.",
      });
      return;
    }
    const acc = findAccountByToken(activeToken.token);
    if (acc) {
      const quota = buildQuotaSnapshot(acc);
      if (quota.blockedReason) {
        res.status(403).json({ error: quota.blockedReason, quota });
        return;
      }
    }
    activeToken = { ...activeToken, sessionActive: true };
    const tokenPayload = {
      ...activeToken,
      quota: acc ? buildQuotaSnapshot(acc) : undefined,
    };
    broadcastEvent({
      type: "session_started",
      token: tokenPayload,
      profile: activeProfile,
    });
    res.json({ ok: true, token: tokenPayload, profile: activeProfile });
  });

  app.post("/api/session/stop", (_req, res) => {
    if (activeToken) {
      activeToken = { ...activeToken, sessionActive: false };
    }
    broadcastEvent({ type: "session_stopped" });
    res.json({ ok: true });
  });

  // =========================================================================
  // Hidden Owner-Only Super-Admin API (/api/admin/*)
  // =========================================================================
  app.get("/api/admin/auth/status", (req, res) => {
    const config = getAdminAuthConfigStatus();
    const admin = getAuthenticatedAdmin(req);
    res.setHeader("Cache-Control", "no-store");
    res.json({
      authenticated: Boolean(admin),
      subject: admin?.subject ?? null,
      ...config,
    });
  });

  app.post("/api/admin/auth/setup", (req, res) => {
    if (!verifyAdminCsrf(req, res)) return;
    const { identifier, password } = req.body as {
      identifier?: string;
      password?: string;
    };
    const claim = claimFirstRunAdmin({
      identifier: String(identifier || ""),
      password: String(password || ""),
    });
    if (!claim.ok) {
      res.status(claim.status).json({ error: claim.error });
      return;
    }
    const jwt = signAdminSessionToken(claim.email);
    res.setHeader("Set-Cookie", buildAdminSetCookieHeader(jwt));
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, authenticated: true, subject: claim.email });
  });

  app.post("/api/admin/auth/login", (req, res) => {
    if (!verifyAdminCsrf(req, res)) return;
    const { identifier, password } = req.body as {
      identifier?: string;
      password?: string;
    };
    const result = verifyAdminCredentials(
      String(identifier || ""),
      String(password || "")
    );
    if (!result.valid) {
      res.status(401).json({ error: "Invalid Super-Admin email/username or password." });
      return;
    }
    const jwt = signAdminSessionToken(result.subject);
    res.setHeader("Set-Cookie", buildAdminSetCookieHeader(jwt));
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, authenticated: true, subject: result.subject });
  });

  app.post("/api/admin/auth/logout", (req, res) => {
    if (!verifyAdminCsrf(req, res)) return;
    res.setHeader("Set-Cookie", buildAdminClearCookieHeader());
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true });
  });

  app.get("/api/admin/accounts", requireAdminAuth, (req, res) => {
    const search = String(req.query.search || "");
    const rawFilter = String(req.query.filter || "all");
    const allowedFilters = ["all", "paid", "pending", "active", "demo", "expired"] as const;
    const filter = (allowedFilters as readonly string[]).includes(rawFilter)
      ? (rawFilter as (typeof allowedFilters)[number])
      : "all";

    const filtered = listAllAccounts({ search, filter });
    const stats = computeAdminStats();

    res.setHeader("Cache-Control", "no-store");
    res.json({
      ok: true,
      accounts: filtered,
      stats,
    });
  });

  // Create New User ID (with Full Name, Email, Password, Plan Type, Minutes, Quota, Payment Status)
  app.post("/api/admin/accounts", requireAdminAuth, (req, res) => {
    if (!verifyAdminCsrf(req, res)) return;
    const {
      label,
      email,
      password,
      planType,
      paymentStatus,
      minutes,
      captureLimit,
      promptLimit,
      expiryHours,
      notes,
    } = req.body as {
      label?: string;
      email?: string;
      password?: string;
      planType?: PlanType;
      paymentStatus?: PaymentStatus;
      minutes?: number;
      captureLimit?: number;
      promptLimit?: number;
      expiryHours?: number | null;
      notes?: string;
    };

    const cleanLabel = String(label || "").trim();
    if (!cleanLabel) {
      res.status(400).json({ error: "Full Name is required." });
      return;
    }

    const validPlan: PlanType =
      planType === "Demo" ||
      planType === "Starter" ||
      planType === "Pro Plan" ||
      planType === "Unlimited"
        ? planType
        : "Pro Plan";
    const validPayment: PaymentStatus = paymentStatus === "Paid" ? "Paid" : "Pending";
    const isDemo = validPlan === "Demo";

    const { account, generatedPassword } = createManagedAccount({
      label: cleanLabel,
      email: typeof email === "string" ? email : "",
      password: typeof password === "string" ? password : "",
      accountType: isDemo ? "DEMO" : "REGULAR",
      planType: validPlan,
      paymentStatus: validPayment,
      minutes: Number(minutes) > 0 ? Number(minutes) : isDemo ? 30 : 240,
      captureLimit: Number(captureLimit) > 0 ? Number(captureLimit) : isDemo ? 15 : 80,
      promptLimit: Number(promptLimit) > 0 ? Number(promptLimit) : undefined,
      expiryHours:
        expiryHours === null ? 48 : Number(expiryHours) > 0 ? Number(expiryHours) : 48,
      notes: typeof notes === "string" ? notes : undefined,
    });

    res.status(201).json({
      ok: true,
      account,
      generatedPassword,
      quota: buildQuotaSnapshot(account),
    });
  });

  // 1-Click Dummy / Demo ID Generator
  app.post("/api/admin/accounts/demo", requireAdminAuth, (req, res) => {
    if (!verifyAdminCsrf(req, res)) return;
    const {
      label,
      email,
      accountType,
      minutes,
      captureLimit,
      promptLimit,
      expiryHours,
      notes,
    } = req.body as {
      label?: string;
      email?: string;
      accountType?: AccountType;
      minutes?: number;
      captureLimit?: number;
      promptLimit?: number;
      expiryHours?: number | null;
      notes?: string;
    };

    const type: AccountType = accountType === "REGULAR" ? "REGULAR" : "DEMO";
    const cleanLabel =
      String(label || "").trim() ||
      (type === "DEMO"
        ? `Live Demo #${crypto.randomBytes(2).toString("hex").toUpperCase()}`
        : "New User");

    const { account, generatedPassword } = createManagedAccount({
      label: cleanLabel,
      email: typeof email === "string" ? email : "",
      accountType: type,
      planType: type === "DEMO" ? "Demo" : "Starter",
      paymentStatus: "Pending",
      minutes: Number(minutes) > 0 ? Number(minutes) : 30,
      captureLimit: Number(captureLimit) > 0 ? Number(captureLimit) : 15,
      promptLimit: promptLimit ? Number(promptLimit) : undefined,
      expiryHours:
        expiryHours === null ? 48 : Number(expiryHours) > 0 ? Number(expiryHours) : 24,
      notes: typeof notes === "string" ? notes : undefined,
    });

    res.status(201).json({
      ok: true,
      account,
      generatedPassword,
      quota: buildQuotaSnapshot(account),
    });
  });

  app.patch("/api/admin/accounts/:token/status", requireAdminAuth, (req, res) => {
    if (!verifyAdminCsrf(req, res)) return;
    const { status } = req.body as { status?: AccountStatus };
    if (status !== "Active" && status !== "Suspended" && status !== "Expired") {
      res.status(400).json({ error: "Status must be Active, Suspended, or Expired." });
      return;
    }
    const updated = updateAccountStatus(req.params.token, status);
    if (!updated) {
      res.status(404).json({ error: "Account token not found." });
      return;
    }
    const quota = buildQuotaSnapshot(updated);
    broadcastEvent({ type: "quota_updated", tokenValue: updated.token, quota });
    res.json({ ok: true, account: updated, quota });
  });

  app.patch("/api/admin/accounts/:token/payment", requireAdminAuth, (req, res) => {
    if (!verifyAdminCsrf(req, res)) return;
    const { paymentStatus } = req.body as { paymentStatus?: PaymentStatus };
    if (paymentStatus !== "Paid" && paymentStatus !== "Pending") {
      res.status(400).json({ error: "paymentStatus must be Paid or Pending." });
      return;
    }
    const updated = updateAccountPaymentStatus(req.params.token, paymentStatus);
    if (!updated) {
      res.status(404).json({ error: "Account token not found." });
      return;
    }
    const quota = buildQuotaSnapshot(updated);
    broadcastEvent({ type: "quota_updated", tokenValue: updated.token, quota });
    res.json({ ok: true, account: updated, quota });
  });

  app.post("/api/admin/accounts/:token/quotas", requireAdminAuth, (req, res) => {
    if (!verifyAdminCsrf(req, res)) return;
    const {
      deltaMinutes,
      deltaCaptures,
      deltaPrompts,
      resetUsed,
      extendExpiryHours,
    } = req.body as {
      deltaMinutes?: number;
      deltaCaptures?: number;
      deltaPrompts?: number;
      resetUsed?: boolean;
      extendExpiryHours?: number;
    };

    const updated = adjustAccountQuotas(req.params.token, {
      deltaMinutes: typeof deltaMinutes === "number" ? deltaMinutes : undefined,
      deltaCaptures: typeof deltaCaptures === "number" ? deltaCaptures : undefined,
      deltaPrompts: typeof deltaPrompts === "number" ? deltaPrompts : undefined,
      resetUsed: Boolean(resetUsed),
      extendExpiryHours:
        typeof extendExpiryHours === "number" ? extendExpiryHours : undefined,
    });

    if (!updated) {
      res.status(404).json({ error: "Account token not found." });
      return;
    }

    const quota = buildQuotaSnapshot(updated);
    broadcastEvent({ type: "quota_updated", tokenValue: updated.token, quota });
    res.json({ ok: true, account: updated, quota });
  });

  app.delete("/api/admin/accounts/:token", requireAdminAuth, (req, res) => {
    if (!verifyAdminCsrf(req, res)) return;
    const targetToken = req.params.token.trim();
    const deleted = deleteAccountByToken(targetToken);
    if (!deleted) {
      res.status(404).json({ error: "Account token not found." });
      return;
    }
    if (activeToken && activeToken.token === targetToken) {
      activeToken = null;
    }
    broadcastEvent({ type: "account_revoked", tokenValue: targetToken });
    res.json({ ok: true });
  });

  // Target Profile, Resume & JD Routes
  app.get("/api/profile", (_req, res) => {
    res.json({ profile: activeProfile });
  });

  app.post("/api/profile", (req, res) => {
    const patch = req.body as Partial<StoredProfile>;
    activeProfile = {
      ...activeProfile,
      role: patch.role ?? activeProfile.role,
      experience: patch.experience ?? activeProfile.experience,
      skills: patch.skills ?? activeProfile.skills,
      resumeFileName: patch.resumeFileName ?? activeProfile.resumeFileName,
      resumeText: patch.resumeText ?? activeProfile.resumeText,
      jdFileName: patch.jdFileName ?? activeProfile.jdFileName,
      jdText: patch.jdText ?? activeProfile.jdText,
      answerLanguage: patch.answerLanguage ?? activeProfile.answerLanguage,
      answerStyle:
        patch.answerStyle !== undefined
          ? normalizeAnswerStyle(patch.answerStyle)
          : activeProfile.answerStyle,
      dsaModeEnabled:
        typeof patch.dsaModeEnabled === "boolean"
          ? patch.dsaModeEnabled
          : activeProfile.dsaModeEnabled,
      preferredLanguage:
        patch.preferredLanguage !== undefined
          ? normalizeProgrammingLanguage(patch.preferredLanguage)
          : activeProfile.preferredLanguage,
      updatedAt: new Date().toISOString(),
    };
    broadcastEvent({ type: "profile_updated", profile: activeProfile });
    res.json({ ok: true, profile: activeProfile });
  });

  // Persistent DSA Coding & Assessment Context Routes
  app.get("/api/dsa/context", (_req, res) => {
    res.json({ ok: true, activeProblemContext });
  });

  app.post("/api/dsa/context/clear", (_req, res) => {
    activeProblemContext = null;
    broadcastEvent({ type: "dsa_problem_cleared" });
    res.json({ ok: true });
  });

  app.post("/api/dsa/analyze", async (req, res) => {
    try {
      const {
        problemText,
        images,
        preferredLanguage,
        answerLanguage,
        role,
        experience,
        source,
        assessmentTypeOverride,
        oaQuestionKindOverride,
      } = req.body as {
        problemText?: string;
        images?: Array<{ data: string; mimeType: string }>;
        preferredLanguage?: string;
        answerLanguage?: string;
        role?: string;
        experience?: string;
        source?: ActiveProblemContext["source"];
        assessmentTypeOverride?: DsaAssessmentType;
        oaQuestionKindOverride?: OaQuestionKind;
      };

      if (
        (!problemText || !problemText.trim()) &&
        (!Array.isArray(images) || images.length === 0)
      ) {
        res.status(400).json({
          error: "Provide either problemText or captured screen images.",
        });
        return;
      }

      const dsaData = await analyzeDsaProblem({
        problemText,
        images,
        preferredLanguage: preferredLanguage || activeProfile.preferredLanguage,
        answerLanguage: answerLanguage || activeProfile.answerLanguage,
        role: role || activeProfile.role,
        experience: experience || activeProfile.experience,
        source: source || "text_simulator",
        assessmentTypeOverride,
        oaQuestionKindOverride,
      });

      activeProblemContext = dsaData.problemContext;
      broadcastEvent({
        type: "dsa_problem_updated",
        activeProblemContext,
      });

      res.json({
        ok: true,
        dsaData,
        activeProblemContext,
        summaryMarkdown: buildDsaAnalysisSummaryMarkdown(dsaData),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "DSA analysis failed.";
      console.error("[/api/dsa/analyze]", message);
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/profile/extract", async (req, res) => {
    try {
      const { fileBase64, mimeType, fileName, kind } = req.body as {
        fileBase64?: string;
        mimeType?: string;
        fileName?: string;
        kind?: "resume" | "jd";
      };

      if (!fileBase64) {
        res.status(400).json({ error: "Missing file content." });
        return;
      }

      const lower = (fileName || "").toLowerCase();
      if (
        mimeType?.startsWith("text/") ||
        lower.endsWith(".txt") ||
        lower.endsWith(".md") ||
        lower.endsWith(".json")
      ) {
        const text = Buffer.from(fileBase64, "base64").toString("utf-8").trim();
        res.json({ ok: true, text });
        return;
      }

      // Extract clean text from PDF / image resumes or JDs via Gemini multimodal
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType || "application/pdf",
                data: fileBase64,
              },
            },
            {
              text:
                kind === "jd"
                  ? "Extract all text from this Job Description cleanly as plain structured text (role, responsibilities, required skills, qualifications). Return only the extracted text."
                  : "Extract all text from this candidate Resume cleanly as plain structured text (summary, skills, work experience, projects, achievements, education). Return only the extracted text.",
            },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      res.json({ ok: true, text: (response.text || "").trim() });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not extract file text.";
      res.status(500).json({ error: message });
    }
  });

  // Live SSE Event Stream (syncs Dashboard Start Session, Profile updates, and Python loopback audio)
  app.get("/api/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.write(
      `data: ${JSON.stringify({
        type: "connected",
        token: activeToken,
        profile: activeProfile,
        activeProblemContext,
      })}\n\n`
    );
    sseClients.add(res);
    req.on("close", () => {
      sseClients.delete(res);
    });
  });

  // Audio Transcription (raw binary audio/wav or base64 JSON; strictly English-locked Deepgram Nova-3 + keyterms -> Groq Whisper -> OpenAI -> Gemini)
  app.post(
    "/api/transcribe",
    express.raw({ type: "audio/*", limit: "15mb" }),
    async (req, res) => {
      try {
        const cleanEnv = (k: string) => {
          const v = (process.env[k] || "").trim().replace(/^['"]|['"]$/g, "");
          return v && !/your_|placeholder/i.test(v) ? v : "";
        };

        let audioBuffer: Buffer;
        let cleanMime = "audio/wav";
        let language: string | undefined;
        let profileCtx: TranscribeProfileContext = {
          role: activeProfile.role,
          experience: activeProfile.experience,
          skills: activeProfile.skills,
          jdText: activeProfile.jdText,
        };

        const reqContentType = String(req.headers["content-type"] || "").toLowerCase();
        if (Buffer.isBuffer(req.body)) {
          audioBuffer = req.body;
          cleanMime = reqContentType.split(";")[0].trim() || "audio/wav";
          language =
            typeof req.query.language === "string"
              ? req.query.language
              : undefined;
          if (typeof req.query.role === "string" && req.query.role.trim()) {
            profileCtx.role = req.query.role.trim();
          }
        } else {
          const {
            audioBase64,
            mimeType,
            language: bodyLang,
            role,
            experience,
            skills,
            jdText,
          } = (req.body || {}) as {
            audioBase64?: string;
            mimeType?: string;
            language?: string;
            role?: string;
            experience?: string;
            skills?: string;
            jdText?: string;
          };

          if (!audioBase64) {
            res.status(400).json({ error: "Missing audio payload." });
            return;
          }
          audioBuffer = Buffer.from(audioBase64, "base64");
          cleanMime =
            (mimeType || "audio/wav").split(";")[0].trim() || "audio/wav";
          language = bodyLang;
          profileCtx = {
            role: role || activeProfile.role,
            experience: experience || activeProfile.experience,
            skills: skills || activeProfile.skills,
            jdText: jdText || activeProfile.jdText,
          };
        }

        const isValidWav =
          audioBuffer.length >= 44 &&
          audioBuffer.subarray(0, 4).toString("ascii") === "RIFF" &&
          audioBuffer.subarray(8, 12).toString("ascii") === "WAVE";

        // Skip tiny/empty buffers (< 0.4s) cleanly
        if (
          audioBuffer.length < 3200 ||
          (cleanMime === "audio/wav" &&
            (!isValidWav || audioBuffer.length < 44 + 12800))
        ) {
          res.json({ text: "", skipped: true });
          return;
        }

        const dgKey = cleanEnv("DEEPGRAM_API_KEY");
        const groqKey = cleanEnv("GROQ_API_KEY");
        const geminiKey = cleanEnv("GEMINI_API_KEY");
        const errors: string[] = [];

        // Tier 1: Deepgram Nova-3 (strictly English en-IN -> en + technical keyterms)
        if (dgKey) {
          try {
            const { text, language: matchedLang } =
              await transcribeWithDeepgramEnglish(audioBuffer, cleanMime, dgKey);
            res.json({
              text,
              engine: "deepgram",
              model: "nova-3",
              language: matchedLang,
            });
            return;
          } catch (dgErr) {
            const msg = dgErr instanceof Error ? dgErr.message : String(dgErr);
            console.warn("[/api/transcribe] Deepgram failed, falling back:", msg);
            errors.push(msg);
          }
        }

        // Tier 2: Groq Whisper fallback (whisper-large-v3-turbo, locked English + tech prompt)
        if (groqKey) {
          try {
            const text = await transcribeWithGroqWhisperEnglish(
              audioBuffer,
              cleanMime,
              groqKey
            );
            res.json({
              text,
              engine: "groq-whisper",
              model: "whisper-large-v3-turbo",
              language: "en",
            });
            return;
          } catch (groqErr) {
            const msg =
              groqErr instanceof Error ? groqErr.message : String(groqErr);
            console.warn(
              "[/api/transcribe] Groq Whisper failed, falling back:",
              msg
            );
            errors.push(msg);
          }
        }

        // Tier 3: OpenAI Whisper fallback
        const audioBase64Fallback = audioBuffer.toString("base64");
        if (hasOpenAIKey()) {
          try {
            const text = await transcribeWithOpenAI(
              audioBase64Fallback,
              cleanMime,
              language,
              profileCtx
            );
            res.json({ text, engine: "openai", model: "whisper-1" });
            return;
          } catch (oaiErr) {
            const msg =
              oaiErr instanceof Error ? oaiErr.message : String(oaiErr);
            console.warn(
              "[/api/transcribe] OpenAI Whisper failed, falling back:",
              msg
            );
            errors.push(msg);
          }
        }

        // Tier 4: Gemini fallback
        if (geminiKey) {
          const text = await transcribeWithGemini(
            audioBase64Fallback,
            cleanMime,
            language,
            profileCtx
          );
          res.json({ text, engine: "gemini", model: "gemini-3.5-transcribe" });
          return;
        }

        res.status(502).json({
          error:
            errors[errors.length - 1] ||
            "No transcription provider configured (add DEEPGRAM_API_KEY, GROQ_API_KEY, or GEMINI_API_KEY).",
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Audio transcription failed.";
        console.error("[/api/transcribe]", message);
        res.status(500).json({ error: message });
      }
    }
  );

  // Shared sub-second SSE streaming interview answer handler (mounted on both /api/incoming-question and /api/answer)
  const handleStreamingInterviewAnswer = async (
    req: express.Request,
    res: express.Response
  ) => {
    const bodyObj = (req.body || {}) as {
      broadcastOnly?: boolean;
      source?: string;
      question?: string;
    };
    if (bodyObj.broadcastOnly && bodyObj.question?.trim()) {
      broadcastEvent({
        type: "incoming_question",
        question: bodyObj.question.trim(),
        source: bodyObj.source || "system-audio",
        timestamp: new Date().toISOString(),
      });
      res.json({ ok: true, deliveredTo: sseClients.size });
      return;
    }

    const {
      token,
      question,
      role,
      experience,
      skills,
      resumeText,
      jdText,
      answerLanguage,
      answerStyle,
      fastMode,
      dsaModeEnabled,
      preferredLanguage,
      activeProblemContext: reqProblemContext,
      history = [],
    } = req.body as {
      token?: string;
      question?: string;
      role?: string;
      experience?: string;
      skills?: string;
      resumeText?: string;
      jdText?: string;
      answerLanguage?: string;
      answerStyle?: string;
      fastMode?: boolean;
      dsaModeEnabled?: boolean;
      preferredLanguage?: string;
      activeProblemContext?: ActiveProblemContext | null;
      history?: Array<{ question: string; answer: string }>;
    };

    if (!question || !question.trim()) {
      res.status(400).json({ error: "Question text is required." });
      return;
    }

    const effectiveToken = (token || activeToken?.token || "").trim();
    const quotaCheck = checkQuotaForAction(effectiveToken, "answer");
    if (!quotaCheck.allowed) {
      res.status(403).json({ error: quotaCheck.reason, quota: quotaCheck.quota });
      return;
    }
    if (effectiveToken && quotaCheck.account) {
      const updatedQuota = consumeAccountUsage(effectiveToken, { addPrompts: 1 });
      if (updatedQuota) {
        broadcastEvent({
          type: "quota_updated",
          tokenValue: effectiveToken,
          quota: updatedQuota,
        });
      }
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const sendEvent = (payload: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const effectiveDsaMode =
      typeof dsaModeEnabled === "boolean"
        ? dsaModeEnabled
        : activeProfile.dsaModeEnabled;
    const boundProblem =
      reqProblemContext !== undefined ? reqProblemContext : activeProblemContext;
    const effectiveProgLang = normalizeProgrammingLanguage(
      preferredLanguage ||
        boundProblem?.preferredLanguage ||
        activeProfile.preferredLanguage
    );

    const isDsaFollowUp = Boolean(effectiveDsaMode && boundProblem);

    const isCodeReq = !isDsaFollowUp && isCodeCreationRequest(question);

    const systemPrompt = isDsaFollowUp
      ? buildDsaFollowUpSystemPrompt({
          problemContext: boundProblem!,
          preferredLanguage: effectiveProgLang,
          answerLanguage: answerLanguage || activeProfile.answerLanguage,
          role: role || activeProfile.role,
          experience: experience || activeProfile.experience,
        })
      : buildInterviewSystemPrompt({
          role,
          experience,
          skills,
          resumeText,
          jdText,
          answerLanguage,
          answerStyle,
          fastMode: Boolean(fastMode),
          question: question.trim(),
        });

    const recentContext =
      Array.isArray(history) && history.length > 0
        ? history
            .slice(-3)
            .map(
              (item, idx) =>
                `Previous Q${idx + 1}: ${item.question}\nPrevious A${idx + 1}: ${item.answer.slice(0, 350)}`
            )
            .join("\n\n")
        : "";

    const userPrompt = isDsaFollowUp
      ? recentContext
        ? `Recent coding discussion:\n${recentContext}\n\nInterviewer's live follow-up question on the current problem (${boundProblem!.title}):\n"${question.trim()}"\n\nAnswer directly with natural spoken guidance, updated ${effectiveProgLang} code, and updated Time/Space complexity.`
        : `Interviewer's live follow-up question on the current problem (${boundProblem!.title}):\n"${question.trim()}"\n\nAnswer directly with natural spoken guidance, updated ${effectiveProgLang} code, and updated Time/Space complexity.`
      : isCodeReq
        ? recentContext
          ? `Recent interview context:\n${recentContext}\n\nInterviewer just asked:\n"${question.trim()}"\n\nRespond strictly in two parts: (1) one crisp 3-4 sentence first-person developer summary paragraph with backticked identifiers and zero AI filler, immediately followed by (2) one complete runnable fenced code block with the exact language tag. Output zero text after the code block.`
          : `Interviewer just asked:\n"${question.trim()}"\n\nRespond strictly in two parts: (1) one crisp 3-4 sentence first-person developer summary paragraph with backticked identifiers and zero AI filler, immediately followed by (2) one complete runnable fenced code block with the exact language tag. Output zero text after the code block.`
        : recentContext
          ? `Recent interview context:\n${recentContext}\n\nInterviewer just asked:\n"${question.trim()}"\n\nAnswer directly in natural human spoken language matching the exact Answer Style rules.`
          : `Interviewer just asked:\n"${question.trim()}"\n\nAnswer directly in natural human spoken language matching the exact Answer Style rules.`;

    let streamedAnyChunk = false;
    const groqKey = (process.env.GROQ_API_KEY || "")
      .trim()
      .replace(/^['"]|['"]$/g, "");
    const validGroqKey =
      groqKey && !/your_|placeholder/i.test(groqKey) ? groqKey : "";

    // Pipeline A: Groq with dynamic active chat model lookup
    if (validGroqKey) {
      try {
        const { emittedChars } = await streamGroqChatCompletion({
          apiKey: validGroqKey,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.35,
          maxTokens: 1400,
          onMeta: (model) => {
            sendEvent({ meta: { engine: "groq", model } });
          },
          onDelta: (delta) => {
            streamedAnyChunk = true;
            sendEvent({ chunk: delta, text: delta });
          },
        });
        if (emittedChars > 0) {
          sendEvent({ done: true });
          res.end();
          return;
        }
      } catch (groqErr) {
        console.warn(
          "[/api/answer] Groq failed, silently falling back to next provider:",
          groqErr instanceof Error ? groqErr.message : String(groqErr)
        );
        if (streamedAnyChunk) {
          sendEvent({ done: true });
          res.end();
          return;
        }
      }
    }

    // Priority 2: OpenAI (if configured)
    if (hasOpenAIKey()) {
      try {
        const openaiRes = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              stream: true,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
            }),
          }
        );

        if (!openaiRes.ok || !openaiRes.body) {
          const errText = await openaiRes.text().catch(() => "");
          throw new Error(
            `OpenAI Chat error (${openaiRes.status}): ${errText.slice(0, 140)}`
          );
        }

        const reader = openaiRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let metaSent = false;
        let emittedChars = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(dataStr) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                if (!metaSent) {
                  metaSent = true;
                  sendEvent({ meta: { engine: "openai", model: "gpt-4o-mini" } });
                }
                emittedChars += delta.length;
                streamedAnyChunk = true;
                sendEvent({ chunk: delta, text: delta });
              }
            } catch {
              // Ignore incomplete fragments
            }
          }
        }

        if (emittedChars > 0) {
          sendEvent({ done: true });
          res.end();
          return;
        }
      } catch (openaiErr) {
        console.warn(
          "[/api/answer] OpenAI failed, silently falling back to Gemini:",
          openaiErr instanceof Error ? openaiErr.message : String(openaiErr)
        );
        if (streamedAnyChunk) {
          sendEvent({ done: true });
          res.end();
          return;
        }
      }
    }

    // Pipeline B (Mandatory Silent Fallback): Gemini
    try {
      const { model, stream } = await generateContentStreamResilient({
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
      sendEvent({ meta: { engine: "gemini", model } });

      for await (const chunk of stream) {
        if (chunk.text) {
          streamedAnyChunk = true;
          sendEvent({ chunk: chunk.text, text: chunk.text });
        }
      }
      sendEvent({ done: true });
      res.end();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to generate answer.";
      console.error("[/api/answer] All answer providers failed:", message);
      if (streamedAnyChunk) {
        sendEvent({ done: true });
        res.end();
        return;
      }
      sendEvent({
        error:
          "AI answer service is temporarily unavailable. Please verify your GROQ_API_KEY or GEMINI_API_KEY and try again.",
      });
      res.end();
    }
  };

  app.post("/api/answer", handleStreamingInterviewAnswer);
  app.post("/api/incoming-question", handleStreamingInterviewAnswer);
  app.get("/api/incoming-question", (_req, res) => {
    res.json({
      ok: true,
      endpoint: "/api/incoming-question",
      streaming: true,
      ready: true,
    });
  });

  // Screen & Chat Box Capture Solver (supports both standard mode & DSA Coding / OA Teleprompter)
  app.post("/api/analyze-screen", async (req, res) => {
    const {
      token,
      imageBase64,
      mimeType = "image/jpeg",
      role,
      answerLanguage,
      answerStyle,
      dsaModeEnabled,
      preferredLanguage,
      source = "alt_s",
    } = req.body as {
      token?: string;
      imageBase64?: string;
      mimeType?: string;
      role?: string;
      answerLanguage?: string;
      answerStyle?: string;
      dsaModeEnabled?: boolean;
      preferredLanguage?: string;
      source?: ActiveProblemContext["source"];
    };

    if (!imageBase64) {
      res.status(400).json({ error: "Missing imageBase64 payload." });
      return;
    }

    const effectiveToken = (token || activeToken?.token || "").trim();
    const quotaCheck = checkQuotaForAction(effectiveToken, "capture");
    if (!quotaCheck.allowed) {
      res.status(403).json({ error: quotaCheck.reason, quota: quotaCheck.quota });
      return;
    }
    if (effectiveToken && quotaCheck.account) {
      const updatedQuota = consumeAccountUsage(effectiveToken, {
        addCaptures: 1,
        addPrompts: 1,
      });
      if (updatedQuota) {
        broadcastEvent({
          type: "quota_updated",
          tokenValue: effectiveToken,
          quota: updatedQuota,
        });
      }
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    const sendEvent = (payload: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const effectiveDsaMode =
      typeof dsaModeEnabled === "boolean"
        ? dsaModeEnabled
        : activeProfile.dsaModeEnabled;

    if (effectiveDsaMode) {
      try {
        sendEvent({ meta: { engine: "gemini", model: "gemini-4-hydrogen (DSA Mode)" } });
        const dsaData = await analyzeDsaProblem({
          images: [{ data: imageBase64, mimeType }],
          preferredLanguage: preferredLanguage || activeProfile.preferredLanguage,
          answerLanguage: answerLanguage || activeProfile.answerLanguage,
          role: role || activeProfile.role,
          experience: activeProfile.experience,
          source,
        });
        activeProblemContext = dsaData.problemContext;
        broadcastEvent({
          type: "dsa_problem_updated",
          activeProblemContext,
        });
        sendEvent({
          dsaData,
          chunk: buildDsaAnalysisSummaryMarkdown(dsaData),
        });
        sendEvent({ done: true });
        res.end();
        return;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "DSA screen analysis failed.";
        console.error("[/api/analyze-screen DSA]", message);
        sendEvent({ error: message });
        res.end();
        return;
      }
    }

    const systemPrompt = buildInterviewSystemPrompt({
      role,
      answerLanguage,
      answerStyle,
    });

    const userInstruction =
      "Inspect this captured screen image carefully. Find any question visible in a chat box, meeting chat, coding editor, assessment page, slide, or browser window. Give a direct, natural human-spoken answer matching the Answer Style rules.";

    try {
      if (hasOpenAIKey()) {
        sendEvent({ meta: { engine: "openai", model: "gpt-4o-mini" } });
        const openaiRes = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              stream: true,
              messages: [
                { role: "system", content: systemPrompt },
                {
                  role: "user",
                  content: [
                    { type: "text", text: userInstruction },
                    {
                      type: "image_url",
                      image_url: { url: `data:${mimeType};base64,${imageBase64}` },
                    },
                  ],
                },
              ],
            }),
          }
        );

        if (!openaiRes.ok || !openaiRes.body) {
          const errText = await openaiRes.text();
          throw new Error(`OpenAI Vision error (${openaiRes.status}): ${errText}`);
        }

        const reader = openaiRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(dataStr) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) sendEvent({ chunk: delta });
            } catch {
              // Ignore partial chunks
            }
          }
        }
        sendEvent({ done: true });
        res.end();
        return;
      }

      const { model, stream } = await generateContentStreamResilient({
        contents: {
          parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            { text: userInstruction },
          ],
        },
        config: {
          systemInstruction: systemPrompt,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
      sendEvent({ meta: { engine: "gemini", model } });

      for await (const chunk of stream) {
        if (chunk.text) sendEvent({ chunk: chunk.text });
      }
      sendEvent({ done: true });
      res.end();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Screen analysis failed.";
      console.error("[/api/analyze-screen]", message);
      sendEvent({ error: message });
      res.end();
    }
  });

  // Multi-frame 4s–10s Video Page Scanner (supports standard mode & DSA Coding / OA Teleprompter)
  app.post("/api/analyze-video", async (req, res) => {
    const {
      token,
      frames = [],
      mimeType = "image/jpeg",
      durationSec = 4,
      role,
      answerLanguage,
      answerStyle,
      dsaModeEnabled,
      preferredLanguage,
    } = req.body as {
      token?: string;
      frames?: string[];
      mimeType?: string;
      durationSec?: number;
      role?: string;
      answerLanguage?: string;
      answerStyle?: string;
      dsaModeEnabled?: boolean;
      preferredLanguage?: string;
    };

    if (!Array.isArray(frames) || frames.length === 0) {
      res.status(400).json({ error: "No video frames captured." });
      return;
    }

    const effectiveToken = (token || activeToken?.token || "").trim();
    const quotaCheck = checkQuotaForAction(effectiveToken, "capture");
    if (!quotaCheck.allowed) {
      res.status(403).json({ error: quotaCheck.reason, quota: quotaCheck.quota });
      return;
    }
    if (effectiveToken && quotaCheck.account) {
      const updatedQuota = consumeAccountUsage(effectiveToken, {
        addCaptures: 1,
        addPrompts: 1,
      });
      if (updatedQuota) {
        broadcastEvent({
          type: "quota_updated",
          tokenValue: effectiveToken,
          quota: updatedQuota,
        });
      }
    }

    const boundedFrames = frames.slice(0, 8);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    const sendEvent = (payload: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const effectiveDsaMode =
      typeof dsaModeEnabled === "boolean"
        ? dsaModeEnabled
        : activeProfile.dsaModeEnabled;

    if (effectiveDsaMode) {
      try {
        sendEvent({ meta: { engine: "gemini", model: "gemini-4-hydrogen (DSA Video)" } });
        const dsaData = await analyzeDsaProblem({
          images: boundedFrames.map((data) => ({ data, mimeType })),
          preferredLanguage: preferredLanguage || activeProfile.preferredLanguage,
          answerLanguage: answerLanguage || activeProfile.answerLanguage,
          role: role || activeProfile.role,
          experience: activeProfile.experience,
          source: "alt_v",
        });
        activeProblemContext = dsaData.problemContext;
        broadcastEvent({
          type: "dsa_problem_updated",
          activeProblemContext,
        });
        sendEvent({
          dsaData,
          chunk: buildDsaAnalysisSummaryMarkdown(dsaData),
        });
        sendEvent({ done: true });
        res.end();
        return;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "DSA video analysis failed.";
        console.error("[/api/analyze-video DSA]", message);
        sendEvent({ error: message });
        res.end();
        return;
      }
    }

    const systemPrompt = buildInterviewSystemPrompt({
      role,
      answerLanguage,
      answerStyle,
    });

    const userInstruction = `These ${boundedFrames.length} sequential frames were recorded over a ${durationSec}-second screen video scan of a webpage/chat. Inspect ALL frames, deduplicate overlapping content, identify every distinct question visible across the page, and provide clear, natural human-spoken answers in order.`;

    try {
      if (hasOpenAIKey()) {
        sendEvent({ meta: { engine: "openai", model: "gpt-4o-mini" } });
        const contentParts = [
          { type: "text", text: userInstruction },
          ...boundedFrames.map((b64) => ({
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${b64}` },
          })),
        ];
        const openaiRes = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              stream: true,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: contentParts },
              ],
            }),
          }
        );
        if (!openaiRes.ok || !openaiRes.body) {
          const errText = await openaiRes.text();
          throw new Error(`OpenAI Video Scan error (${openaiRes.status}): ${errText}`);
        }
        const reader = openaiRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(dataStr) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) sendEvent({ chunk: delta });
            } catch {
              // Ignore partial chunks
            }
          }
        }
        sendEvent({ done: true });
        res.end();
        return;
      }

      const { model, stream } = await generateContentStreamResilient({
        contents: {
          parts: [
            ...boundedFrames.map((b64) => ({
              inlineData: { mimeType, data: b64 },
            })),
            { text: userInstruction },
          ],
        },
        config: {
          systemInstruction: systemPrompt,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
      sendEvent({ meta: { engine: "gemini", model } });

      for await (const chunk of stream) {
        if (chunk.text) sendEvent({ chunk: chunk.text });
      }
      sendEvent({ done: true });
      res.end();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Video page scan failed.";
      console.error("[/api/analyze-video]", message);
      sendEvent({ error: message });
      res.end();
    }
  });

  // Native 64-bit Windows Crackpilot-Setup.exe Download (dynamically patched with live app origin)
  app.get("/api/download/crackpilot.exe", (req, res) => {
    const candidates = [
      path.resolve(__dirname, "public/downloads/Crackpilot-Setup.exe"),
      path.resolve(__dirname, "dist/downloads/Crackpilot-Setup.exe"),
    ];
    const exePath = candidates.find((p) => fs.existsSync(p));
    if (!exePath) {
      res.status(404).json({ error: "Crackpilot-Setup.exe not found on server." });
      return;
    }

    const raw = Buffer.from(fs.readFileSync(exePath));
    const marker = Buffer.from("CRACKPILOT_URL_SLOT_BEGIN_", "ascii");
    const slotOffset = raw.indexOf(marker);

    if (slotOffset !== -1) {
      const forwardedProto = (req.headers["x-forwarded-proto"] as string | undefined)
        ?.split(",")[0]
        ?.trim();
      const proto = forwardedProto || req.protocol || "https";
      const host = req.get("host");
      const baseOrigin = host
        ? `${proto}://${host}`
        : (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
      const targetUrl = `${baseOrigin}/?mode=software`;

      const valueStart = slotOffset + marker.length;
      const maxLen = 255 - marker.length;
      const clipped = targetUrl.slice(0, maxLen);
      raw.fill("_".charCodeAt(0), valueStart, valueStart + maxLen);
      raw.write(clipped, valueStart, "ascii");
    }

    res.setHeader("Content-Type", "application/vnd.microsoft.portable-executable");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="Crackpilot-Setup.exe"'
    );
    res.setHeader("Cache-Control", "no-store");
    res.send(raw);
  });

  // Developer export: serves the exact updated source files ZIP for pushing to GitHub
  app.get("/api/export-github-update.zip", (_req, res) => {
    const zipPath = path.resolve(__dirname, "public", "crackpilot-github-update.zip");
    if (!fs.existsSync(zipPath)) {
      res.status(404).json({ error: "Update archive not found." });
      return;
    }
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="crackpilot-github-update.zip"'
    );
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(zipPath);
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const httpServer = http.createServer(app);
  attachLiveQaWebSocketServer(httpServer, {
    getProfile: () => activeProfile,
    getActiveProblem: () => activeProblemContext,
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Crackpilot server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

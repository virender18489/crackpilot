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
  type AccountStatus,
  type AccountType,
  adjustAccountQuotas,
  buildAdminClearCookieHeader,
  buildAdminSetCookieHeader,
  buildQuotaSnapshot,
  checkQuotaForAction,
  claimFirstRunAdmin,
  consumeAccountUsage,
  createManagedAccount,
  deleteAccountByToken,
  findAccountByToken,
  getAdminAuthConfigStatus,
  getAdminCookieName,
  listAllAccounts,
  parseCookieHeader,
  registerRegularToken,
  signAdminSessionToken,
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
  answerStyle: "Concise Bullets" | "STAR Method" | "Technical + Code";
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

let activeProfile: StoredProfile = {
  role: "Frontend Developer (React & TypeScript)",
  experience: "3 years",
  skills: "React, TypeScript, Next.js, Tailwind CSS, Node.js, REST APIs, System Design",
  resumeFileName: "",
  resumeText: "",
  jdFileName: "",
  jdText: "",
  answerLanguage: "English",
  answerStyle: "Concise Bullets",
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
}): string {
  const role = params.role || activeProfile.role;
  const experience = params.experience || activeProfile.experience;
  const skills = params.skills || activeProfile.skills;
  const resumeText = (params.resumeText ?? activeProfile.resumeText).trim();
  const jdText = (params.jdText ?? activeProfile.jdText).trim();
  const answerLanguage = params.answerLanguage || activeProfile.answerLanguage;
  const answerStyle = params.answerStyle || activeProfile.answerStyle;

  const langRule =
    answerLanguage === "Hindi"
      ? "Write the entire answer in clear, natural conversational Hindi (Devanagari script) with standard English technical terms."
      : answerLanguage === "Hinglish"
        ? "Write the answer in natural Hinglish (Hindi written in Roman script mixed with standard English technical terms), suitable for speaking aloud in an Indian tech interview."
        : "Write the answer in crisp, natural spoken English.";

  const styleRule =
    answerStyle === "STAR Method"
      ? "Structure behavioral or scenario answers briefly using Situation, Task, Action, and Result."
      : answerStyle === "Technical + Code"
        ? "Provide sharp technical depth and include a short, clean code snippet or architecture flow whenever the question is technical."
        : "Keep it ultra-concise and scannable so the candidate can glance at the screen and speak smoothly without reading essays.";

  const profileSections: string[] = [
    `Candidate Target Role: ${role}`,
    `Experience Level: ${experience}`,
  ];
  if (skills) {
    profileSections.push(`Core Skills: ${skills}`);
  }
  if (resumeText) {
    profileSections.push(
      `Candidate Resume Context (anchor examples, projects, and metrics directly in this resume whenever relevant):\n${resumeText.slice(0, 4500)}`
    );
  }
  if (jdText) {
    profileSections.push(
      `Target Job Description (align terminology, requirements, and priorities with this JD):\n${jdText.slice(0, 3500)}`
    );
  }

  return [
    "You are Crackpilot, a real-time interview assistant generating personalized, first-person spoken answers for the candidate.",
    langRule,
    styleRule,
    "",
    ...profileSections,
    "",
    "Output format rules (use clean markdown headings, zero filler intros):",
    "### Quick Opener",
    "One short natural first-person sentence the candidate can say immediately.",
    "",
    "### Key Talking Points",
    "3 to 4 crisp, high-impact first-person bullet points tailored to the candidate's target profile, resume, and JD.",
    "",
    "### Example or Code (Only if relevant)",
    "Include a concrete project example from the resume or a short code snippet when helpful.",
  ].join("\n");
}

async function transcribeWithOpenAI(
  audioBase64: string,
  mimeType: string,
  language?: string
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
  language?: string
): Promise<string> {
  const ai = getGeminiClient();
  const cleanMime = (mimeType || "audio/webm").split(";")[0].trim();
  const hint =
    language === "hi"
      ? "Transcribe the spoken interviewer audio accurately in Hindi/Hinglish. Output only the spoken transcript with no timestamps or commentary. If silent, return an empty string."
      : "Transcribe the spoken interviewer audio accurately. Output only the spoken transcript with no timestamps or commentary. If silent, return an empty string.";

  const response = await ai.models.generateContent({
    model: "gemini-3.5-transcribe",
    contents: {
      parts: [
        { inlineData: { mimeType: cleanMime, data: audioBase64 } },
        { text: hint },
      ],
    },
  });

  return (response.text || "").trim();
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
    res.json({ ok: true, ts: Date.now() });
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
    const cleanName =
      (name || cleanEmail.split("@")[0] || "Candidate").trim();
    currentUser = {
      id: "usr-" + crypto.randomBytes(4).toString("hex"),
      name: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
      email: cleanEmail,
    };
    res.json({ ok: true, user: currentUser });
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
    const filter =
      rawFilter === "active" || rawFilter === "demo" || rawFilter === "expired"
        ? rawFilter
        : "all";

    const all = listAllAccounts();
    const filtered = listAllAccounts({ search, filter });

    res.setHeader("Cache-Control", "no-store");
    res.json({
      ok: true,
      accounts: filtered,
      stats: {
        total: all.length,
        active: all.filter((a) => a.status === "Active").length,
        demo: all.filter((a) => a.accountType === "DEMO").length,
        expiredOrSuspended: all.filter(
          (a) => a.status === "Expired" || a.status === "Suspended"
        ).length,
      },
    });
  });

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

    const cleanLabel = String(label || "").trim();
    if (!cleanLabel) {
      res.status(400).json({ error: "Team member / user name is required." });
      return;
    }

    const type: AccountType = accountType === "REGULAR" ? "REGULAR" : "DEMO";
    const created = createManagedAccount({
      label: cleanLabel,
      email: typeof email === "string" ? email : "",
      accountType: type,
      minutes: Number(minutes) || 30,
      captureLimit: Number(captureLimit) || 15,
      promptLimit: promptLimit ? Number(promptLimit) : undefined,
      expiryHours:
        expiryHours === null ? null : Number(expiryHours) > 0 ? Number(expiryHours) : 24,
      notes: typeof notes === "string" ? notes : undefined,
    });

    res.status(201).json({
      ok: true,
      account: created,
      quota: buildQuotaSnapshot(created),
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
      answerStyle: patch.answerStyle ?? activeProfile.answerStyle,
      updatedAt: new Date().toISOString(),
    };
    broadcastEvent({ type: "profile_updated", profile: activeProfile });
    res.json({ ok: true, profile: activeProfile });
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
      })}\n\n`
    );
    sseClients.add(res);
    req.on("close", () => {
      sseClients.delete(res);
    });
  });

  app.post("/api/incoming-question", (req, res) => {
    const { question, source = "system-audio" } = req.body as {
      question?: string;
      source?: string;
    };
    if (!question || !question.trim()) {
      res.status(400).json({ error: "Missing question text." });
      return;
    }
    broadcastEvent({
      type: "incoming_question",
      question: question.trim(),
      source,
      timestamp: new Date().toISOString(),
    });
    res.json({ ok: true, deliveredTo: sseClients.size });
  });

  // Audio Transcription
  app.post("/api/transcribe", async (req, res) => {
    try {
      const { audioBase64, mimeType, language } = req.body as {
        audioBase64?: string;
        mimeType?: string;
        language?: string;
      };

      if (!audioBase64) {
        res.status(400).json({ error: "Missing audioBase64 payload." });
        return;
      }

      const text = hasOpenAIKey()
        ? await transcribeWithOpenAI(audioBase64, mimeType || "audio/webm", language)
        : await transcribeWithGemini(audioBase64, mimeType || "audio/webm", language);

      res.json({
        text,
        engine: hasOpenAIKey() ? "openai" : "gemini",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Audio transcription failed.";
      console.error("[/api/transcribe]", message);
      res.status(500).json({ error: message });
    }
  });

  // Live Streaming Interview Answer (tailored to Target Profile + Resume + JD)
  app.post("/api/answer", async (req, res) => {
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

    const sendEvent = (payload: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const systemPrompt = buildInterviewSystemPrompt({
      role,
      experience,
      skills,
      resumeText,
      jdText,
      answerLanguage,
      answerStyle,
    });

    const recentContext =
      Array.isArray(history) && history.length > 0
        ? history
            .slice(-3)
            .map(
              (item, idx) =>
                `Previous Q${idx + 1}: ${item.question}\nPrevious A${idx + 1}: ${item.answer.slice(0, 300)}`
            )
            .join("\n\n")
        : "";

    const userPrompt = recentContext
      ? `Recent interview context:\n${recentContext}\n\nInterviewer just asked:\n"${question.trim()}"\n\nGenerate the personalized live interview answer now.`
      : `Interviewer just asked:\n"${question.trim()}"\n\nGenerate the personalized live interview answer now.`;

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
                { role: "user", content: userPrompt },
              ],
            }),
          }
        );

        if (!openaiRes.ok || !openaiRes.body) {
          const errText = await openaiRes.text();
          throw new Error(`OpenAI Chat error (${openaiRes.status}): ${errText}`);
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
              // Ignore incomplete fragments
            }
          }
        }
        sendEvent({ done: true });
        res.end();
        return;
      }

      sendEvent({ meta: { engine: "gemini", model: "gemini-4-hydrogen" } });
      const ai = getGeminiClient();
      const stream = await ai.models.generateContentStream({
        model: "gemini-4-hydrogen",
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      for await (const chunk of stream) {
        if (chunk.text) sendEvent({ chunk: chunk.text });
      }
      sendEvent({ done: true });
      res.end();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to generate answer.";
      console.error("[/api/answer]", message);
      sendEvent({ error: message });
      res.end();
    }
  });

  // Screen & Chat Box Capture Solver
  app.post("/api/analyze-screen", async (req, res) => {
    const {
      token,
      imageBase64,
      mimeType = "image/jpeg",
      role,
      answerLanguage,
      answerStyle,
    } = req.body as {
      token?: string;
      imageBase64?: string;
      mimeType?: string;
      role?: string;
      answerLanguage?: string;
      answerStyle?: string;
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

    const systemPrompt = buildInterviewSystemPrompt({
      role,
      answerLanguage,
      answerStyle,
    });

    const userInstruction =
      "Inspect this captured screen image carefully. Find any question visible in a chat box, meeting chat, coding editor, assessment page, slide, or browser window. First state the detected question briefly, then give a direct, accurate, personalized answer (with optimal code & complexity if it is a coding problem).";

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

      sendEvent({ meta: { engine: "gemini", model: "gemini-4-hydrogen" } });
      const ai = getGeminiClient();
      const stream = await ai.models.generateContentStream({
        model: "gemini-4-hydrogen",
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

  // Multi-frame 4s–10s Video Page Scanner
  app.post("/api/analyze-video", async (req, res) => {
    const {
      token,
      frames = [],
      mimeType = "image/jpeg",
      durationSec = 4,
      role,
      answerLanguage,
      answerStyle,
    } = req.body as {
      token?: string;
      frames?: string[];
      mimeType?: string;
      durationSec?: number;
      role?: string;
      answerLanguage?: string;
      answerStyle?: string;
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

    const systemPrompt = buildInterviewSystemPrompt({
      role,
      answerLanguage,
      answerStyle,
    });

    const userInstruction = `These ${boundedFrames.length} sequential frames were recorded over a ${durationSec}-second screen video scan of a webpage/chat. Inspect ALL frames, deduplicate overlapping content, list EVERY distinct question visible across the entire page, and provide a clear, accurate answer for each question numbered sequentially (### Question 1, ### Question 2, etc.).`;

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

      sendEvent({ meta: { engine: "gemini", model: "gemini-4-hydrogen" } });
      const ai = getGeminiClient();
      const stream = await ai.models.generateContentStream({
        model: "gemini-4-hydrogen",
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
  attachLiveQaWebSocketServer(httpServer);

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Crackpilot server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

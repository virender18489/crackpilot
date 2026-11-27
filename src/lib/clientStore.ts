import type {
  AccountQuotaSnapshot,
  ActiveProblemContext,
  DsaAssessmentType,
  DsaTeleprompterData,
  OaQuestionKind,
  SessionTokenState,
  TargetProfile,
  UserAccount,
} from "../types";
import {
  normalizeAnswerStyle,
  normalizeProgrammingLanguage,
} from "../data/roleSkills";
import { apiUrl, isDesktopApp } from "./api";

function normalizeProfileRecord(
  raw: TargetProfile | null | undefined,
  fallback: TargetProfile
): TargetProfile {
  if (!raw) return fallback;
  return {
    ...fallback,
    ...raw,
    answerStyle: normalizeAnswerStyle(raw.answerStyle),
    dsaModeEnabled: Boolean(raw.dsaModeEnabled),
    preferredLanguage: normalizeProgrammingLanguage(raw.preferredLanguage),
  };
}

const STORAGE_KEYS = {
  user: "crackpilot_user_v1",
  token: "crackpilot_token_v1",
  profile: "crackpilot_profile_v1",
} as const;

const SYNC_CHANNEL_NAME = "crackpilot_live_sync_v1";

export interface SyncPayload {
  type?: string;
  user?: UserAccount | null;
  token?: SessionTokenState | null;
  profile?: TargetProfile;
  question?: string;
}

export type ApiJsonResult<T> =
  | { reachable: true; ok: boolean; status: number; data: T }
  | { reachable: false; reason: string; status?: number; contentType?: string };

let cachedBackendHealth: boolean | null = null;
let inflightHealthProbe: Promise<boolean> | null = null;

export function resetBackendHealthCache(): void {
  cachedBackendHealth = null;
  inflightHealthProbe = null;
}

function readStorage<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[Crackpilot Store] Failed to parse localStorage key "${key}":`, err);
    return null;
  }
}

function writeStorage<T>(key: string, value: T | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (err) {
    console.warn(`[Crackpilot Store] Failed to write localStorage key "${key}":`, err);
  }
}

// Strictly clear all persisted software overlay auth tokens so every fresh app/.exe launch
// or Disconnect forces the user through the "Authenticate Crackpilot" screen.
export function clearOverlayAuthStorage(): void {
  if (typeof window === "undefined") return;
  const authKeys = [
    STORAGE_KEYS.token,
    "crackpilot_session_token",
    "crackpilot_auth_token",
    "crackpilot_active_session",
  ];
  for (const key of authKeys) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore storage access errors
    }
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Ignore storage access errors
    }
  }
}

export function broadcastLocalSync(payload: SyncPayload): void {
  if (typeof window === "undefined") return;
  try {
    if ("BroadcastChannel" in window) {
      const ch = new BroadcastChannel(SYNC_CHANNEL_NAME);
      ch.postMessage(payload);
      ch.close();
    }
  } catch (err) {
    console.warn("[Crackpilot Sync] BroadcastChannel post failed:", err);
  }
}

export function subscribeLocalSync(
  handler: (payload: SyncPayload) => void
): () => void {
  if (typeof window === "undefined") return () => {};
  let channel: BroadcastChannel | null = null;
  try {
    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
      channel.onmessage = (ev: MessageEvent<SyncPayload>) => {
        if (ev.data && typeof ev.data === "object") {
          handler(ev.data);
        }
      };
    }
  } catch (err) {
    console.warn("[Crackpilot Sync] BroadcastChannel unavailable:", err);
    channel = null;
  }

  const onStorage = (ev: StorageEvent) => {
    if (ev.key === STORAGE_KEYS.token) {
      handler({ token: readStorage<SessionTokenState>(STORAGE_KEYS.token) });
    } else if (ev.key === STORAGE_KEYS.profile) {
      const profile = readStorage<TargetProfile>(STORAGE_KEYS.profile);
      if (profile) handler({ profile });
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    channel?.close();
    window.removeEventListener("storage", onStorage);
  };
}

function randomHex(len: number): string {
  const chars = "0123456789ABCDEF";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/**
 * Safely fetches JSON from the backend API with a 3.5s timeout and detailed debug logging.
 * Returns `{ reachable: true, ... }` ONLY when the server returns valid JSON, so HTML
 * pages (Vercel SPA rewrites, Google Login proxies) or plain-text 404 responses can NEVER
 * trigger "Unexpected token '<'" or "Unexpected token 'T'".
 */
export async function tryApiJson<T>(
  path: string,
  init?: RequestInit
): Promise<ApiJsonResult<T>> {
  const targetUrl = apiUrl(path);
  const controller = new AbortController();
  const timer =
    typeof window !== "undefined"
      ? window.setTimeout(() => controller.abort(), 3500)
      : setTimeout(() => controller.abort(), 3500);

  try {
    const resp = await fetch(targetUrl, {
      ...init,
      signal: init?.signal ?? controller.signal,
    });
    const contentType = (resp.headers.get("content-type") || "").toLowerCase();
    const rawText = await resp.text();
    const snippet = rawText.trim().slice(0, 120).replace(/\s+/g, " ");

    if (!contentType.includes("application/json")) {
      console.warn(
        `[Crackpilot API] Non-JSON response from ${targetUrl} (status=${resp.status}, content-type="${contentType || "none"}", preview="${snippet}"). Switching to local workspace fallback.`
      );
      return {
        reachable: false,
        reason: "non-json-response",
        status: resp.status,
        contentType,
      };
    }

    if (!rawText.trim() || rawText.trim().startsWith("<")) {
      console.warn(
        `[Crackpilot API] Empty or HTML body from ${targetUrl} (status=${resp.status}, preview="${snippet}"). Switching to local workspace fallback.`
      );
      return {
        reachable: false,
        reason: "html-or-empty-body",
        status: resp.status,
        contentType,
      };
    }

    try {
      const data = JSON.parse(rawText) as T;
      return { reachable: true, ok: resp.ok, status: resp.status, data };
    } catch (parseErr) {
      console.error(
        `[Crackpilot API] JSON.parse failed for ${targetUrl} (status=${resp.status}, preview="${snippet}"):`,
        parseErr
      );
      return {
        reachable: false,
        reason: "invalid-json",
        status: resp.status,
        contentType,
      };
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const isTimeout = err instanceof Error && err.name === "AbortError";
    console.warn(
      `[Crackpilot API] Request failed for ${targetUrl} (${isTimeout ? "timeout 3.5s" : errMsg}). Switching to local workspace fallback.`
    );
    return {
      reachable: false,
      reason: isTimeout ? "timeout" : "network-error",
    };
  } finally {
    if (typeof window !== "undefined") {
      window.clearTimeout(timer as number);
    } else {
      clearTimeout(timer);
    }
  }
}

/**
 * Probes GET /api/health ONCE (cached until reset or forced) before opening SSE streams.
 * Prevents EventSource MIME console errors on static Vercel deployments and standalone Electron.
 */
export async function probeBackendHealth(force = false): Promise<boolean> {
  if (!force && cachedBackendHealth !== null) {
    return cachedBackendHealth;
  }
  if (!force && inflightHealthProbe) {
    return inflightHealthProbe;
  }

  inflightHealthProbe = tryApiJson<{ ok?: boolean; sseSupported?: boolean }>(
    "/api/health",
    {
      cache: "no-store",
    }
  )
    .then((res) => {
      const healthy = Boolean(
        res.reachable &&
          res.ok &&
          res.data?.ok &&
          res.data?.sseSupported !== false
      );
      cachedBackendHealth = healthy;
      return healthy;
    })
    .finally(() => {
      inflightHealthProbe = null;
    });

  return inflightHealthProbe;
}

export async function hydrateWorkspaceState(
  defaultProfile: TargetProfile,
  options?: { skipAuthToken?: boolean }
): Promise<{
  user: UserAccount | null;
  token: SessionTokenState | null;
  profile: TargetProfile;
}> {
  const skipAuthToken = Boolean(options?.skipAuthToken);
  const savedLocalToken = skipAuthToken
    ? null
    : readStorage<SessionTokenState>(STORAGE_KEYS.token);
  const res = await tryApiJson<{
    user?: UserAccount | null;
    token?: SessionTokenState | null;
    profile?: TargetProfile;
  }>("/api/auth/me");

  if (res.reachable && res.ok) {
    const user = res.data.user ?? readStorage<UserAccount>(STORAGE_KEYS.user);
    const rawToken = skipAuthToken
      ? null
      : res.data.token ?? savedLocalToken ?? null;
    // Never auto-authenticate the software overlay from stale storage/boot snapshots
    const token = rawToken
      ? { ...rawToken, authenticated: false, sessionActive: false }
      : null;
    const profile = normalizeProfileRecord(
      res.data.profile ?? readStorage<TargetProfile>(STORAGE_KEYS.profile),
      defaultProfile
    );
    if (res.data.profile) {
      writeStorage(STORAGE_KEYS.profile, profile);
    }
    return { user, token, profile };
  }

  const fallbackToken =
    !skipAuthToken && savedLocalToken
      ? { ...savedLocalToken, authenticated: false, sessionActive: false }
      : null;

  return {
    user: readStorage<UserAccount>(STORAGE_KEYS.user),
    token: fallbackToken,
    profile: normalizeProfileRecord(
      readStorage<TargetProfile>(STORAGE_KEYS.profile),
      defaultProfile
    ),
  };
}

export async function loginAccount(params: {
  email: string;
  name?: string;
}): Promise<UserAccount> {
  const cleanEmail = params.email.trim();
  const cleanName = (params.name?.trim() || cleanEmail.split("@")[0] || "Candidate").trim();
  const formattedName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

  const res = await tryApiJson<{
    ok?: boolean;
    user?: UserAccount;
    token?: SessionTokenState | null;
    error?: string;
  }>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: cleanEmail, name: params.name?.trim() }),
  });

  if (res.reachable) {
    if (!res.ok || !res.data.user) {
      const msg = res.data.error || "Sign in failed.";
      console.error("[Crackpilot Auth] /api/auth/login rejected:", res.status, msg);
      throw new Error(msg);
    }
    writeStorage(STORAGE_KEYS.user, res.data.user);
    if (res.data.token) {
      writeStorage(STORAGE_KEYS.token, res.data.token);
      broadcastLocalSync({ type: "token_generated", token: res.data.token });
    }
    return res.data.user;
  }

  // Static deployment (e.g. Vercel) seamless local account session fallback
  const localUser: UserAccount = {
    id: `usr-${randomHex(8).toLowerCase()}`,
    name: formattedName,
    email: cleanEmail,
  };
  writeStorage(STORAGE_KEYS.user, localUser);
  console.info("[Crackpilot Auth] Created local session for:", cleanEmail);
  return localUser;
}

export async function logoutAccount(): Promise<void> {
  await tryApiJson("/api/auth/logout", { method: "POST" });
  writeStorage(STORAGE_KEYS.user, null);
}

export async function generateSessionToken(): Promise<SessionTokenState> {
  const res = await tryApiJson<{
    token?: SessionTokenState;
    error?: string;
  }>("/api/token/generate", { method: "POST" });

  if (res.reachable) {
    if (!res.ok || !res.data.token) {
      const msg = res.data.error || "Could not generate token.";
      console.error("[Crackpilot Token] /api/token/generate failed:", res.status, msg);
      throw new Error(msg);
    }
    writeStorage(STORAGE_KEYS.token, res.data.token);
    broadcastLocalSync({ type: "token_generated", token: res.data.token });
    return res.data.token;
  }

  const localToken: SessionTokenState = {
    token: `CP-${randomHex(6)}-${randomHex(6)}-${randomHex(4)}`,
    createdAt: new Date().toISOString(),
    authenticated: false,
    sessionActive: false,
  };
  writeStorage(STORAGE_KEYS.token, localToken);
  broadcastLocalSync({ type: "token_generated", token: localToken });
  console.info("[Crackpilot Token] Generated local 48h token:", localToken.token);
  return localToken;
}

const STRICT_SESSION_TOKEN_REGEX =
  /^(CP|DEMO)-[A-Z0-9]{4,}(?:-[A-Z0-9]{3,}){1,3}$/i;
const TOKEN_MAX_AGE_MS = 48 * 60 * 60 * 1000;

export async function verifySessionToken(submittedToken: string): Promise<{
  token: SessionTokenState;
  profile?: TargetProfile;
}> {
  const submitted = submittedToken.trim();
  if (!submitted) {
    throw new Error(
      "Please enter your Session Token Key from Dashboard → Overview."
    );
  }

  const validFormat = STRICT_SESSION_TOKEN_REGEX.test(submitted);

  const res = await tryApiJson<{
    token?: SessionTokenState;
    profile?: TargetProfile;
    error?: string;
  }>("/api/token/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: submitted }),
  });

  if (res.reachable) {
    if (!res.ok || !res.data.token) {
      const msg =
        res.data.error ||
        "Invalid, expired, or blocked session token. Please check Dashboard → Overview.";
      console.error("[Crackpilot Token] /api/token/verify rejected:", res.status, msg);
      throw new Error(msg);
    }
    if (res.data.token.quota?.blockedReason) {
      throw new Error(res.data.token.quota.blockedReason);
    }
    if (
      res.data.token.quota &&
      typeof res.data.token.quota.remainingSeconds === "number" &&
      res.data.token.quota.remainingSeconds <= 0
    ) {
      throw new Error(
        "This session token has expired or has no remaining session time."
      );
    }
    const readyToken: SessionTokenState = {
      ...res.data.token,
      authenticated: true,
      sessionActive: true,
    };
    // Keep profile synced silently, but NEVER persist authenticated session token in localStorage/sessionStorage
    if (res.data.profile) writeStorage(STORAGE_KEYS.profile, res.data.profile);
    return { token: readyToken, profile: res.data.profile };
  }

  // Fallback validation when serverless deployment does not host /api/token/verify
  if (!validFormat) {
    console.error("[Crackpilot Token] Token format validation failed:", submitted);
    throw new Error(
      "Invalid Session Token Key format. Enter a valid token (e.g. CP-XXXXXX-XXXXXX-XXXX) from Dashboard → Overview."
    );
  }

  const stored = readStorage<SessionTokenState>(STORAGE_KEYS.token);
  if (stored && stored.token === submitted) {
    if (stored.quota?.blockedReason) {
      throw new Error(stored.quota.blockedReason);
    }
    if (
      stored.quota &&
      typeof stored.quota.remainingSeconds === "number" &&
      stored.quota.remainingSeconds <= 0
    ) {
      throw new Error(
        "This session token has expired or has no remaining session time."
      );
    }
    const createdAtMs = Date.parse(stored.createdAt);
    if (Number.isFinite(createdAtMs) && Date.now() - createdAtMs > TOKEN_MAX_AGE_MS) {
      throw new Error(
        "This 48-hour session token has expired. Generate a fresh token in Dashboard → Overview."
      );
    }
  } else if (!isDesktopApp() && stored && submitted !== stored.token) {
    console.error("[Crackpilot Token] Local web token mismatch.");
    throw new Error(
      "Invalid token. Copy the exact token from Dashboard → Overview."
    );
  }

  const verified: SessionTokenState = {
    token: submitted,
    createdAt: stored?.token === submitted ? stored.createdAt : new Date().toISOString(),
    authenticated: true,
    sessionActive: true,
    quota: stored?.token === submitted ? stored.quota : undefined,
  };
  const savedProfile = readStorage<TargetProfile>(STORAGE_KEYS.profile) ?? undefined;
  // Do NOT persist authenticated=true to localStorage so every fresh launch requires login
  console.info("[Crackpilot Token] Authenticated for active in-memory session:", submitted);
  return { token: verified, profile: savedProfile };
}

export async function startLiveSession(): Promise<{
  token: SessionTokenState;
  profile?: TargetProfile;
}> {
  const res = await tryApiJson<{
    token?: SessionTokenState;
    profile?: TargetProfile;
    error?: string;
  }>("/api/session/start", { method: "POST" });

  if (res.reachable) {
    if (!res.ok || !res.data.token) {
      const msg = res.data.error || "Could not start session.";
      console.error("[Crackpilot Session] /api/session/start rejected:", res.status, msg);
      throw new Error(msg);
    }
    return { token: res.data.token, profile: res.data.profile };
  }

  const savedProfile = readStorage<TargetProfile>(STORAGE_KEYS.profile) ?? undefined;
  const fallback: SessionTokenState = {
    token: "",
    createdAt: new Date().toISOString(),
    authenticated: true,
    sessionActive: true,
  };
  return { token: fallback, profile: savedProfile };
}

export async function stopLiveSession(): Promise<void> {
  clearOverlayAuthStorage();
  await tryApiJson("/api/session/stop", { method: "POST" });
  broadcastLocalSync({ type: "session_stopped", token: null });
}

export async function saveTargetProfile(
  profile: TargetProfile
): Promise<TargetProfile> {
  writeStorage(STORAGE_KEYS.profile, profile);
  const res = await tryApiJson<{
    profile?: TargetProfile;
    error?: string;
  }>("/api/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });

  if (res.reachable && res.ok && res.data.profile) {
    writeStorage(STORAGE_KEYS.profile, res.data.profile);
    broadcastLocalSync({ type: "profile_updated", profile: res.data.profile });
    return res.data.profile;
  }

  broadcastLocalSync({ type: "profile_updated", profile });
  return profile;
}

export async function extractDocumentText(params: {
  file: File;
  base64: string;
  kind: "resume" | "jd";
}): Promise<string> {
  const res = await tryApiJson<{ text?: string; error?: string }>(
    "/api/profile/extract",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: params.file.name,
        mimeType: params.file.type || "text/plain",
        fileBase64: params.base64,
        kind: params.kind,
      }),
    }
  );

  if (res.reachable && res.ok && typeof res.data.text === "string") {
    return res.data.text;
  }

  // Fallback for static hosting: read plain-text files directly in browser
  if (
    params.file.type.startsWith("text/") ||
    /\.(txt|md|json|csv)$/i.test(params.file.name)
  ) {
    return (await params.file.text()).trim();
  }

  return `[Uploaded ${params.file.name} — paste key bullet points here if running without a backend server]`;
}

function mergeQuotaIntoStoredToken(
  tokenValue: string,
  quota: AccountQuotaSnapshot
): SessionTokenState | null {
  const stored = readStorage<SessionTokenState>(STORAGE_KEYS.token);
  if (!stored) return null;
  if (stored.token && tokenValue && stored.token !== tokenValue) return stored;
  const updated: SessionTokenState = {
    ...stored,
    quota,
  };
  writeStorage(STORAGE_KEYS.token, updated);
  broadcastLocalSync({ type: "quota_updated", token: updated });
  return updated;
}

function buildDefaultQuotaSnapshot(
  tokenValue: string,
  remainingSeconds = 240 * 60
): AccountQuotaSnapshot {
  const clamped = Math.max(0, Math.round(remainingSeconds));
  const storedUser = readStorage<UserAccount>(STORAGE_KEYS.user);
  return {
    token: tokenValue,
    label: storedUser?.name || "Candidate",
    email: storedUser?.email || "",
    accountType: "REGULAR",
    planType: "Pro Plan",
    paymentStatus: "Paid",
    status: clamped <= 0 ? "Expired" : "Active",
    remainingSeconds: clamped,
    remainingMinutes: Math.ceil(clamped / 60),
    capturesUsed: 0,
    captureLimit: 80,
    promptsUsed: 0,
    promptLimit: 80,
    expiresAt: null,
    blockedReason:
      clamped <= 0
        ? "Remaining time is 0 minutes. Ask the admin to add extra time, then click Reconnect."
        : null,
  };
}

export function deductLocalRemainingSeconds(
  tokenValue: string,
  elapsedSeconds: number
): AccountQuotaSnapshot | null {
  const delta = Math.max(0, Math.round(elapsedSeconds));
  if (delta <= 0) return null;
  const stored = readStorage<SessionTokenState>(STORAGE_KEYS.token);
  if (!stored) return null;
  if (stored.token && tokenValue && stored.token !== tokenValue) return null;
  const baseQuota =
    stored.quota ?? buildDefaultQuotaSnapshot(stored.token, 240 * 60);
  const nextRemaining = Math.max(0, baseQuota.remainingSeconds - delta);
  const nextQuota: AccountQuotaSnapshot = {
    ...baseQuota,
    remainingSeconds: nextRemaining,
    remainingMinutes: Math.ceil(nextRemaining / 60),
    status: nextRemaining <= 0 ? "Expired" : baseQuota.status,
    blockedReason:
      nextRemaining <= 0
        ? "Remaining time is 0 minutes. Ask the admin to add extra time, then click Reconnect."
        : baseQuota.blockedReason,
  };
  mergeQuotaIntoStoredToken(stored.token, nextQuota);
  return nextQuota;
}

export async function fetchTokenQuota(token: string): Promise<
  | { ok: true; quota: AccountQuotaSnapshot }
  | { ok: false; revoked?: boolean; error?: string; offline?: boolean }
> {
  const clean = token.trim();
  if (!clean) return { ok: false, error: "Missing token." };
  const res = await tryApiJson<{
    ok?: boolean;
    quota?: AccountQuotaSnapshot;
    revoked?: boolean;
    error?: string;
  }>(`/api/token/quota?token=${encodeURIComponent(clean)}`, {
    cache: "no-store",
  });
  if (!res.reachable) {
    const stored = readStorage<SessionTokenState>(STORAGE_KEYS.token);
    if (stored?.token === clean && stored.quota) {
      return { ok: true, quota: stored.quota };
    }
    return { ok: false, offline: true };
  }
  if (!res.ok || !res.data.quota) {
    return {
      ok: false,
      revoked: Boolean(res.data.revoked || res.status === 404),
      error: res.data.error || "Could not sync quota.",
    };
  }
  mergeQuotaIntoStoredToken(clean, res.data.quota);
  return { ok: true, quota: res.data.quota };
}

export async function syncTokenElapsedSeconds(
  token: string,
  elapsedSeconds: number
): Promise<
  | { ok: true; quota: AccountQuotaSnapshot }
  | { ok: false; revoked?: boolean; error?: string; offline?: boolean }
> {
  const clean = token.trim();
  const delta = Math.max(0, Math.round(elapsedSeconds));
  if (!clean || delta <= 0) return { ok: false, offline: true };
  const res = await tryApiJson<{
    ok?: boolean;
    quota?: AccountQuotaSnapshot;
    revoked?: boolean;
    error?: string;
  }>("/api/token/consume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: clean, elapsedSeconds: delta }),
  });
  if (!res.reachable) {
    const localQuota = deductLocalRemainingSeconds(clean, delta);
    if (localQuota) {
      return { ok: true, quota: localQuota };
    }
    return { ok: false, offline: true };
  }
  if (!res.ok || !res.data.quota) {
    return {
      ok: false,
      revoked: Boolean(res.data.revoked || res.status === 404),
      error: res.data.error || "Usage sync failed.",
    };
  }
  mergeQuotaIntoStoredToken(clean, res.data.quota);
  return { ok: true, quota: res.data.quota };
}

export async function clearActiveProblemContextClient(): Promise<void> {
  await tryApiJson<{ ok?: boolean }>("/api/dsa/context/clear", {
    method: "POST",
  });
}

export async function analyzeDsaProblemClient(params: {
  problemText?: string;
  images?: Array<{ data: string; mimeType: string }>;
  preferredLanguage?: string;
  answerLanguage?: string;
  role?: string;
  experience?: string;
  source?: ActiveProblemContext["source"];
  assessmentTypeOverride?: DsaAssessmentType;
  oaQuestionKindOverride?: OaQuestionKind;
}): Promise<{
  dsaData: DsaTeleprompterData;
  activeProblemContext: ActiveProblemContext;
  summaryMarkdown: string;
}> {
  const resp = await fetch(apiUrl("/api/dsa/analyze"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = (await resp.json()) as {
    ok?: boolean;
    dsaData?: DsaTeleprompterData;
    activeProblemContext?: ActiveProblemContext;
    summaryMarkdown?: string;
    error?: string;
  };
  if (!resp.ok || !data.dsaData || !data.activeProblemContext) {
    throw new Error(data.error || "DSA problem analysis failed.");
  }
  return {
    dsaData: data.dsaData,
    activeProblemContext: data.activeProblemContext,
    summaryMarkdown: data.summaryMarkdown || "",
  };
}

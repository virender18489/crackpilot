import type { SessionTokenState, TargetProfile, UserAccount } from "../types";
import { apiUrl, getApiBaseUrl, hasConfiguredBackend, isDesktopApp } from "./api";

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
let loggedStandaloneNotice = false;

export function resetBackendHealthCache(): void {
  cachedBackendHealth = null;
  inflightHealthProbe = null;
  loggedStandaloneNotice = false;
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
  if (!hasConfiguredBackend()) {
    if (!loggedStandaloneNotice) {
      loggedStandaloneNotice = true;
      console.info(
        "[Crackpilot API] Standalone Desktop mode (no remote backend server URL configured). Using local auth/workspace store."
      );
    }
    return { reachable: false, reason: "no-backend-configured" };
  }

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
  if (!hasConfiguredBackend()) {
    cachedBackendHealth = false;
    return false;
  }
  if (!force && cachedBackendHealth !== null) {
    return cachedBackendHealth;
  }
  if (!force && inflightHealthProbe) {
    return inflightHealthProbe;
  }

  inflightHealthProbe = tryApiJson<{ ok?: boolean }>("/api/health", {
    cache: "no-store",
  })
    .then((res) => {
      const healthy = Boolean(res.reachable && res.ok && res.data?.ok);
      cachedBackendHealth = healthy;
      if (!healthy) {
        console.info(
          `[Crackpilot Health] Backend not detected at "${getApiBaseUrl() || "same-origin"}/api/health" (reason=${res.reachable ? `status-${res.status}` : res.reason}). Running in static/local sync mode.`
        );
      }
      return healthy;
    })
    .finally(() => {
      inflightHealthProbe = null;
    });

  return inflightHealthProbe;
}

export async function hydrateWorkspaceState(defaultProfile: TargetProfile): Promise<{
  user: UserAccount | null;
  token: SessionTokenState | null;
  profile: TargetProfile;
}> {
  const desktop = isDesktopApp();
  const res = await tryApiJson<{
    user?: UserAccount | null;
    token?: SessionTokenState | null;
    profile?: TargetProfile;
  }>("/api/auth/me");

  if (res.reachable && res.ok) {
    const user = res.data.user ?? readStorage<UserAccount>(STORAGE_KEYS.user);
    // In Desktop .exe, always start at Gate 1 (Authenticate Crackpilot) on fresh launch
    const token = desktop
      ? null
      : res.data.token ?? readStorage<SessionTokenState>(STORAGE_KEYS.token);
    const profile =
      res.data.profile ??
      readStorage<TargetProfile>(STORAGE_KEYS.profile) ??
      defaultProfile;
    return { user, token, profile };
  }

  return {
    user: readStorage<UserAccount>(STORAGE_KEYS.user),
    token: desktop ? null : readStorage<SessionTokenState>(STORAGE_KEYS.token),
    profile: readStorage<TargetProfile>(STORAGE_KEYS.profile) ?? defaultProfile,
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

export async function verifySessionToken(submittedToken: string): Promise<{
  token: SessionTokenState;
  profile?: TargetProfile;
}> {
  const submitted = submittedToken.trim();
  if (!submitted) {
    throw new Error("Please paste the token generated in Dashboard → Overview.");
  }

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
      const msg = res.data.error || "Token verification failed.";
      console.error("[Crackpilot Token] /api/token/verify rejected:", res.status, msg);
      throw new Error(msg);
    }
    writeStorage(STORAGE_KEYS.token, res.data.token);
    if (res.data.profile) writeStorage(STORAGE_KEYS.profile, res.data.profile);
    broadcastLocalSync({
      type: "token_authenticated",
      token: res.data.token,
      profile: res.data.profile,
    });
    return { token: res.data.token, profile: res.data.profile };
  }

  const stored = readStorage<SessionTokenState>(STORAGE_KEYS.token);
  const validFormat = /^CP-[A-Z0-9-]{6,}$/i.test(submitted);

  // In Desktop .exe standalone mode, accept any freshly generated CP-... token from Dashboard
  if (isDesktopApp()) {
    if (!validFormat) {
      console.error("[Crackpilot Token] Desktop standalone format validation failed:", submitted);
      throw new Error(
        "Invalid token format. Copy your CP-XXXX-XXXX-XXXX token from Dashboard → Overview."
      );
    }
  } else {
    if (stored && submitted !== stored.token) {
      console.error("[Crackpilot Token] Local web token mismatch.");
      throw new Error(
        "Invalid token. Copy the exact token from Dashboard → Overview."
      );
    }
    if (!stored && !validFormat) {
      console.error("[Crackpilot Token] Local web token missing/invalid format.");
      throw new Error(
        "Invalid token format. Generate a token in Dashboard → Overview first."
      );
    }
  }

  const verified: SessionTokenState = {
    token: submitted,
    createdAt: new Date().toISOString(),
    authenticated: true,
    sessionActive: false,
  };
  const savedProfile = readStorage<TargetProfile>(STORAGE_KEYS.profile) ?? undefined;
  writeStorage(STORAGE_KEYS.token, verified);
  broadcastLocalSync({
    type: "token_authenticated",
    token: verified,
    profile: savedProfile,
  });
  console.info("[Crackpilot Token] Authenticated locally:", submitted);
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
    writeStorage(STORAGE_KEYS.token, res.data.token);
    broadcastLocalSync({
      type: "session_started",
      token: res.data.token,
      profile: res.data.profile,
    });
    return { token: res.data.token, profile: res.data.profile };
  }

  const stored = readStorage<SessionTokenState>(STORAGE_KEYS.token);
  if (!stored || !stored.authenticated) {
    console.error("[Crackpilot Session] Attempted start without authenticated token.");
    throw new Error("Authenticate your Crackpilot software token first.");
  }
  const active: SessionTokenState = { ...stored, sessionActive: true };
  const savedProfile = readStorage<TargetProfile>(STORAGE_KEYS.profile) ?? undefined;
  writeStorage(STORAGE_KEYS.token, active);
  broadcastLocalSync({
    type: "session_started",
    token: active,
    profile: savedProfile,
  });
  return { token: active, profile: savedProfile };
}

export async function stopLiveSession(): Promise<void> {
  await tryApiJson("/api/session/stop", { method: "POST" });
  const stored = readStorage<SessionTokenState>(STORAGE_KEYS.token);
  if (stored) {
    const stopped: SessionTokenState = { ...stored, sessionActive: false };
    writeStorage(STORAGE_KEYS.token, stopped);
    broadcastLocalSync({ type: "session_stopped", token: stopped });
  }
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

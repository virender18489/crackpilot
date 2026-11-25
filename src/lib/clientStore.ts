import type { SessionTokenState, TargetProfile, UserAccount } from "../types";
import { apiUrl, isDesktopApp } from "./api";

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

function readStorage<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
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
  } catch {
    // Ignore private-mode storage quota errors
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
  } catch {
    // Ignore BroadcastChannel errors
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
  } catch {
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
 * Safely fetches JSON from the backend API with a 3.5s timeout. Returns
 * `{ reachable: true, ... }` ONLY when the response is valid JSON, so HTML/404
 * pages from Vercel or auth proxies can never trigger "Unexpected token '<'".
 */
export async function tryApiJson<T>(
  path: string,
  init?: RequestInit
): Promise<
  | { reachable: true; ok: boolean; status: number; data: T }
  | { reachable: false }
> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 3500);
  try {
    const resp = await fetch(apiUrl(path), {
      ...init,
      signal: init?.signal ?? controller.signal,
    });
    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return { reachable: false };
    }
    const text = await resp.text();
    if (!text.trim() || text.trim().startsWith("<")) {
      return { reachable: false };
    }
    const data = JSON.parse(text) as T;
    return { reachable: true, ok: resp.ok, status: resp.status, data };
  } catch {
    return { reachable: false };
  } finally {
    window.clearTimeout(timer);
  }
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
      throw new Error(res.data.error || "Sign in failed.");
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
      throw new Error(res.data.error || "Could not generate token.");
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
      throw new Error(res.data.error || "Token verification failed.");
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
      throw new Error(
        "Invalid token format. Copy your CP-XXXX-XXXX-XXXX token from Dashboard → Overview."
      );
    }
  } else {
    if (stored && submitted !== stored.token) {
      throw new Error(
        "Invalid token. Copy the exact token from Dashboard → Overview."
      );
    }
    if (!stored && !validFormat) {
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
      throw new Error(res.data.error || "Could not start session.");
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

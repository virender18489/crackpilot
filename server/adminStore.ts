import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type AccountType = "REGULAR" | "DEMO";
export type AccountStatus = "Active" | "Suspended" | "Expired";

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

interface StoredAdminCredential {
  email: string;
  salt: string;
  passwordHash: string;
  claimedAt: string;
}

interface PersistedAdminDb {
  adminCredential: StoredAdminCredential | null;
  accounts: AdminAccountRecord[];
}

const DATA_DIR = path.resolve(__dirname, "data");
const STORE_PATH = path.resolve(DATA_DIR, "admin-store.json");

// Ephemeral fallback signing key when ADMIN_SESSION_SECRET is not set in env
const FALLBACK_SESSION_SECRET = crypto.randomBytes(32).toString("hex");
const ADMIN_SESSION_COOKIE_NAME = "crackpilot_admin_session";
const ADMIN_SESSION_TTL_SEC = 12 * 60 * 60; // 12 hours

let dbCache: PersistedAdminDb | null = null;

function ensureStoreLoaded(): PersistedAdminDb {
  if (dbCache) return dbCache;
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, "utf-8");
      const parsed = JSON.parse(raw) as Partial<PersistedAdminDb>;
      dbCache = {
        adminCredential: parsed.adminCredential ?? null,
        accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
      };
      return dbCache;
    }
  } catch (err) {
    console.error("[AdminStore] Failed to load admin-store.json, starting fresh:", err);
  }
  dbCache = { adminCredential: null, accounts: [] };
  return dbCache;
}

function persistStore(): void {
  if (!dbCache) return;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmpPath = `${STORE_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(dbCache, null, 2), { mode: 0o600 });
    fs.renameSync(tmpPath, STORE_PATH);
  } catch (err) {
    console.error("[AdminStore] Failed to persist admin-store.json:", err);
  }
}

function getSigningSecret(): string {
  const envSecret = process.env.ADMIN_SESSION_SECRET?.trim();
  return envSecret && envSecret.length >= 16 ? envSecret : FALLBACK_SESSION_SECRET;
}

function timingSafeCompare(a: string, b: string): boolean {
  const hashA = crypto.createHash("sha256").update(a).digest();
  const hashB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function hashPasswordScrypt(password: string, saltHex: string): string {
  return crypto.scryptSync(password, saltHex, 64).toString("hex");
}

function getEnvAdminCredentials(): {
  identifier: string;
  password: string;
  configured: boolean;
} {
  const email = process.env.ADMIN_EMAIL?.trim() || "";
  const username = process.env.ADMIN_USERNAME?.trim() || "";
  const password = process.env.ADMIN_PASSWORD?.trim() || "";
  const identifier = email || username;
  return {
    identifier,
    password,
    configured: Boolean(identifier && password),
  };
}

export function getAdminAuthConfigStatus(): {
  envConfigured: boolean;
  claimedConfigured: boolean;
  setupRequired: boolean;
  configuredIdentifierHint: string | null;
} {
  const db = ensureStoreLoaded();
  const env = getEnvAdminCredentials();
  const claimedConfigured = Boolean(db.adminCredential);
  const setupRequired = !env.configured && !claimedConfigured;
  const activeIdentifier = env.configured
    ? env.identifier
    : db.adminCredential?.email || null;

  let hint: string | null = null;
  if (activeIdentifier) {
    const atIdx = activeIdentifier.indexOf("@");
    if (atIdx > 2) {
      hint = `${activeIdentifier.slice(0, 2)}***${activeIdentifier.slice(atIdx)}`;
    } else if (activeIdentifier.length > 2) {
      hint = `${activeIdentifier.slice(0, 2)}***`;
    } else {
      hint = "***";
    }
  }

  return {
    envConfigured: env.configured,
    claimedConfigured,
    setupRequired,
    configuredIdentifierHint: hint,
  };
}

export function claimFirstRunAdmin(params: {
  identifier: string;
  password: string;
}): { ok: true; email: string } | { ok: false; status: number; error: string } {
  const env = getEnvAdminCredentials();
  const db = ensureStoreLoaded();

  if (env.configured) {
    return {
      ok: false,
      status: 403,
      error: "Admin credentials are already configured via server environment variables.",
    };
  }
  if (db.adminCredential) {
    return {
      ok: false,
      status: 403,
      error: "Super-admin account has already been claimed.",
    };
  }

  const cleanId = params.identifier.trim().toLowerCase();
  const cleanPass = params.password;
  if (!cleanId || cleanId.length < 3 || cleanId.length > 120) {
    return {
      ok: false,
      status: 400,
      error: "Enter a valid admin email or username (at least 3 characters).",
    };
  }
  if (!cleanPass || cleanPass.length < 8 || cleanPass.length > 128) {
    return {
      ok: false,
      status: 400,
      error: "Admin password must be between 8 and 128 characters.",
    };
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPasswordScrypt(cleanPass, salt);
  db.adminCredential = {
    email: cleanId,
    salt,
    passwordHash,
    claimedAt: new Date().toISOString(),
  };
  persistStore();
  return { ok: true, email: cleanId };
}

export function verifyAdminCredentials(
  identifier: string,
  password: string
): { valid: boolean; subject: string } {
  const submittedId = identifier.trim().toLowerCase();
  const submittedPass = password || "";
  if (!submittedId || !submittedPass) {
    return { valid: false, subject: "" };
  }

  // Environment variables ALWAYS take strict precedence when configured
  const env = getEnvAdminCredentials();
  if (env.configured) {
    const emailEnv = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const userEnv = (process.env.ADMIN_USERNAME || "").trim().toLowerCase();
    const idMatches =
      (Boolean(emailEnv) && timingSafeCompare(submittedId, emailEnv)) ||
      (Boolean(userEnv) && timingSafeCompare(submittedId, userEnv));
    const passMatches = timingSafeCompare(submittedPass, env.password);
    return {
      valid: idMatches && passMatches,
      subject: env.identifier,
    };
  }

  const db = ensureStoreLoaded();
  if (!db.adminCredential) {
    return { valid: false, subject: "" };
  }

  const idMatches = timingSafeCompare(submittedId, db.adminCredential.email.toLowerCase());
  const computedHash = hashPasswordScrypt(submittedPass, db.adminCredential.salt);
  const passMatches = timingSafeCompare(computedHash, db.adminCredential.passwordHash);
  return {
    valid: idMatches && passMatches,
    subject: db.adminCredential.email,
  };
}

// Signed HS256 JWT (zero external dependency, Node crypto HMAC-SHA256)
function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf-8") : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  return Buffer.from(padded, "base64").toString("utf-8");
}

export function signAdminSessionToken(subject: string): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: subject,
      role: "super_admin",
      iat: nowSec,
      exp: nowSec + ADMIN_SESSION_TTL_SEC,
      jti: crypto.randomBytes(12).toString("hex"),
    })
  );
  const signingInput = `${header}.${payload}`;
  const sig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(signingInput)
    .digest();
  return `${signingInput}.${base64UrlEncode(sig)}`;
}

export function verifyAdminSessionToken(
  token: string
): { valid: true; subject: string; exp: number } | { valid: false } {
  if (!token || typeof token !== "string") return { valid: false };
  const parts = token.split(".");
  if (parts.length !== 3) return { valid: false };

  const [headerB64, payloadB64, sigB64] = parts;
  const expectedSig = base64UrlEncode(
    crypto
      .createHmac("sha256", getSigningSecret())
      .update(`${headerB64}.${payloadB64}`)
      .digest()
  );

  if (!timingSafeCompare(sigB64, expectedSig)) {
    return { valid: false };
  }

  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64)) as {
      sub?: string;
      role?: string;
      exp?: number;
    };
    const nowSec = Math.floor(Date.now() / 1000);
    if (
      payload.role !== "super_admin" ||
      !payload.sub ||
      typeof payload.exp !== "number" ||
      payload.exp <= nowSec
    ) {
      return { valid: false };
    }
    return { valid: true, subject: payload.sub, exp: payload.exp };
  } catch {
    return { valid: false };
  }
}

export function parseCookieHeader(cookieHeader?: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}

export function getAdminCookieName(): string {
  return ADMIN_SESSION_COOKIE_NAME;
}

export function buildAdminSetCookieHeader(jwt: string, maxAgeSec = ADMIN_SESSION_TTL_SEC): string {
  return `${ADMIN_SESSION_COOKIE_NAME}=${encodeURIComponent(jwt)}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=${maxAgeSec}`;
}

export function buildAdminClearCookieHeader(): string {
  return `${ADMIN_SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0`;
}

// =========================================================================
// User / License Token & Demo ID Store + Quota Enforcement
// =========================================================================

function syncAccountExpiry(account: AdminAccountRecord): boolean {
  let changed = false;
  if (
    account.status === "Active" &&
    account.expiresAt &&
    Date.parse(account.expiresAt) <= Date.now()
  ) {
    account.status = "Expired";
    changed = true;
  }
  return changed;
}

export function buildQuotaSnapshot(account: AdminAccountRecord): AccountQuotaSnapshot {
  if (syncAccountExpiry(account)) {
    persistStore();
  }

  let blockedReason: string | null = null;
  if (account.status === "Suspended") {
    blockedReason =
      "Your account has been suspended by the administrator. Contact support to restore access.";
  } else if (account.status === "Expired") {
    blockedReason =
      account.accountType === "DEMO"
        ? "This Demo ID has expired. Request an extension or new Demo ID from the admin."
        : "Your session license has expired. Request extra time from the admin.";
  } else if (account.remainingSeconds <= 0) {
    blockedReason =
      "Remaining time is 0 minutes. Ask the admin to add extra time, then click Reconnect.";
  }

  return {
    token: account.token,
    label: account.label,
    accountType: account.accountType,
    status: account.status,
    remainingSeconds: Math.max(0, Math.round(account.remainingSeconds)),
    remainingMinutes: Math.max(0, Math.ceil(account.remainingSeconds / 60)),
    capturesUsed: account.capturesUsed,
    captureLimit: account.captureLimit,
    promptsUsed: account.promptsUsed,
    promptLimit: account.promptLimit,
    expiresAt: account.expiresAt,
    blockedReason,
  };
}

export function registerRegularToken(params: {
  token: string;
  label?: string;
  email?: string;
  minutes?: number;
  captureLimit?: number;
  promptLimit?: number;
}): AdminAccountRecord {
  const db = ensureStoreLoaded();
  const existing = db.accounts.find((a) => a.token === params.token);
  if (existing) {
    if (params.label) existing.label = params.label;
    if (params.email) existing.email = params.email;
    persistStore();
    return existing;
  }

  const minutes = Math.max(1, Math.min(10080, Math.round(params.minutes ?? 240)));
  const captureLimit = Math.max(1, Math.min(10000, Math.round(params.captureLimit ?? 80)));
  const promptLimit = Math.max(1, Math.min(10000, Math.round(params.promptLimit ?? 80)));

  const record: AdminAccountRecord = {
    id: `acc-${crypto.randomBytes(4).toString("hex")}`,
    token: params.token,
    label: (params.label || "Candidate Session").trim().slice(0, 80),
    email: (params.email || "").trim().slice(0, 120),
    accountType: "REGULAR",
    status: "Active",
    remainingSeconds: minutes * 60,
    totalMinutesGranted: minutes,
    capturesUsed: 0,
    captureLimit,
    promptsUsed: 0,
    promptLimit,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    lastActiveAt: null,
  };

  db.accounts.unshift(record);
  persistStore();
  return record;
}

export function createManagedAccount(params: {
  label: string;
  email?: string;
  accountType: AccountType;
  minutes: number;
  captureLimit: number;
  promptLimit?: number;
  expiryHours: number | null;
  notes?: string;
}): AdminAccountRecord {
  const db = ensureStoreLoaded();
  const cleanLabel = params.label.trim().slice(0, 80) || (params.accountType === "DEMO" ? "Demo Agent" : "Regular User");
  const cleanMinutes = Math.max(1, Math.min(43200, Math.round(params.minutes || 30)));
  const cleanCaptureLimit = Math.max(1, Math.min(10000, Math.round(params.captureLimit || 15)));
  const cleanPromptLimit = Math.max(
    cleanCaptureLimit,
    Math.min(10000, Math.round(params.promptLimit ?? Math.max(cleanCaptureLimit * 2, 40)))
  );

  const prefix = params.accountType === "DEMO" ? "DEMO" : "CP";
  const token = `${prefix}-${crypto.randomBytes(3).toString("hex").toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

  const expiresAt =
    params.expiryHours && params.expiryHours > 0
      ? new Date(Date.now() + params.expiryHours * 60 * 60 * 1000).toISOString()
      : null;

  const record: AdminAccountRecord = {
    id: `acc-${crypto.randomBytes(4).toString("hex")}`,
    token,
    label: cleanLabel,
    email: (params.email || "").trim().slice(0, 120),
    accountType: params.accountType,
    status: "Active",
    remainingSeconds: cleanMinutes * 60,
    totalMinutesGranted: cleanMinutes,
    capturesUsed: 0,
    captureLimit: cleanCaptureLimit,
    promptsUsed: 0,
    promptLimit: cleanPromptLimit,
    createdAt: new Date().toISOString(),
    expiresAt,
    lastActiveAt: null,
    notes: params.notes?.trim().slice(0, 240),
  };

  db.accounts.unshift(record);
  persistStore();
  return record;
}

export function findAccountByToken(token: string): AdminAccountRecord | null {
  const db = ensureStoreLoaded();
  const clean = token.trim();
  if (!clean) return null;
  const found = db.accounts.find((a) => a.token === clean) ?? null;
  if (found && syncAccountExpiry(found)) {
    persistStore();
  }
  return found;
}

export function listAllAccounts(opts?: {
  search?: string;
  filter?: "all" | "active" | "demo" | "expired";
}): AdminAccountRecord[] {
  const db = ensureStoreLoaded();
  let dirty = false;
  for (const acc of db.accounts) {
    if (syncAccountExpiry(acc)) dirty = true;
  }
  if (dirty) persistStore();

  const q = (opts?.search || "").trim().toLowerCase();
  const filter = opts?.filter || "all";

  return db.accounts.filter((acc) => {
    if (filter === "active" && acc.status !== "Active") return false;
    if (filter === "demo" && acc.accountType !== "DEMO") return false;
    if (filter === "expired" && acc.status !== "Expired" && acc.status !== "Suspended") {
      return false;
    }
    if (q) {
      const hay = `${acc.token} ${acc.label} ${acc.email} ${acc.accountType} ${acc.status}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function updateAccountStatus(
  token: string,
  status: AccountStatus,
  extendHoursIfExpired?: number
): AdminAccountRecord | null {
  const db = ensureStoreLoaded();
  const acc = db.accounts.find((a) => a.token === token.trim());
  if (!acc) return null;

  acc.status = status;
  if (status === "Active") {
    // If re-activating an expired account whose expiry timestamp is in the past, extend expiry
    if (acc.expiresAt && Date.parse(acc.expiresAt) <= Date.now()) {
      const addHours = extendHoursIfExpired && extendHoursIfExpired > 0 ? extendHoursIfExpired : 24;
      acc.expiresAt = new Date(Date.now() + addHours * 60 * 60 * 1000).toISOString();
    }
    if (acc.remainingSeconds <= 0) {
      acc.remainingSeconds = 30 * 60;
      acc.totalMinutesGranted += 30;
    }
  }
  persistStore();
  return acc;
}

export function adjustAccountQuotas(
  token: string,
  patch: {
    deltaMinutes?: number;
    deltaCaptures?: number;
    deltaPrompts?: number;
    resetUsed?: boolean;
    extendExpiryHours?: number;
  }
): AdminAccountRecord | null {
  const db = ensureStoreLoaded();
  const acc = db.accounts.find((a) => a.token === token.trim());
  if (!acc) return null;

  if (typeof patch.deltaMinutes === "number" && Number.isFinite(patch.deltaMinutes)) {
    const deltaMin = Math.max(-10080, Math.min(10080, Math.round(patch.deltaMinutes)));
    acc.remainingSeconds = Math.max(0, acc.remainingSeconds + deltaMin * 60);
    if (deltaMin > 0) {
      acc.totalMinutesGranted += deltaMin;
      // If admin explicitly adds time to an expired account (not suspended), reactivate smoothly
      if (acc.status === "Expired") {
        acc.status = "Active";
        if (acc.expiresAt && Date.parse(acc.expiresAt) <= Date.now()) {
          acc.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        }
      }
    }
  }

  if (typeof patch.deltaCaptures === "number" && Number.isFinite(patch.deltaCaptures)) {
    const deltaCap = Math.max(-5000, Math.min(5000, Math.round(patch.deltaCaptures)));
    acc.captureLimit = Math.max(0, acc.captureLimit + deltaCap);
  }

  if (typeof patch.deltaPrompts === "number" && Number.isFinite(patch.deltaPrompts)) {
    const deltaPr = Math.max(-5000, Math.min(5000, Math.round(patch.deltaPrompts)));
    acc.promptLimit = Math.max(0, acc.promptLimit + deltaPr);
  }

  if (patch.resetUsed) {
    acc.capturesUsed = 0;
    acc.promptsUsed = 0;
  }

  if (
    typeof patch.extendExpiryHours === "number" &&
    Number.isFinite(patch.extendExpiryHours) &&
    patch.extendExpiryHours > 0
  ) {
    const baseMs =
      acc.expiresAt && Date.parse(acc.expiresAt) > Date.now()
        ? Date.parse(acc.expiresAt)
        : Date.now();
    acc.expiresAt = new Date(
      baseMs + Math.min(8760, patch.extendExpiryHours) * 60 * 60 * 1000
    ).toISOString();
    if (acc.status === "Expired") {
      acc.status = "Active";
    }
  }

  persistStore();
  return acc;
}

export function deleteAccountByToken(token: string): boolean {
  const db = ensureStoreLoaded();
  const idx = db.accounts.findIndex((a) => a.token === token.trim());
  if (idx === -1) return false;
  db.accounts.splice(idx, 1);
  persistStore();
  return true;
}

export function consumeAccountUsage(
  token: string,
  usage: {
    elapsedSeconds?: number;
    addCaptures?: number;
    addPrompts?: number;
  }
): AccountQuotaSnapshot | null {
  const db = ensureStoreLoaded();
  const acc = db.accounts.find((a) => a.token === token.trim());
  if (!acc) return null;

  syncAccountExpiry(acc);

  if (
    typeof usage.elapsedSeconds === "number" &&
    Number.isFinite(usage.elapsedSeconds) &&
    usage.elapsedSeconds > 0
  ) {
    const bounded = Math.min(300, Math.round(usage.elapsedSeconds));
    acc.remainingSeconds = Math.max(0, acc.remainingSeconds - bounded);
  }
  if (
    typeof usage.addCaptures === "number" &&
    Number.isFinite(usage.addCaptures) &&
    usage.addCaptures > 0
  ) {
    acc.capturesUsed += Math.min(10, Math.round(usage.addCaptures));
  }
  if (
    typeof usage.addPrompts === "number" &&
    Number.isFinite(usage.addPrompts) &&
    usage.addPrompts > 0
  ) {
    acc.promptsUsed += Math.min(10, Math.round(usage.addPrompts));
  }

  acc.lastActiveAt = new Date().toISOString();
  persistStore();
  return buildQuotaSnapshot(acc);
}

export function checkQuotaForAction(
  token: string | undefined,
  action: "answer" | "capture"
): { allowed: true; account?: AdminAccountRecord } | { allowed: false; reason: string; quota?: AccountQuotaSnapshot } {
  if (!token || !token.trim()) {
    // Allow unlinked local fallback only if no token submitted
    return { allowed: true };
  }
  const acc = findAccountByToken(token);
  if (!acc) {
    return { allowed: true };
  }

  const snap = buildQuotaSnapshot(acc);
  if (snap.blockedReason) {
    return { allowed: false, reason: snap.blockedReason, quota: snap };
  }
  if (action === "capture" && acc.capturesUsed >= acc.captureLimit) {
    return {
      allowed: false,
      reason: `Screenshot capture limit exhausted (${acc.capturesUsed}/${acc.captureLimit}). Ask the admin to add extra captures, then click Reconnect.`,
      quota: snap,
    };
  }
  if (action === "answer" && acc.promptsUsed >= acc.promptLimit) {
    return {
      allowed: false,
      reason: `AI prompt limit exhausted (${acc.promptsUsed}/${acc.promptLimit}). Ask the admin to add extra prompts, then click Reconnect.`,
      quota: snap,
    };
  }
  return { allowed: true, account: acc };
}

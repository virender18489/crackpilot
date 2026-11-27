export interface CrackpilotDesktopBridge {
  isElectron: boolean;
  version?: string;
  minimizeWindow: () => Promise<{ ok: boolean; hidden: boolean } | void>;
  minimizeWindowSync?: () => boolean;
  hideWindow: () => Promise<{ ok: boolean; hidden: boolean } | void>;
  closeWindow?: () => Promise<{ ok: boolean } | void>;
  showWindow: () => Promise<{ ok: boolean } | void>;
  toggleMaximize: () => Promise<boolean>;
  setCompact: (compact: boolean) => Promise<void>;
  setOpacity: (opacity: number) => Promise<void>;
  setAlwaysOnTop: (enabled: boolean) => Promise<void>;
  setBehindMode?: (enabled: boolean) => Promise<boolean>;
  toggleBehindMode?: () => Promise<boolean>;
  getBehindMode?: () => Promise<boolean>;
  setBehindHoverInteractive?: (hovering: boolean) => Promise<boolean>;
  openExternal: (url: string) => Promise<void>;
  reloadLiveApp?: () => Promise<{ ok: boolean } | void>;
  captureScreen?: () => Promise<{
    ok: boolean;
    base64?: string;
    mimeType?: string;
    dataUrl?: string;
    byteLength?: number;
    error?: string;
  }>;
  onBehindModeChanged?: (callback: (enabled: boolean) => void) => () => void;
  onWindowMinimized?: (callback: () => void) => () => void;
  onWindowClosing?: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    crackpilotDesktop?: CrackpilotDesktopBridge;
  }
}

const SERVER_STORAGE_KEY = "crackpilot_api_base_url";
export const DEFAULT_BACKEND_URL = "https://crackpilot.vercel.app";
export const DEFAULT_PRODUCTION_API_URL = DEFAULT_BACKEND_URL;

function readEnvApiBase(): string {
  const raw =
    (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ?.VITE_API_BASE_URL?.trim() || "";
  return raw.replace(/\/+$/, "");
}

/**
 * Detects private Google AI Studio preview proxy URLs (`ais-pre-*.run.app` / `ais-dev-*.run.app`).
 * Outside of AI Studio's authenticated browser session, those URLs redirect to a Google Login HTML page
 * and must NEVER be used as the default API base for standalone Electron `.exe` or Vercel builds.
 */
export function isAuthWalledPreviewUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const isAiStudioProxy = /^ais-(pre|dev)-.+\.run\.app$/i.test(parsed.hostname);
    if (!isAiStudioProxy) return false;
    if (typeof window !== "undefined" && window.location.origin === parsed.origin) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function isDesktopApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(
      window.crackpilotDesktop?.isElectron ||
        window.location?.protocol === "file:" ||
        (typeof navigator !== "undefined" &&
          typeof navigator.userAgent === "string" &&
          navigator.userAgent.includes("Electron"))
    );
  } catch {
    return false;
  }
}

export function getApiBaseUrl(): string {
  if (typeof window === "undefined") return "";
  const envBase = readEnvApiBase();

  if (!isDesktopApp()) {
    if (envBase && isAuthWalledPreviewUrl(envBase)) {
      console.warn(
        "[Crackpilot API] Ignoring auth-walled VITE_API_BASE_URL in web build:",
        envBase
      );
      return "";
    }
    return envBase;
  }

  // Electron desktop: prefer explicitly saved Server URL in Settings ("•••")
  try {
    const saved = window.localStorage.getItem(SERVER_STORAGE_KEY)?.trim();
    if (saved) {
      const normalized = saved.replace(/\/+$/, "");
      if (isAuthWalledPreviewUrl(normalized)) {
        console.warn(
          "[Crackpilot API] Ignoring stale auth-walled AI Studio preview URL from localStorage:",
          normalized
        );
        window.localStorage.removeItem(SERVER_STORAGE_KEY);
      } else if (/^https?:\/\//i.test(normalized)) {
        return normalized;
      }
    }
  } catch (err) {
    console.warn("[Crackpilot API] Could not read saved server URL:", err);
  }

  if (envBase && !isAuthWalledPreviewUrl(envBase) && /^https?:\/\//i.test(envBase)) {
    return envBase;
  }

  // Electron desktop default: NEVER return empty string (which resolves to file:///api/...).
  // Always route API calls to the deployed production backend unless overridden in Settings.
  return DEFAULT_BACKEND_URL;
}

export function hasConfiguredBackend(): boolean {
  if (typeof window === "undefined") return Boolean(DEFAULT_BACKEND_URL);
  return Boolean(getApiBaseUrl() || DEFAULT_BACKEND_URL);
}

export function setApiBaseUrl(url: string): string {
  const cleaned = url.trim().replace(/\/+$/, "");
  if (typeof window !== "undefined") {
    try {
      if (cleaned) {
        if (!/^https?:\/\//i.test(cleaned)) {
          throw new Error("Server URL must start with http:// or https://");
        }
        window.localStorage.setItem(SERVER_STORAGE_KEY, cleaned);
      } else {
        window.localStorage.removeItem(SERVER_STORAGE_KEY);
      }
    } catch (err) {
      console.error("[Crackpilot API] Failed to save server URL:", err);
      throw err;
    }
  }
  return cleaned;
}

export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const base = getApiBaseUrl();
  if (base && /^https?:\/\//i.test(base)) {
    return `${base}${normalized}`;
  }
  if (
    typeof window !== "undefined" &&
    (isDesktopApp() ||
      window.location.protocol === "file:" ||
      window.location.origin === "null")
  ) {
    return `${DEFAULT_BACKEND_URL}${normalized}`;
  }
  return normalized;
}

export function wsUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const base = getApiBaseUrl();
  if (base && /^https?:\/\//i.test(base)) {
    return `${base.replace(/^http/i, "ws")}${normalized}`;
  }
  if (typeof window === "undefined") {
    return `ws://localhost:3000${normalized}`;
  }
  if (
    isDesktopApp() ||
    window.location.protocol === "file:" ||
    window.location.origin === "null"
  ) {
    return `${DEFAULT_BACKEND_URL.replace(/^http/i, "ws")}${normalized}`;
  }
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}${normalized}`;
}

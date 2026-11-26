export interface CrackpilotDesktopBridge {
  isElectron: boolean;
  version?: string;
  minimizeWindow: () => Promise<{ ok: boolean; hidden: boolean } | void>;
  minimizeWindowSync?: () => boolean;
  hideWindow: () => Promise<{ ok: boolean; hidden: boolean } | void>;
  showWindow: () => Promise<{ ok: boolean } | void>;
  toggleMaximize: () => Promise<boolean>;
  setCompact: (compact: boolean) => Promise<void>;
  setOpacity: (opacity: number) => Promise<void>;
  setAlwaysOnTop: (enabled: boolean) => Promise<void>;
  openExternal: (url: string) => Promise<void>;
}

declare global {
  interface Window {
    crackpilotDesktop?: CrackpilotDesktopBridge;
  }
}

const SERVER_STORAGE_KEY = "crackpilot_api_base_url";

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
  return Boolean(
    window.crackpilotDesktop?.isElectron ||
      window.location.protocol === "file:" ||
      navigator.userAgent.includes("Electron")
  );
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
      } else {
        return normalized;
      }
    }
  } catch (err) {
    console.warn("[Crackpilot API] Could not read saved server URL:", err);
  }

  if (envBase && !isAuthWalledPreviewUrl(envBase)) {
    return envBase;
  }

  // Standalone desktop mode: no private proxy URL hardcoded — falls back cleanly to local auth/session
  return "";
}

export function hasConfiguredBackend(): boolean {
  if (typeof window === "undefined") return false;
  if (isDesktopApp()) {
    return Boolean(getApiBaseUrl());
  }
  return window.location.protocol === "http:" || window.location.protocol === "https:";
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
  return base ? `${base}${normalized}` : normalized;
}

export function wsUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const base = getApiBaseUrl();
  if (base) {
    return `${base.replace(/^http/i, "ws")}${normalized}`;
  }
  if (typeof window === "undefined") {
    return `ws://localhost:3000${normalized}`;
  }
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}${normalized}`;
}

export interface CrackpilotDesktopBridge {
  isElectron: boolean;
  minimizeWindow: () => Promise<void>;
  hideWindow: () => Promise<void>;
  showWindow: () => Promise<void>;
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
const DEFAULT_DESKTOP_API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ||
  "https://ais-pre-xd2kveu6r7j7jhuqh3qugu-628952540927.asia-southeast1.run.app";

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
  const envBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)
    ?.trim()
    ?.replace(/\/+$/, "");

  if (!isDesktopApp()) {
    return envBase || "";
  }

  try {
    const saved = window.localStorage.getItem(SERVER_STORAGE_KEY)?.trim();
    if (saved) return saved.replace(/\/+$/, "");
  } catch {
    // Ignore storage restriction
  }
  return (envBase || DEFAULT_DESKTOP_API_BASE).replace(/\/+$/, "");
}

export function setApiBaseUrl(url: string): string {
  const cleaned = url.trim().replace(/\/+$/, "");
  if (typeof window !== "undefined") {
    try {
      if (cleaned) {
        window.localStorage.setItem(SERVER_STORAGE_KEY, cleaned);
      } else {
        window.localStorage.removeItem(SERVER_STORAGE_KEY);
      }
    } catch {
      // Ignore storage restriction
    }
  }
  return cleaned || DEFAULT_DESKTOP_API_BASE;
}

export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const base = getApiBaseUrl();
  return base ? `${base}${normalized}` : normalized;
}

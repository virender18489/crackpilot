import { useEffect, useState } from "react";
import { AdminPanel } from "./components/AdminPanel";
import { Dashboard } from "./components/Dashboard";
import { LandingPage } from "./components/LandingPage";
import { LoginView } from "./components/LoginView";
import { SoftwareOverlay } from "./components/SoftwareOverlay";
import { apiUrl, isDesktopApp } from "./lib/api";
import {
  hydrateWorkspaceState,
  logoutAccount,
  probeBackendHealth,
  subscribeLocalSync,
} from "./lib/clientStore";
import type {
  AccountQuotaSnapshot,
  DashboardTab,
  RootView,
  SessionTokenState,
  TargetProfile,
  UserAccount,
} from "./types";

import {
  DEFAULT_ANSWER_STYLE,
  normalizeAnswerStyle,
  normalizeProgrammingLanguage,
} from "./data/roleSkills";

const DEFAULT_PROFILE: TargetProfile = {
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
};

function sanitizeProfile(raw: TargetProfile): TargetProfile {
  return {
    ...DEFAULT_PROFILE,
    ...raw,
    answerStyle: normalizeAnswerStyle(raw.answerStyle),
    dsaModeEnabled: Boolean(raw.dsaModeEnabled),
    preferredLanguage: normalizeProgrammingLanguage(raw.preferredLanguage),
  };
}

function getViewFromLocation(): RootView {
  if (typeof window === "undefined") return "landing";
  const pathname = window.location.pathname.replace(/\/+$/, "").toLowerCase();
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");

  if (pathname === "/admin" || mode === "admin") return "admin";
  if (pathname === "/overlay" || mode === "software") return "software";
  if (pathname === "/dashboard" || mode === "dashboard") return "dashboard";
  if (pathname === "/login" || mode === "login") return "login";
  if (isDesktopApp()) return "software";
  return "landing";
}

export default function App() {
  const [view, setView] = useState<RootView>(getViewFromLocation);
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>("overview");
  const [user, setUser] = useState<UserAccount | null>(null);
  const [tokenState, setTokenState] = useState<SessionTokenState | null>(null);
  const [profile, setProfile] = useState<TargetProfile>(DEFAULT_PROFILE);

  // Keep view synced with browser Back/Forward navigation
  useEffect(() => {
    const onPopState = () => {
      setView(getViewFromLocation());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Hydrate auth, token, and target profile safely from backend or local storage
  useEffect(() => {
    let active = true;
    const desktop = isDesktopApp();

    void hydrateWorkspaceState(DEFAULT_PROFILE)
      .then((state) => {
        if (!active) return;
        if (state.user) setUser(state.user);
        if (state.token) setTokenState(state.token);
        if (state.profile) setProfile(sanitizeProfile(state.profile));
      })
      .catch((err) => {
        console.error("[Crackpilot App] Workspace hydration failed:", err);
      });

    const unsubLocal = subscribeLocalSync((msg) => {
      if (msg.token !== undefined) setTokenState(msg.token);
      if (msg.profile) setProfile(sanitizeProfile(msg.profile));
    });

    // Only open SSE when /api/health confirms a real Express backend is running.
    // Prevents MIME/HTML EventSource errors on Vercel static hosting & standalone Electron.
    let sse: EventSource | null = null;
    void probeBackendHealth().then((healthy) => {
      if (!active || !healthy) return;
      try {
        const eventsUrl = apiUrl("/api/events");
        sse = new EventSource(eventsUrl);
        sse.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data) as {
              type?: string;
              token?: SessionTokenState | null;
              tokenValue?: string;
              quota?: AccountQuotaSnapshot;
              profile?: TargetProfile;
            };
            // On fresh Desktop .exe boot, never auto-skip Gate 1 from initial "connected" payload
            if (
              msg.token !== undefined &&
              !(desktop && msg.type === "connected")
            ) {
              setTokenState(msg.token);
            }
            if (msg.type === "quota_updated" && msg.quota && msg.tokenValue) {
              setTokenState((prev) =>
                prev && prev.token === msg.tokenValue
                  ? { ...prev, quota: msg.quota }
                  : prev
              );
            }
            if (msg.type === "account_revoked" && msg.tokenValue) {
              setTokenState((prev) =>
                prev && prev.token === msg.tokenValue ? null : prev
              );
            }
            if (msg.profile) setProfile(sanitizeProfile(msg.profile));
          } catch (parseErr) {
            console.warn(
              "[Crackpilot App SSE] Malformed event payload:",
              parseErr
            );
          }
        };
        sse.onerror = () => {
          console.warn(
            "[Crackpilot App SSE] Stream error on",
            eventsUrl,
            "— closing."
          );
          sse?.close();
          sse = null;
        };
      } catch (err) {
        console.error(
          "[Crackpilot App SSE] Failed to initialize EventSource:",
          err
        );
        sse = null;
      }
    });

    return () => {
      active = false;
      unsubLocal();
      sse?.close();
    };
  }, []);

  const navigateClean = (nextView: RootView, nextPath = "/") => {
    if (
      typeof window !== "undefined" &&
      window.location.pathname !== nextPath &&
      !isDesktopApp()
    ) {
      window.history.replaceState({}, "", nextPath);
    }
    setView(nextView);
  };

  const handleLogout = async () => {
    await logoutAccount();
    setUser(null);
    navigateClean("landing", "/");
  };

  if (view === "admin") {
    return (
      <AdminPanel
        currentUser={user}
        onRedirectDashboard={() => {
          setDashboardTab("overview");
          navigateClean("dashboard", "/");
        }}
        onGoHome={() => navigateClean("landing", "/")}
      />
    );
  }

  if (view === "software") {
    return (
      <SoftwareOverlay
        tokenState={tokenState}
        profile={profile}
        onTokenChange={setTokenState}
        onProfileChange={setProfile}
        onGoDashboard={() => {
          setDashboardTab("overview");
          navigateClean("dashboard", "/");
        }}
      />
    );
  }

  if (view === "login") {
    return (
      <LoginView
        onBackHome={() => navigateClean("landing", "/")}
        onLoginSuccess={(loggedInUser) => {
          setUser(loggedInUser);
          setDashboardTab("overview");
          navigateClean("dashboard", "/");
        }}
        onLaunchSoftware={() => setView("software")}
      />
    );
  }

  if (view === "dashboard") {
    return (
      <Dashboard
        user={user}
        activeTab={dashboardTab}
        onTabChange={setDashboardTab}
        tokenState={tokenState}
        profile={profile}
        onTokenChange={setTokenState}
        onProfileChange={setProfile}
        onOpenSoftware={() => setView("software")}
        onLogout={() => void handleLogout()}
        onGoHome={() => navigateClean("landing", "/")}
      />
    );
  }

  return (
    <LandingPage
      isLoggedIn={Boolean(user)}
      onGoLogin={() => setView("login")}
      onGoDashboard={() => {
        setDashboardTab("overview");
        navigateClean("dashboard", "/");
      }}
      onOpenTestingLab={() => {
        setDashboardTab("testing");
        navigateClean("dashboard", "/");
      }}
      onOpenSoftware={() => setView("software")}
    />
  );
}

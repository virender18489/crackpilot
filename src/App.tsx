import { useEffect, useState } from "react";
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
  DashboardTab,
  RootView,
  SessionTokenState,
  TargetProfile,
  UserAccount,
} from "./types";

const DEFAULT_PROFILE: TargetProfile = {
  role: "Frontend Developer (React & TypeScript)",
  experience: "3 years",
  skills:
    "React, TypeScript, Next.js, Tailwind CSS, Node.js, REST APIs, System Design",
  resumeFileName: "",
  resumeText: "",
  jdFileName: "",
  jdText: "",
  answerLanguage: "English",
  answerStyle: "Concise Bullets",
};

function getInitialView(): RootView {
  if (typeof window === "undefined") return "landing";
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  if (mode === "software") return "software";
  if (mode === "dashboard") return "dashboard";
  if (mode === "login") return "login";
  if (isDesktopApp()) return "software";
  return "landing";
}

export default function App() {
  const [view, setView] = useState<RootView>(getInitialView);
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>("overview");
  const [user, setUser] = useState<UserAccount | null>(null);
  const [tokenState, setTokenState] = useState<SessionTokenState | null>(null);
  const [profile, setProfile] = useState<TargetProfile>(DEFAULT_PROFILE);

  // Hydrate auth, token, and target profile safely from backend or local storage
  useEffect(() => {
    let active = true;
    const desktop = isDesktopApp();

    void hydrateWorkspaceState(DEFAULT_PROFILE)
      .then((state) => {
        if (!active) return;
        if (state.user) setUser(state.user);
        if (state.token) setTokenState(state.token);
        if (state.profile) setProfile(state.profile);
      })
      .catch((err) => {
        console.error("[Crackpilot App] Workspace hydration failed:", err);
      });

    const unsubLocal = subscribeLocalSync((msg) => {
      if (msg.token !== undefined) setTokenState(msg.token);
      if (msg.profile) setProfile(msg.profile);
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
              profile?: TargetProfile;
            };
            // On fresh Desktop .exe boot, never auto-skip Gate 1 from initial "connected" payload
            if (msg.token !== undefined && !(desktop && msg.type === "connected")) {
              setTokenState(msg.token);
            }
            if (msg.profile) setProfile(msg.profile);
          } catch (parseErr) {
            console.warn("[Crackpilot App SSE] Malformed event payload:", parseErr);
          }
        };
        sse.onerror = () => {
          console.warn("[Crackpilot App SSE] Stream error on", eventsUrl, "— closing.");
          sse?.close();
          sse = null;
        };
      } catch (err) {
        console.error("[Crackpilot App SSE] Failed to initialize EventSource:", err);
        sse = null;
      }
    });

    return () => {
      active = false;
      unsubLocal();
      sse?.close();
    };
  }, []);

  const handleLogout = async () => {
    await logoutAccount();
    setUser(null);
    setView("landing");
  };

  if (view === "software") {
    return (
      <SoftwareOverlay
        tokenState={tokenState}
        profile={profile}
        onTokenChange={setTokenState}
        onProfileChange={setProfile}
        onGoDashboard={() => {
          setDashboardTab("overview");
          setView("dashboard");
        }}
      />
    );
  }

  if (view === "login") {
    return (
      <LoginView
        onBackHome={() => setView("landing")}
        onLoginSuccess={(loggedInUser) => {
          setUser(loggedInUser);
          setDashboardTab("overview");
          setView("dashboard");
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
        onGoHome={() => setView("landing")}
      />
    );
  }

  return (
    <LandingPage
      isLoggedIn={Boolean(user)}
      onGoLogin={() => setView("login")}
      onGoDashboard={() => {
        setDashboardTab("overview");
        setView("dashboard");
      }}
      onOpenTestingLab={() => {
        setDashboardTab("testing");
        setView("dashboard");
      }}
      onOpenSoftware={() => setView("software")}
    />
  );
}

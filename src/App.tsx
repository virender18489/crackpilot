import { useEffect, useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { LandingPage } from "./components/LandingPage";
import { LoginView } from "./components/LoginView";
import { SoftwareOverlay } from "./components/SoftwareOverlay";
import { apiUrl, isDesktopApp } from "./lib/api";
import {
  hydrateWorkspaceState,
  logoutAccount,
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
    void hydrateWorkspaceState(DEFAULT_PROFILE).then((state) => {
      if (!active) return;
      if (state.user) setUser(state.user);
      if (state.token) setTokenState(state.token);
      if (state.profile) setProfile(state.profile);
    });

    const unsubLocal = subscribeLocalSync((msg) => {
      if (msg.token !== undefined) setTokenState(msg.token);
      if (msg.profile) setProfile(msg.profile);
    });

    // Keep Dashboard & Software tabs synced via server SSE events when backend is present
    let sse: EventSource | null = null;
    try {
      sse = new EventSource(apiUrl("/api/events"));
      sse.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data) as {
            token?: SessionTokenState | null;
            profile?: TargetProfile;
          };
          if (msg.token !== undefined) setTokenState(msg.token);
          if (msg.profile) setProfile(msg.profile);
        } catch {
          // Ignore malformed payloads
        }
      };
      sse.onerror = () => {
        // Close silently if hosted on static frontend without SSE server
        sse?.close();
      };
    } catch {
      sse = null;
    }

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

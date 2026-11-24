import { useEffect, useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { InstallerModal } from "./components/InstallerModal";
import { LandingPage } from "./components/LandingPage";
import { LoginView } from "./components/LoginView";
import { SoftwareOverlay } from "./components/SoftwareOverlay";
import {
  downloadCrackpilotDesktopKit,
  downloadCrackpilotExtension,
  type DownloadPlatform,
} from "./data/crackpilotPackages";
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
  return "landing";
}

export default function App() {
  const [view, setView] = useState<RootView>(getInitialView);
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>("overview");
  const [user, setUser] = useState<UserAccount | null>(null);
  const [tokenState, setTokenState] = useState<SessionTokenState | null>(null);
  const [profile, setProfile] = useState<TargetProfile>(DEFAULT_PROFILE);
  const [installerOpen, setInstallerOpen] = useState(false);
  const [installerPlatform, setInstallerPlatform] =
    useState<DownloadPlatform>("windows");

  // Hydrate auth, token, and target profile from backend
  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(
        (data: {
          user?: UserAccount | null;
          token?: SessionTokenState | null;
          profile?: TargetProfile;
        }) => {
          if (!active) return;
          if (data.user) setUser(data.user);
          if (data.token) setTokenState(data.token);
          if (data.profile) setProfile(data.profile);
        }
      )
      .catch(() => {
        // Ignore initial network hiccup
      });

    // Keep Dashboard & Software tabs synced via server SSE events
    const sse = new EventSource("/api/events");
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

    return () => {
      active = false;
      sse.close();
    };
  }, []);

  const handleTriggerDownload = async (platform: DownloadPlatform) => {
    setInstallerPlatform(platform);
    setInstallerOpen(true);
    if (platform === "extension") {
      await downloadCrackpilotExtension();
    } else {
      await downloadCrackpilotDesktopKit(tokenState?.token);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    setView("landing");
  };

  const installerModal = (
    <InstallerModal
      open={installerOpen}
      platform={installerPlatform}
      tokenState={tokenState}
      onTokenChange={setTokenState}
      onClose={() => setInstallerOpen(false)}
      onLaunchSoftware={() => setView("software")}
      onOpenDashboard={() => {
        setDashboardTab("overview");
        setView("dashboard");
      }}
      onOpenTestingLab={() => {
        setDashboardTab("testing");
        setView("dashboard");
      }}
    />
  );

  if (view === "software") {
    return (
      <>
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
        {installerModal}
      </>
    );
  }

  if (view === "login") {
    return (
      <>
        <LoginView
          onBackHome={() => setView("landing")}
          onLoginSuccess={(loggedInUser) => {
            setUser(loggedInUser);
            setDashboardTab("overview");
            setView("dashboard");
          }}
          onLaunchSoftware={() => setView("software")}
        />
        {installerModal}
      </>
    );
  }

  if (view === "dashboard") {
    return (
      <>
        <Dashboard
          user={user}
          activeTab={dashboardTab}
          onTabChange={setDashboardTab}
          tokenState={tokenState}
          profile={profile}
          onTokenChange={setTokenState}
          onProfileChange={setProfile}
          onOpenSoftware={() => setView("software")}
          onDownload={(platform) => void handleTriggerDownload(platform)}
          onLogout={() => void handleLogout()}
          onGoHome={() => setView("landing")}
        />
        {installerModal}
      </>
    );
  }

  return (
    <>
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
        onDownload={(platform) => void handleTriggerDownload(platform)}
      />
      {installerModal}
    </>
  );
}

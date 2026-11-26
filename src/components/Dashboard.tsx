import { useEffect, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  Chrome,
  Copy,
  Download,
  ExternalLink,
  FileText,
  FlaskConical,
  Headphones,
  KeyRound,
  Keyboard,
  Laptop,
  LayoutDashboard,
  LogOut,
  Mic,
  Monitor,
  Play,
  QrCode,
  RefreshCw,
  Save,
  Shield,
  Smartphone,
  Square,
  Upload,
  UserCheck,
} from "lucide-react";
import {
  WINDOWS_EXE_FILENAME,
  WINDOWS_EXE_URL,
} from "../data/crackpilotPackages";
import {
  extractDocumentText,
  generateSessionToken,
  saveTargetProfile,
  startLiveSession,
} from "../lib/clientStore";
import { LiveAudioQAEngine } from "./LiveAudioQAEngine";
import type {
  AnswerLanguage,
  AnswerStyle,
  DashboardTab,
  SessionTokenState,
  TargetProfile,
  UserAccount,
} from "../types";

interface DashboardProps {
  user: UserAccount | null;
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  tokenState: SessionTokenState | null;
  profile: TargetProfile;
  onTokenChange: (token: SessionTokenState | null) => void;
  onProfileChange: (profile: TargetProfile) => void;
  onOpenSoftware: () => void;
  onLogout: () => void;
  onGoHome: () => void;
}

const TEST_SHORTCUTS = [
  { combo: "alt+t", label: "Alt+T", action: "Auto-Scroll ON / OFF" },
  { combo: "alt+x", label: "Alt+X", action: "Fast 3-Bullet Answer" },
  { combo: "alt+s", label: "Alt+S", action: "Capture Screen / Chat Box" },
  { combo: "alt+v", label: "Alt+V", action: "4s–10s Video Page Scan" },
  { combo: "alt+r", label: "Alt+R", action: "Instant Reconnect" },
  { combo: "alt+h", label: "Alt+H", action: "Hide / Show Overlay" },
  { combo: "alt+f", label: "Alt+F", action: "Increase Q&A Font Size" },
  { combo: "alt+d", label: "Alt+D", action: "Disconnect Session" },
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(new Error("Could not read selected file."));
    reader.readAsDataURL(file);
  });
}

export function Dashboard({
  user,
  activeTab,
  onTabChange,
  tokenState,
  profile,
  onTokenChange,
  onProfileChange,
  onOpenSoftware,
  onLogout,
  onGoHome,
}: DashboardProps) {
  // Overview token & session states
  const [generatingToken, setGeneratingToken] = useState(false);
  const [startingSession, setStartingSession] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [overviewNotice, setOverviewNotice] = useState<string | null>(null);

  // Target Profile draft state
  const [draftProfile, setDraftProfile] = useState<TargetProfile>(profile);
  const [savingProfile, setSavingProfile] = useState(false);
  const [extractingResume, setExtractingResume] = useState(false);
  const [extractingJd, setExtractingJd] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);

  // Testing Lab states
  const [pipStatus, setPipStatus] = useState<string | null>(null);
  const [audioTestMode, setAudioTestMode] = useState<"idle" | "tab" | "mic">(
    "idle"
  );
  const [audioTestLevel, setAudioTestLevel] = useState(0);
  const [audioTestNotice, setAudioTestNotice] = useState<string | null>(null);
  const [pressedShortcut, setPressedShortcut] = useState<string | null>(null);

  const testStreamRef = useRef<MediaStream | null>(null);
  const testAudioCtxRef = useRef<AudioContext | null>(null);
  const testRafRef = useRef<number | null>(null);

  useEffect(() => {
    setDraftProfile(profile);
  }, [profile]);

  useEffect(() => {
    if (activeTab !== "testing") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const key = e.key.toLowerCase();
      const combo = `alt+${key}`;
      if (TEST_SHORTCUTS.some((s) => s.combo === combo)) {
        e.preventDefault();
        setPressedShortcut(combo);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTab]);

  const stopAudioTest = () => {
    if (testRafRef.current !== null) {
      cancelAnimationFrame(testRafRef.current);
      testRafRef.current = null;
    }
    if (testAudioCtxRef.current) {
      void testAudioCtxRef.current.close();
      testAudioCtxRef.current = null;
    }
    if (testStreamRef.current) {
      testStreamRef.current.getTracks().forEach((t) => t.stop());
      testStreamRef.current = null;
    }
    setAudioTestMode("idle");
    setAudioTestLevel(0);
  };

  useEffect(() => {
    return () => stopAudioTest();
  }, []);

  const handleGenerateToken = async () => {
    setGeneratingToken(true);
    setOverviewNotice(null);
    try {
      const token = await generateSessionToken();
      onTokenChange(token);
      setOverviewNotice(
        "48h Auth Token generated! Copy it, open Crackpilot Software, paste the token, and click Authenticate."
      );
    } catch (err) {
      console.error("[Crackpilot Dashboard] Generate token failed:", err);
      setOverviewNotice(
        err instanceof Error ? err.message : "Could not generate token."
      );
    } finally {
      setGeneratingToken(false);
    }
  };

  const handleCopyToken = async () => {
    if (!tokenState?.token) return;
    try {
      await navigator.clipboard.writeText(tokenState.token);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 1600);
    } catch {
      // Ignore
    }
  };

  const handleStartSession = async () => {
    setOverviewNotice(null);
    if (!tokenState) {
      setOverviewNotice("Generate a 48h Token first before starting a session.");
      return;
    }
    if (!tokenState.authenticated) {
      setOverviewNotice(
        "Copy the token, open Crackpilot Software, and click Authenticate first."
      );
      return;
    }

    setStartingSession(true);
    try {
      const result = await startLiveSession();
      onTokenChange(result.token);
      onOpenSoftware();
    } catch (err) {
      console.error("[Crackpilot Dashboard] Start session failed:", err);
      setOverviewNotice(
        err instanceof Error ? err.message : "Failed to start session."
      );
    } finally {
      setStartingSession(false);
    }
  };

  const handleUploadDoc = async (
    file: File | undefined,
    kind: "resume" | "jd"
  ) => {
    if (!file) return;
    setProfileNotice(null);
    if (kind === "resume") setExtractingResume(true);
    else setExtractingJd(true);

    try {
      const base64 = await fileToBase64(file);
      const extracted = await extractDocumentText({ file, base64, kind });
      setDraftProfile((prev) =>
        kind === "resume"
          ? { ...prev, resumeFileName: file.name, resumeText: extracted }
          : { ...prev, jdFileName: file.name, jdText: extracted }
      );
      setProfileNotice(
        `${kind === "resume" ? "Resume" : "Job Description"} extracted from "${file.name}". Click Save Target Profile to sync with Crackpilot.`
      );
    } catch (err) {
      console.error("[Crackpilot Dashboard] Document extract failed:", err);
      setProfileNotice(
        err instanceof Error ? err.message : "Could not process document."
      );
    } finally {
      if (kind === "resume") setExtractingResume(false);
      else setExtractingJd(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileNotice(null);
    try {
      const saved = await saveTargetProfile(draftProfile);
      onProfileChange(saved);
      setProfileNotice(
        "Target Profile saved & synced! Crackpilot software will now tailor every answer to this Role, Resume, and JD."
      );
    } catch (err) {
      console.error("[Crackpilot Dashboard] Save profile failed:", err);
      setProfileNotice(
        err instanceof Error ? err.message : "Failed to save Target Profile."
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLaunchCrossTabOverlay = async () => {
    setPipStatus(null);
    const docPip = (
      window as unknown as {
        documentPictureInPicture?: {
          requestWindow: (opts: {
            width: number;
            height: number;
          }) => Promise<Window>;
        };
      }
    ).documentPictureInPicture;

    if (!docPip) {
      setPipStatus(
        "Your current browser does not expose Document Picture-in-Picture. Use Chrome/Edge desktop or install the Crackpilot Desktop Kit (Downloads tab) for OS-wide always-on-top."
      );
      return;
    }

    try {
      const pipWin = await docPip.requestWindow({ width: 920, height: 640 });
      pipWin.document.title = "Crackpilot";
      pipWin.document.body.style.margin = "0";
      pipWin.document.body.style.background = "#050709";
      pipWin.document.body.style.overflow = "hidden";

      const iframe = pipWin.document.createElement("iframe");
      iframe.src = `${window.location.origin}/?mode=software`;
      iframe.style.width = "100vw";
      iframe.style.height = "100vh";
      iframe.style.border = "none";
      iframe.allow = "microphone; display-capture; clipboard-write";
      pipWin.document.body.appendChild(iframe);

      setPipStatus(
        "Floating Always-On-Top Crackpilot window opened! Switch to another browser tab (Meet, Zoom, WhatsApp Web) — Crackpilot stays on top."
      );
    } catch (err) {
      setPipStatus(
        err instanceof Error
          ? err.message
          : "Could not open floating overlay window."
      );
    }
  };

  const handleStartAudioTest = async (mode: "tab" | "mic") => {
    stopAudioTest();
    setAudioTestNotice(null);

    try {
      let stream: MediaStream;
      if (mode === "tab") {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        if (stream.getAudioTracks().length === 0) {
          stream.getTracks().forEach((t) => t.stop());
          throw new Error(
            'No audio track detected. Make sure you check "Share tab audio" or "Share system audio" in the popup.'
          );
        }
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      testStreamRef.current = stream;
      setAudioTestMode(mode);

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(
        new MediaStream(stream.getAudioTracks())
      );
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      testAudioCtxRef.current = ctx;

      const buf = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        setAudioTestLevel(Math.min(100, Math.round(rms * 350)));
        testRafRef.current = requestAnimationFrame(tick);
      };
      testRafRef.current = requestAnimationFrame(tick);

      stream.getTracks()[0].onended = () => stopAudioTest();
      setAudioTestNotice(
        mode === "tab"
          ? "Listening to Tab / System audio — play a video, Meet call, or WhatsApp Web voice call (even with headphones) and watch the level meter respond."
          : "Listening to Microphone — speak now to verify input level."
      );
    } catch (err) {
      stopAudioTest();
      setAudioTestNotice(
        err instanceof Error ? err.message : "Audio capture test cancelled."
      );
    }
  };

  const navItems: Array<{
    id: DashboardTab;
    label: string;
    icon: typeof LayoutDashboard;
  }> = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "profile", label: "Target Profile", icon: UserCheck },
    { id: "testing", label: "Testing Lab", icon: FlaskConical },
    { id: "downloads", label: "Downloads", icon: Download },
  ];

  const skillTags = profile.skills
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);

  return (
    <div className="min-h-screen bg-[#050709] text-white flex flex-col lg:flex-row">
      {/* Left Sidebar (exact match to crackpilot WORKSPACE in final-2) */}
      <aside className="w-full lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-white/[0.08] bg-[#080b0f] flex flex-col justify-between">
        <div className="p-5 space-y-6">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onGoHome}
              className="flex items-center gap-2 text-sm font-bold tracking-tight text-white cursor-pointer"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded bg-[#c6f527] text-xs font-extrabold text-[#050709]">
                C
              </span>
              <span>crackpilot</span>
              <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9px] text-zinc-400">
                WORKSPACE
              </span>
            </button>
          </div>

          <nav className="flex lg:flex-col gap-1 overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? "bg-[#1a2210] text-[#c6f527]"
                      : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${active ? "text-[#c6f527]" : "text-zinc-500"}`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Direct Launch Crackpilot App Button */}
          <div className="pt-3 border-t border-white/[0.07]">
            <button
              type="button"
              onClick={onOpenSoftware}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#c6f527] px-3.5 py-2.5 text-xs font-bold text-[#050709] hover:bg-[#b5e41c] transition-colors cursor-pointer"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Open Crackpilot App</span>
            </button>
          </div>
        </div>

        {/* Account footer */}
        <div className="border-t border-white/[0.08] p-4 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-zinc-200">
              {user?.name || "Workspace User"}
            </p>
            <p className="truncate font-mono text-[10px] text-zinc-500">
              {user?.email || "Sign in via Login"}
            </p>
          </div>
          {user && (
            <button
              type="button"
              onClick={onLogout}
              title="Log Out"
              className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-zinc-400 hover:bg-white/[0.06] hover:text-white transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-5 sm:p-8 lg:p-10">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Top workspace status bar matching final-2 */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-4">
            <div className="flex items-center gap-2.5 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
                System Ready
              </span>
              {user?.email && (
                <span className="font-mono text-[11px] text-zinc-400">
                  {user.email}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onGoHome}
              className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              View Website ↗
            </button>
          </div>

          {/* OVERVIEW TAB (exact structure from final-2 Workspace Overview) */}
          {activeTab === "overview" && (
            <>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Workspace Overview
                </h1>
                <p className="mt-1 text-xs text-zinc-400">
                  Quick glance at your active settings, 48h Auth Token, and live
                  session launcher.
                </p>
              </div>

              {/* Top 2 Cards: Active Profile + Session Credits */}
              <div className="grid gap-5 md:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.08] bg-[#0c1015] p-6 space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">Active Profile</span>
                    <button
                      type="button"
                      onClick={() => onTabChange("profile")}
                      className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-[#c6f527] hover:bg-white/[0.08] cursor-pointer"
                    >
                      Configure ↗
                    </button>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      {profile.role}
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {profile.experience} · {profile.answerLanguage} ·{" "}
                      {profile.answerStyle}
                    </p>
                  </div>
                  {skillTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {skillTags.map((sk) => (
                        <span
                          key={sk}
                          className="rounded border border-white/10 bg-[#121820] px-2 py-0.5 font-mono text-[10px] text-zinc-300"
                        >
                          {sk}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-[11px]">
                    <span className="font-mono text-zinc-400">
                      Resume:{" "}
                      <span
                        className={
                          profile.resumeText
                            ? "text-emerald-400"
                            : "text-amber-300"
                        }
                      >
                        {profile.resumeText
                          ? profile.resumeFileName || "Loaded"
                          : "Not uploaded"}
                      </span>
                    </span>
                    <span className="font-mono text-zinc-400">
                      JD:{" "}
                      <span
                        className={
                          profile.jdText ? "text-emerald-400" : "text-amber-300"
                        }
                      >
                        {profile.jdText
                          ? profile.jdFileName || "Loaded"
                          : "Not uploaded"}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.08] bg-[#0c1015] p-6 flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-400">Session Credits</span>
                      <span className="rounded bg-[#1a2210] px-2 py-0.5 font-mono text-[10px] font-bold text-[#c6f527]">
                        PRO PLAN
                      </span>
                    </div>
                    <p className="text-3xl font-extrabold text-white tabular-nums">
                      240 mins left
                    </p>
                    <p className="text-xs text-zinc-400">
                      Screen captures &amp; written prompts: 0 / 80 used
                    </p>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/[0.06] pt-3 text-[11px]">
                    <span className="text-zinc-500">Credits never expire</span>
                    <button
                      type="button"
                      onClick={() => onTabChange("testing")}
                      className="font-semibold text-[#c6f527] hover:underline cursor-pointer"
                    >
                      Open Practice / Testing Lab →
                    </button>
                  </div>
                </div>
              </div>

              {/* Crackpilot Auth Token + Start Session + Downloads Card (exact match to final-2) */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0c1015] p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <KeyRound className="h-5 w-5 text-[#c6f527]" />
                    <div>
                      <h2 className="text-base font-bold text-white">
                        Crackpilot Auth Token{" "}
                        <span className="ml-1.5 font-normal text-xs text-zinc-500">
                          Max 2 devices
                        </span>
                      </h2>
                      <p className="text-xs text-zinc-400">
                        Generate a secure token (valid for 48 hours) to connect
                        your Crackpilot app, then click Start Session.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateToken}
                    disabled={generatingToken}
                    className="inline-flex items-center gap-2 rounded-full bg-[#c6f527] px-5 py-2 text-xs font-bold text-[#050709] hover:bg-[#b5e41c] transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${generatingToken ? "animate-spin" : ""}`}
                    />
                    <span>
                      {tokenState ? "Regenerate 48h Token" : "Generate 48h Token"}
                    </span>
                  </button>
                </div>

                {/* Token Display & Start Session */}
                <div className="rounded-xl border border-white/[0.08] bg-[#070a0e] p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="block font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                      Active Auth Token
                    </span>
                    <span className="mt-1 block font-mono text-base font-bold text-[#c6f527] tracking-wide">
                      {tokenState?.token ||
                        "Click Generate 48h Token to create key"}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyToken}
                      disabled={!tokenState?.token}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#121820] px-3 py-2 text-xs font-medium text-zinc-100 hover:bg-white/[0.08] transition-colors cursor-pointer disabled:opacity-40"
                    >
                      {copiedToken ? (
                        <Check className="h-3.5 w-3.5 text-[#c6f527]" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      <span>{copiedToken ? "Copied" : "Copy Token"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={onOpenSoftware}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.05] px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/[0.1] transition-colors cursor-pointer"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-[#c6f527]" />
                      <span>Open Software</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleStartSession}
                      disabled={startingSession || !tokenState?.authenticated}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span>
                        {startingSession ? "Starting..." : "Start Session"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Progress metadata */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-400">
                  <span>
                    Token:{" "}
                    <strong
                      className={
                        tokenState ? "text-[#c6f527]" : "text-zinc-300"
                      }
                    >
                      {tokenState ? "Generated" : "Pending"}
                    </strong>
                  </span>
                  <span>·</span>
                  <span>
                    Software Auth:{" "}
                    <strong
                      className={
                        tokenState?.authenticated
                          ? "text-emerald-400"
                          : "text-amber-300"
                      }
                    >
                      {tokenState?.authenticated
                        ? "Authenticated"
                        : "Paste token in Crackpilot App"}
                    </strong>
                  </span>
                  <span>·</span>
                  <span>
                    Live Session:{" "}
                    <strong
                      className={
                        tokenState?.sessionActive
                          ? "text-emerald-400"
                          : "text-zinc-300"
                      }
                    >
                      {tokenState?.sessionActive ? "Active" : "Standby"}
                    </strong>
                  </span>
                </div>

                {overviewNotice && (
                  <p className="rounded-lg border border-[#c6f527]/30 bg-[#1a2210] px-3.5 py-2.5 text-xs text-[#e3fa93]">
                    {overviewNotice}
                  </p>
                )}

                {/* Download Apps & Helpers row (exact match to final-2) */}
                <div className="space-y-2.5 pt-2 border-t border-white/[0.06]">
                  <p className="text-[11px] font-medium text-zinc-400">
                    Download Apps &amp; Helpers
                  </p>
                  <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                    <a
                      href={WINDOWS_EXE_URL}
                      download={WINDOWS_EXE_FILENAME}
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#080b0f] py-2.5 text-xs font-medium text-zinc-200 hover:border-[#c6f527]/50 hover:text-white transition-colors cursor-pointer"
                    >
                      <Monitor className="h-3.5 w-3.5 text-[#c6f527]" />
                      <span>Download for Windows (.exe)</span>
                    </a>
                    <a
                      href={WINDOWS_EXE_URL}
                      download={WINDOWS_EXE_FILENAME}
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#080b0f] py-2.5 text-xs font-medium text-zinc-200 hover:border-[#c6f527]/50 hover:text-white transition-colors cursor-pointer"
                    >
                      <Laptop className="h-3.5 w-3.5 text-[#c6f527]" />
                      <span>Mac OS</span>
                    </a>
                    <button
                      type="button"
                      onClick={onOpenSoftware}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#080b0f] py-2.5 text-xs font-medium text-zinc-200 hover:border-[#c6f527]/50 hover:text-white transition-colors cursor-pointer"
                    >
                      <Smartphone className="h-3.5 w-3.5 text-[#c6f527]" />
                      <span>Web Overlay</span>
                    </button>
                    <a
                      href={WINDOWS_EXE_URL}
                      download={WINDOWS_EXE_FILENAME}
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#080b0f] py-2.5 text-xs font-medium text-zinc-200 hover:border-[#c6f527]/50 hover:text-white transition-colors cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5 text-[#c6f527]" />
                      <span>Crackpilot-Setup.exe</span>
                    </a>
                  </div>
                </div>

                {/* Instant QR Pairing Callout */}
                <div className="rounded-xl border border-[#c6f527]/20 bg-[#12180c] p-4 flex items-start gap-3">
                  <QrCode className="h-5 w-5 text-[#c6f527] shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-xs">
                    <p className="font-semibold text-white">
                      Instant QR pairing{" "}
                      <span className="ml-1.5 font-mono text-[10px] text-[#c6f527]">
                        No install, just scan the QR
                      </span>
                    </p>
                    <p className="text-zinc-400">
                      After entering your Auth Token in the desktop app, pair
                      your phone on the same Wi-Fi or pop out the Always-On-Top
                      window directly in Testing Lab.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TARGET PROFILE TAB */}
          {activeTab === "profile" && (
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    Target Profile
                  </h1>
                  <p className="mt-1 text-xs text-zinc-400">
                    Upload your Resume and Job Description (JD). Crackpilot
                    automatically uses this context to answer every interviewer
                    question.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="inline-flex items-center gap-2 rounded-full bg-[#c6f527] px-5 py-2.5 text-xs font-bold text-[#050709] hover:bg-[#b5e41c] transition-colors cursor-pointer disabled:opacity-60"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>
                    {savingProfile ? "Saving..." : "Save Target Profile"}
                  </span>
                </button>
              </div>

              {profileNotice && (
                <p className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">
                  {profileNotice}
                </p>
              )}

              <div className="rounded-2xl border border-white/[0.08] bg-[#0c1015] p-6 grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-zinc-300">
                    Target Job Role
                  </span>
                  <input
                    type="text"
                    value={draftProfile.role}
                    onChange={(e) =>
                      setDraftProfile((p) => ({ ...p, role: e.target.value }))
                    }
                    placeholder="e.g., Senior Frontend Engineer"
                    className="w-full rounded-lg border border-white/10 bg-[#070a0e] px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#c6f527] focus:outline-none"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-zinc-300">
                    Experience Level
                  </span>
                  <input
                    type="text"
                    value={draftProfile.experience}
                    onChange={(e) =>
                      setDraftProfile((p) => ({
                        ...p,
                        experience: e.target.value,
                      }))
                    }
                    placeholder="e.g., 4 years / Fresher"
                    className="w-full rounded-lg border border-white/10 bg-[#070a0e] px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#c6f527] focus:outline-none"
                  />
                </label>

                <label className="block space-y-1.5 sm:col-span-2">
                  <span className="text-xs font-medium text-zinc-300">
                    Core Skills &amp; Tech Stack
                  </span>
                  <input
                    type="text"
                    value={draftProfile.skills}
                    onChange={(e) =>
                      setDraftProfile((p) => ({ ...p, skills: e.target.value }))
                    }
                    placeholder="React, TypeScript, Node.js, Python, PostgreSQL, System Design"
                    className="w-full rounded-lg border border-white/10 bg-[#070a0e] px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#c6f527] focus:outline-none"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-zinc-300">
                    Answer Language
                  </span>
                  <select
                    value={draftProfile.answerLanguage}
                    onChange={(e) =>
                      setDraftProfile((p) => ({
                        ...p,
                        answerLanguage: e.target.value as AnswerLanguage,
                      }))
                    }
                    className="w-full rounded-lg border border-white/10 bg-[#070a0e] px-3 py-2.5 text-sm text-white focus:border-[#c6f527] focus:outline-none"
                  >
                    <option value="English">English</option>
                    <option value="Hinglish">Hinglish (Hindi + English)</option>
                    <option value="Hindi">हिन्दी (Hindi)</option>
                  </select>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-zinc-300">
                    Answer Style
                  </span>
                  <select
                    value={draftProfile.answerStyle}
                    onChange={(e) =>
                      setDraftProfile((p) => ({
                        ...p,
                        answerStyle: e.target.value as AnswerStyle,
                      }))
                    }
                    className="w-full rounded-lg border border-white/10 bg-[#070a0e] px-3 py-2.5 text-sm text-white focus:border-[#c6f527] focus:outline-none"
                  >
                    <option value="Concise Bullets">Concise Bullets</option>
                    <option value="STAR Method">STAR Method</option>
                    <option value="Technical + Code">Technical + Code</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                {/* Resume Upload */}
                <div className="rounded-2xl border border-white/[0.08] bg-[#0c1015] p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[#c6f527]" />
                      <h2 className="text-sm font-bold text-white">
                        Candidate Resume
                      </h2>
                    </div>
                    <label className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#121820] px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-white/[0.08] transition-colors cursor-pointer">
                      <Upload className="h-3.5 w-3.5 text-[#c6f527]" />
                      <span>
                        {extractingResume
                          ? "Extracting..."
                          : "Upload PDF / TXT"}
                      </span>
                      <input
                        type="file"
                        accept=".pdf,.txt,.md,.doc,.docx"
                        className="hidden"
                        onChange={(e) =>
                          void handleUploadDoc(e.target.files?.[0], "resume")
                        }
                      />
                    </label>
                  </div>
                  {draftProfile.resumeFileName && (
                    <p className="font-mono text-[11px] text-[#c6f527]">
                      File: {draftProfile.resumeFileName}
                    </p>
                  )}
                  <textarea
                    rows={8}
                    value={draftProfile.resumeText}
                    onChange={(e) =>
                      setDraftProfile((p) => ({
                        ...p,
                        resumeText: e.target.value,
                      }))
                    }
                    placeholder="Upload your Resume PDF/TXT or paste your experience, projects, and metrics here..."
                    className="w-full rounded-lg border border-white/10 bg-[#070a0e] p-3 text-xs leading-relaxed text-zinc-200 placeholder-zinc-500 focus:border-[#c6f527] focus:outline-none"
                  />
                </div>

                {/* JD Upload */}
                <div className="rounded-2xl border border-white/[0.08] bg-[#0c1015] p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[#c6f527]" />
                      <h2 className="text-sm font-bold text-white">
                        Job Description (JD)
                      </h2>
                    </div>
                    <label className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#121820] px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-white/[0.08] transition-colors cursor-pointer">
                      <Upload className="h-3.5 w-3.5 text-[#c6f527]" />
                      <span>
                        {extractingJd ? "Extracting..." : "Upload PDF / TXT"}
                      </span>
                      <input
                        type="file"
                        accept=".pdf,.txt,.md,.doc,.docx"
                        className="hidden"
                        onChange={(e) =>
                          void handleUploadDoc(e.target.files?.[0], "jd")
                        }
                      />
                    </label>
                  </div>
                  {draftProfile.jdFileName && (
                    <p className="font-mono text-[11px] text-[#c6f527]">
                      File: {draftProfile.jdFileName}
                    </p>
                  )}
                  <textarea
                    rows={8}
                    value={draftProfile.jdText}
                    onChange={(e) =>
                      setDraftProfile((p) => ({ ...p, jdText: e.target.value }))
                    }
                    placeholder="Upload the Job Description PDF/TXT or paste role responsibilities and requirements here..."
                    className="w-full rounded-lg border border-white/10 bg-[#070a0e] p-3 text-xs leading-relaxed text-zinc-200 placeholder-zinc-500 focus:border-[#c6f527] focus:outline-none"
                  />
                </div>
              </div>
            </form>
          )}

          {/* TESTING LAB / PRACTICE MODE TAB */}
          {activeTab === "testing" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Testing Lab (Practice Mode)
                </h1>
                <p className="mt-1 text-xs text-zinc-400">
                  Benchmark Dual-Pipeline Live Audio Q&amp;A (Deepgram Nova-3 +
                  Groq vs Gemini Live API), verify Always-On-Top overlay,
                  Headphone / System audio capture, and keyboard shortcuts.
                </p>
              </div>

              {/* Real-Time Ultra-Low-Latency Dual-Pipeline Live Audio Q&A Engine */}
              <LiveAudioQAEngine />

              {/* 1. Cross-Tab Always-On-Top */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0c1015] p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Monitor className="h-5 w-5 text-[#c6f527] mt-0.5 shrink-0" />
                    <div>
                      <h2 className="text-base font-bold text-white">
                        1. Always-On-Top Overlay Across Browser Tabs
                      </h2>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                        Pop Crackpilot into a Chrome/Edge floating
                        Picture-in-Picture overlay so switching to Google Meet,
                        Zoom Web, or WhatsApp Web keeps Crackpilot visible on
                        top.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleLaunchCrossTabOverlay()}
                    className="inline-flex items-center gap-2 rounded-full bg-[#c6f527] px-4 py-2 text-xs font-bold text-[#050709] hover:bg-[#b5e41c] transition-colors cursor-pointer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Pop Out Always-On-Top Overlay</span>
                  </button>
                </div>
                {pipStatus && (
                  <p className="rounded-lg border border-[#c6f527]/30 bg-[#1a2210] px-3.5 py-2.5 text-xs text-[#e3fa93]">
                    {pipStatus}
                  </p>
                )}
              </div>

              {/* 2. Audio Test */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0c1015] p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Headphones className="h-5 w-5 text-[#c6f527] mt-0.5 shrink-0" />
                    <div>
                      <h2 className="text-base font-bold text-white">
                        2. Laptop, WhatsApp &amp; Headphone Audio Detection Test
                      </h2>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                        Test capturing interviewer audio even while wearing
                        headphones or earphones. Use Tab/System Audio for Meet,
                        Zoom, Teams, or WhatsApp Web, or run the Python WASAPI
                        loopback script for WhatsApp Desktop calls.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleStartAudioTest("tab")}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                        audioTestMode === "tab"
                          ? "bg-[#c6f527] text-black"
                          : "border border-white/10 bg-[#121820] text-zinc-100 hover:bg-white/[0.08]"
                      }`}
                    >
                      <Headphones className="h-3.5 w-3.5" />
                      <span>Test Tab / System Audio</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleStartAudioTest("mic")}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                        audioTestMode === "mic"
                          ? "bg-[#c6f527] text-black"
                          : "border border-white/10 bg-[#121820] text-zinc-100 hover:bg-white/[0.08]"
                      }`}
                    >
                      <Mic className="h-3.5 w-3.5" />
                      <span>Test Mic</span>
                    </button>
                    {audioTestMode !== "idle" && (
                      <button
                        type="button"
                        onClick={stopAudioTest}
                        className="inline-flex items-center gap-1 rounded-lg bg-rose-600/80 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-600 cursor-pointer"
                      >
                        <Square className="h-3 w-3" />
                        <span>Stop</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>
                      Input Signal Level (
                      {audioTestMode === "idle"
                        ? "Idle"
                        : audioTestMode === "tab"
                          ? "Tab / System Audio Active"
                          : "Microphone Active"}
                      )
                    </span>
                    <span className="font-mono tabular-nums text-[#c6f527]">
                      {audioTestLevel}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#070a0e] border border-white/10">
                    <div
                      className="h-full bg-[#c6f527] transition-all duration-75"
                      style={{ width: `${audioTestLevel}%` }}
                    />
                  </div>
                </div>

                {audioTestNotice && (
                  <p className="text-xs text-zinc-300">{audioTestNotice}</p>
                )}
              </div>

              {/* 3. OS Screen-Share Privacy Diagnostics */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0c1015] p-6 space-y-3">
                <div className="flex items-center gap-2.5">
                  <Shield className="h-5 w-5 text-[#c6f527]" />
                  <h2 className="text-base font-bold text-white">
                    3. Screen-Share &amp; Screenshot Privacy Diagnostics
                  </h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 text-xs">
                  <div className="rounded-xl border border-white/[0.07] bg-[#070a0e] p-4 space-y-1.5">
                    <p className="font-semibold text-[#c6f527] flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Desktop Installer Kit (Windows 10/11 &amp; macOS)</span>
                    </p>
                    <p className="text-zinc-400 leading-relaxed">
                      Configured with{" "}
                      <code className="text-zinc-200">
                        setContentProtection(true)
                      </code>{" "}
                      (Windows{" "}
                      <code className="text-zinc-200">
                        WDA_EXCLUDEFROMCAPTURE
                      </code>{" "}
                      &amp; macOS{" "}
                      <code className="text-zinc-200">NSWindowSharingNone</code>)
                      so screenshots and screen-sharing exclude the overlay
                      window while staying always on top across apps.
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/[0.07] bg-[#070a0e] p-4 space-y-1.5">
                    <p className="font-semibold text-zinc-200">
                      OS Security Transparency Note
                    </p>
                    <p className="text-zinc-400 leading-relaxed">
                      Web browsers alone cannot hide a tab from full-screen
                      capture — install the Desktop Kit for OS screen-capture
                      exclusion. Standard desktop apps remain visible in Windows
                      Task Manager per OS security rules.
                    </p>
                  </div>
                </div>
              </div>

              {/* 4. Keyboard Shortcuts Tester */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0c1015] p-6 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <Keyboard className="h-5 w-5 text-[#c6f527]" />
                    <div>
                      <h2 className="text-base font-bold text-white">
                        4. Live Keyboard Shortcuts Test
                      </h2>
                      <p className="text-xs text-zinc-400">
                        Press any shortcut below on your keyboard to verify it
                        triggers immediately.
                      </p>
                    </div>
                  </div>
                  {pressedShortcut && (
                    <span className="font-mono text-xs font-bold text-[#c6f527]">
                      Detected: {pressedShortcut.toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                  {TEST_SHORTCUTS.map((sc) => {
                    const hit = pressedShortcut === sc.combo;
                    return (
                      <div
                        key={sc.combo}
                        className={`rounded-xl border p-3 transition-colors ${
                          hit
                            ? "border-[#c6f527] bg-[#1a2210]"
                            : "border-white/[0.07] bg-[#070a0e]"
                        }`}
                      >
                        <p className="font-mono text-xs font-bold text-[#c6f527]">
                          {sc.label}
                        </p>
                        <p className="mt-1 text-xs text-zinc-300">
                          {sc.action}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* DOWNLOADS TAB */}
          {activeTab === "downloads" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-white">Downloads</h1>
                <p className="mt-1 text-xs text-zinc-400">
                  Download the Crackpilot Desktop Installer Kit (Windows /
                  macOS) and Browser Extension (Chrome / Edge).
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.08] bg-[#0c1015] p-6 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <Monitor className="h-5 w-5 text-[#c6f527]" />
                    <h2 className="text-base font-bold text-white">
                      Crackpilot Windows Installer (.exe)
                    </h2>
                  </div>
                  <ol className="list-decimal pl-4 space-y-1.5 text-xs leading-relaxed text-zinc-400">
                    <li>
                      Click download below to save{" "}
                      <code className="text-[#c6f527]">
                        Crackpilot-Setup.exe
                      </code>{" "}
                      directly (no ZIP extraction required).
                    </li>
                    <li>
                      Double-click{" "}
                      <code className="text-zinc-200">
                        Crackpilot-Setup.exe
                      </code>{" "}
                      and click <strong className="text-white">OK</strong>.
                    </li>
                    <li>
                      A branded{" "}
                      <strong className="text-white">Crackpilot</strong> icon is
                      created automatically on your Desktop.
                    </li>
                    <li>
                      Paste your 48h Auth Token from Overview to Authenticate
                      and click Start Session.
                    </li>
                  </ol>
                  <a
                    href={WINDOWS_EXE_URL}
                    download={WINDOWS_EXE_FILENAME}
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#c6f527] px-4 py-2.5 text-xs font-bold text-[#050709] hover:bg-[#b5e41c] transition-colors cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download for Windows (.exe)</span>
                  </a>
                </div>

                <div className="rounded-2xl border border-white/[0.08] bg-[#0c1015] p-6 space-y-4 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2.5">
                      <Chrome className="h-5 w-5 text-[#c6f527]" />
                      <h2 className="text-base font-bold text-white">
                        Instant Web Overlay (Always-On-Top)
                      </h2>
                    </div>
                    <ol className="list-decimal pl-4 space-y-1.5 text-xs leading-relaxed text-zinc-400">
                      <li>
                        Launch the live Crackpilot overlay directly in Chrome or
                        Edge with zero install.
                      </li>
                      <li>
                        Paste your 48h Auth Token from{" "}
                        <strong className="text-white">Overview</strong> and
                        click <strong className="text-white">Authenticate</strong>.
                      </li>
                      <li>
                        Click the pop-out icon in the top-right bar to float
                        Always On Top across all browser tabs.
                      </li>
                    </ol>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenSoftware}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-4 py-2.5 text-xs font-bold text-white hover:bg-white/[0.1] transition-colors cursor-pointer"
                  >
                    <ExternalLink className="h-4 w-4 text-[#c6f527]" />
                    <span>Open Crackpilot Web Overlay</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

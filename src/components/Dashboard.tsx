import { useEffect, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  Chrome,
  Code2,
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
  Trash2,
  Upload,
  UserCheck,
  X,
} from "lucide-react";
import {
  WINDOWS_EXE_FILENAME,
  WINDOWS_EXE_URL,
} from "../data/crackpilotPackages";
import {
  ANSWER_STYLES,
  CUSTOM_ROLE_OPTION,
  EXPERIENCE_LEVELS,
  PROGRAMMING_LANGUAGES,
  TARGET_JOB_ROLES,
  getSuggestedSkillsForRole,
  hasSkillInCsv,
  normalizeAnswerStyle,
  normalizeProgrammingLanguage,
  toggleSkillInCsv,
} from "../data/roleSkills";
import {
  extractDocumentText,
  fetchTokenQuota,
  generateSessionToken,
  saveTargetProfile,
  startLiveSession,
} from "../lib/clientStore";
import { DsaPracticeLab } from "./DsaPracticeLab";
import { LiveAudioQAEngine } from "./LiveAudioQAEngine";
import { SearchableSelect } from "./SearchableSelect";
import type {
  AnswerLanguage,
  AnswerStyle,
  DashboardTab,
  ProgrammingLanguage,
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
  { combo: "alt+m", label: "Alt+M", action: "Behind Click-Through Mode ON / OFF" },
  // { combo: "alt+h", label: "Alt+H", action: "Hide / Show Overlay" }, // Temporarily commented out (uncomment when requested)
  { combo: "alt+f", label: "Alt+F", action: "Increase Q&A Font Size" },
  { combo: "alt+d", label: "Alt+D", action: "Disconnect Session" },
];

export { CUSTOM_ROLE_OPTION, EXPERIENCE_LEVELS, TARGET_JOB_ROLES };

const PRESET_ROLES_SET = new Set<string>(
  TARGET_JOB_ROLES.filter((r) => r !== CUSTOM_ROLE_OPTION)
);

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
  const [isCustomRoleSelected, setIsCustomRoleSelected] = useState<boolean>(
    () => !PRESET_ROLES_SET.has(profile.role)
  );
  const [customRoleInput, setCustomRoleInput] = useState<string>(() =>
    PRESET_ROLES_SET.has(profile.role) || profile.role === CUSTOM_ROLE_OPTION
      ? ""
      : profile.role
  );
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
    const isPreset = PRESET_ROLES_SET.has(profile.role);
    setIsCustomRoleSelected(!isPreset);
    if (!isPreset && profile.role !== CUSTOM_ROLE_OPTION) {
      setCustomRoleInput(profile.role);
    }
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

  // Keep Overview → Session Credits synced in real time with backend, /admin edits, and desktop app timer
  useEffect(() => {
    const tokenValue = tokenState?.token;
    if (!tokenValue) return;
    let active = true;

    const refreshQuota = () => {
      void fetchTokenQuota(tokenValue).then((res) => {
        if (!active || !res.ok) return;
        onTokenChange({
          ...tokenState,
          quota: res.quota,
        });
      });
    };

    refreshQuota();
    const onFocus = () => refreshQuota();
    window.addEventListener("focus", onFocus);
    const intervalId = window.setInterval(refreshQuota, 8000);

    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      window.clearInterval(intervalId);
    };
  }, [tokenState?.token, activeTab]);

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

  const resumeInputRef = useRef<HTMLInputElement | null>(null);
  const jdInputRef = useRef<HTMLInputElement | null>(null);

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
        `${kind === "resume" ? "Resume" : "Job Description"} extracted from "${file.name}". Click Save Target Profile below to sync with Crackpilot.`
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

  const handleRemoveDoc = (kind: "resume" | "jd") => {
    if (kind === "resume") {
      setDraftProfile((prev) => ({
        ...prev,
        resumeFileName: "",
        resumeText: "",
      }));
      if (resumeInputRef.current) {
        resumeInputRef.current.value = "";
      }
      setProfileNotice(
        "Resume removed. Click Save Target Profile below to save changes."
      );
    } else {
      setDraftProfile((prev) => ({
        ...prev,
        jdFileName: "",
        jdText: "",
      }));
      if (jdInputRef.current) {
        jdInputRef.current.value = "";
      }
      setProfileNotice(
        "Job Description removed. Click Save Target Profile below to save changes."
      );
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileNotice(null);
    try {
      const resolvedRole = isCustomRoleSelected
        ? customRoleInput.trim() || CUSTOM_ROLE_OPTION
        : draftProfile.role;
      const payloadToSave: TargetProfile = {
        ...draftProfile,
        role: resolvedRole,
      };
      const saved = await saveTargetProfile(payloadToSave);
      onProfileChange(saved);
      setProfileNotice(
        "Target Profile saved & synced! Crackpilot software will now tailor every answer to this Role, Experience Level, Resume, and JD."
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
          <button
            type="button"
            onClick={onLogout}
            title="Logout"
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300 transition-colors cursor-pointer shrink-0"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Logout</span>
          </button>
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
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onGoHome}
                className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                View Website ↗
              </button>
              <button
                type="button"
                onClick={onLogout}
                title="Logout"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0d1117] px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300 transition-colors cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Logout</span>
              </button>
            </div>
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
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-white">
                        {profile.role}
                      </h2>
                      {profile.dsaModeEnabled && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-[#b4f416]/50 bg-[#b4f416]/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-[#b4f416]">
                          <Code2 className="h-3 w-3" />
                          <span>
                            DSA CODING MODE ·{" "}
                            {normalizeProgrammingLanguage(profile.preferredLanguage)}
                          </span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                      {profile.experience} · {profile.answerLanguage} ·{" "}
                      {normalizeAnswerStyle(profile.answerStyle)}
                    </p>
                  </div>
                  {skillTags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {skillTags.map((sk) => (
                        <span
                          key={sk}
                          className="rounded border border-[#b4f416]/30 bg-[#b4f416]/[0.07] px-2 py-0.5 font-mono text-[10px] text-[#d8fb7a]"
                        >
                          {sk}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-zinc-500">
                      No core skills selected yet — click Configure to tap role-specific skill chips.
                    </p>
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
                      <span className="rounded bg-[#1a2210] px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-[#c6f527]">
                        {tokenState?.quota?.paymentStatus === "Paid"
                          ? `PAID / ${tokenState.quota.planType}`
                          : tokenState?.quota?.planType || "PRO PLAN"}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2.5 flex-wrap">
                      <p className="text-3xl font-extrabold text-white tabular-nums">
                        {tokenState?.quota
                          ? `${tokenState.quota.remainingMinutes} mins left`
                          : "240 mins left"}
                      </p>
                      {tokenState?.quota && (
                        <span className="rounded border border-[#b4f416]/30 bg-[#b4f416]/10 px-2 py-0.5 font-mono text-xs font-semibold text-[#c6f527] tabular-nums">
                          {String(Math.floor(tokenState.quota.remainingSeconds / 60)).padStart(2, "0")}:
                          {String(tokenState.quota.remainingSeconds % 60).padStart(2, "0")} exact
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400">
                      Screen captures &amp; written prompts:{" "}
                      {tokenState?.quota
                        ? `${tokenState.quota.capturesUsed} / ${tokenState.quota.captureLimit} used`
                        : "0 / 80 used"}
                    </p>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/[0.06] pt-3 text-[11px]">
                    <span className="text-zinc-500">
                      {tokenState?.quota?.accountType === "DEMO"
                        ? "Temporary Demo Account"
                        : "Credits never expire"}
                    </span>
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
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Target Profile
                </h1>
                <p className="mt-1 text-xs text-zinc-400">
                  Fill in your Target Role, Experience, Core Skills, Answer
                  Style, Resume, and Job Description, then click Save Target
                  Profile at the bottom to sync with Crackpilot.
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-[#111111] p-6 grid gap-5 sm:grid-cols-2">
                <div className="space-y-2.5">
                  <SearchableSelect
                    id="target-job-role-select"
                    label="Target Role / Session Specialization Category"
                    options={TARGET_JOB_ROLES}
                    value={
                      isCustomRoleSelected
                        ? CUSTOM_ROLE_OPTION
                        : draftProfile.role
                    }
                    onChange={(selected) => {
                      if (selected === CUSTOM_ROLE_OPTION) {
                        setIsCustomRoleSelected(true);
                        setDraftProfile((p) => ({
                          ...p,
                          role: customRoleInput.trim() || CUSTOM_ROLE_OPTION,
                          skills: p.role === (customRoleInput.trim() || CUSTOM_ROLE_OPTION) ? p.skills : "",
                        }));
                      } else {
                        setIsCustomRoleSelected(false);
                        setDraftProfile((p) => ({
                          ...p,
                          role: selected,
                          // Clear previous role's skills so unrelated tech stacks never carry over
                          skills: p.role === selected ? p.skills : "",
                        }));
                      }
                    }}
                    placeholder="Select specialization..."
                    searchPlaceholder="Search 31 roles (e.g. SAP, Frontend, DevOps, Healthcare)..."
                    searchable
                  />

                  {isCustomRoleSelected && (
                    <input
                      type="text"
                      value={customRoleInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomRoleInput(val);
                        setDraftProfile((p) => ({
                          ...p,
                          role: val.trim() || CUSTOM_ROLE_OPTION,
                        }));
                      }}
                      placeholder="Enter your custom role or specialization..."
                      className="w-full rounded-lg border border-[#b4f416]/40 bg-[#0a0a0a] px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-[#b4f416] focus:outline-none"
                    />
                  )}
                </div>

                <SearchableSelect
                  id="experience-level-select"
                  label="Experience Level"
                  options={EXPERIENCE_LEVELS}
                  value={
                    EXPERIENCE_LEVELS.includes(
                      draftProfile.experience as (typeof EXPERIENCE_LEVELS)[number]
                    )
                      ? draftProfile.experience
                      : EXPERIENCE_LEVELS[1]
                  }
                  onChange={(selected) =>
                    setDraftProfile((p) => ({ ...p, experience: selected }))
                  }
                  placeholder="Select experience level..."
                  searchPlaceholder="Filter experience level..."
                  searchable={false}
                />

                {/* Dynamic Role-Based Core Skills Input + Clickable Skill Chips */}
                {(() => {
                  const activeRoleKey = isCustomRoleSelected
                    ? CUSTOM_ROLE_OPTION
                    : draftProfile.role;
                  const suggestedSkills = getSuggestedSkillsForRole(activeRoleKey);
                  return (
                    <div className="space-y-2.5 sm:col-span-2">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor="core-skills-input"
                          className="text-xs font-medium text-zinc-300"
                        >
                          Core Skills &amp; Tech Stack
                        </label>
                        <span className="text-[11px] text-zinc-500">
                          Tap chips below to add/remove or type custom skills
                        </span>
                      </div>

                      <div className="relative">
                        <input
                          id="core-skills-input"
                          type="text"
                          value={draftProfile.skills}
                          onChange={(e) =>
                            setDraftProfile((p) => ({
                              ...p,
                              skills: e.target.value,
                            }))
                          }
                          placeholder={
                            suggestedSkills.slice(0, 5).join(", ") ||
                            "Select chips below or type your core skills..."
                          }
                          className="w-full rounded-lg border border-white/10 bg-[#0a0a0a] pl-3.5 pr-16 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#b4f416] focus:outline-none"
                        />
                        {draftProfile.skills.trim() && (
                          <button
                            type="button"
                            onClick={() =>
                              setDraftProfile((p) => ({ ...p, skills: "" }))
                            }
                            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded-md border border-white/10 bg-[#181818] px-2 py-1 text-[11px] font-medium text-zinc-400 hover:border-white/25 hover:text-white transition-colors cursor-pointer"
                          >
                            <X className="h-3 w-3" />
                            <span>Clear</span>
                          </button>
                        )}
                      </div>

                      <div className="rounded-xl border border-white/[0.06] bg-[#0a0a0a] p-3 space-y-2">
                        <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                          Suggested Core Skills for{" "}
                          <span className="text-zinc-300">{activeRoleKey}</span>
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {suggestedSkills.map((chip) => {
                            const selected = hasSkillInCsv(
                              draftProfile.skills,
                              chip
                            );
                            return (
                              <button
                                key={chip}
                                type="button"
                                onClick={() =>
                                  setDraftProfile((p) => ({
                                    ...p,
                                    skills: toggleSkillInCsv(p.skills, chip),
                                  }))
                                }
                                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                                  selected
                                    ? "border-[#b4f416] bg-[#b4f416]/15 text-[#b4f416]"
                                    : "border-white/10 bg-[#141414] text-zinc-300 hover:border-[#b4f416]/45 hover:text-white"
                                }`}
                              >
                                {selected && <Check className="h-3 w-3" />}
                                <span>{chip}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}

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
                    className="w-full rounded-lg border border-white/10 bg-[#0a0a0a] px-3 py-2.5 text-sm text-white focus:border-[#b4f416] focus:outline-none"
                  >
                    <option value="English">English</option>
                    <option value="Hinglish">Hinglish (Hindi + English)</option>
                    <option value="Hindi">हिन्दी (Hindi)</option>
                  </select>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-zinc-300">
                    Answer Style (Natural Human Speech)
                  </span>
                  <select
                    value={normalizeAnswerStyle(draftProfile.answerStyle)}
                    onChange={(e) =>
                      setDraftProfile((p) => ({
                        ...p,
                        answerStyle: e.target.value as AnswerStyle,
                      }))
                    }
                    className="w-full rounded-lg border border-white/10 bg-[#0a0a0a] px-3 py-2.5 text-sm text-white focus:border-[#b4f416] focus:outline-none"
                  >
                    {ANSWER_STYLES.map((styleOpt) => (
                      <option key={styleOpt} value={styleOpt}>
                        {styleOpt}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Dedicated DSA Coding & Assessment Mode Toggle + Preferred Language */}
                <div
                  className={`sm:col-span-2 rounded-xl border p-4 transition-colors space-y-3.5 ${
                    draftProfile.dsaModeEnabled
                      ? "border-[#b4f416]/50 bg-[#141a0b]"
                      : "border-white/[0.08] bg-[#0a0a0a]"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                          draftProfile.dsaModeEnabled
                            ? "border-[#b4f416]/50 bg-[#b4f416]/15 text-[#b4f416]"
                            : "border-white/10 bg-[#141414] text-zinc-400"
                        }`}
                      >
                        <Code2 className="h-4 w-4" />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">
                            DSA Coding / Assessment Mode
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${
                              draftProfile.dsaModeEnabled
                                ? "bg-[#b4f416] text-[#0a0a0a]"
                                : "bg-white/[0.07] text-zinc-400"
                            }`}
                          >
                            {draftProfile.dsaModeEnabled ? "ON" : "OFF"}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-zinc-400">
                          Activates the 5-step Live Coding Teleprompter (no premature code dump), OA auto-solver (Full Coding / Bug-Fix / MCQ / Work-Style), and zero-recapture voice follow-ups. Keep OFF for standard non-coding interviews.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={Boolean(draftProfile.dsaModeEnabled)}
                      onClick={() =>
                        setDraftProfile((p) => ({
                          ...p,
                          dsaModeEnabled: !p.dsaModeEnabled,
                          preferredLanguage: normalizeProgrammingLanguage(
                            p.preferredLanguage
                          ),
                        }))
                      }
                      className={`relative inline-flex h-7 w-13 shrink-0 items-center rounded-full border transition-colors cursor-pointer ${
                        draftProfile.dsaModeEnabled
                          ? "border-[#b4f416] bg-[#b4f416]"
                          : "border-white/15 bg-[#1b1b1b]"
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full transition-transform ${
                          draftProfile.dsaModeEnabled
                            ? "translate-x-6.5 bg-[#0a0a0a]"
                            : "translate-x-1 bg-zinc-400"
                        }`}
                      />
                    </button>
                  </div>

                  {draftProfile.dsaModeEnabled && (
                    <div className="grid gap-3 border-t border-[#b4f416]/20 pt-3.5 sm:grid-cols-2 items-center">
                      <label className="block space-y-1.5">
                        <span className="text-xs font-semibold text-[#b4f416]">
                          Preferred Programming Language
                        </span>
                        <select
                          value={normalizeProgrammingLanguage(
                            draftProfile.preferredLanguage
                          )}
                          onChange={(e) =>
                            setDraftProfile((p) => ({
                              ...p,
                              preferredLanguage: e.target
                                .value as ProgrammingLanguage,
                            }))
                          }
                          className="w-full rounded-lg border border-[#b4f416]/45 bg-[#0a0a0a] px-3 py-2 text-sm font-semibold text-white focus:border-[#b4f416] focus:outline-none"
                        >
                          {PROGRAMMING_LANGUAGES.map((lang) => (
                            <option key={lang} value={lang}>
                              {lang}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p className="text-xs leading-relaxed text-zinc-300">
                        All brute-force snippets, optimal solutions, OA code fixes, and live voice follow-ups will strictly generate clean, bug-free{" "}
                        <strong className="text-[#b4f416]">
                          {normalizeProgrammingLanguage(
                            draftProfile.preferredLanguage
                          )}
                        </strong>{" "}
                        code.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                {/* Resume Upload */}
                <div className="rounded-2xl border border-white/[0.08] bg-[#111111] p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[#b4f416]" />
                      <h2 className="text-sm font-bold text-white">
                        Candidate Resume
                      </h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#121820] px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-white/[0.08] transition-colors cursor-pointer">
                        <Upload className="h-3.5 w-3.5 text-[#b4f416]" />
                        <span>
                          {extractingResume
                            ? "Extracting..."
                            : "Upload PDF / TXT"}
                        </span>
                        <input
                          ref={resumeInputRef}
                          type="file"
                          accept=".pdf,.txt,.md,.doc,.docx"
                          className="hidden"
                          onChange={(e) =>
                            void handleUploadDoc(e.target.files?.[0], "resume")
                          }
                        />
                      </label>
                      {(draftProfile.resumeFileName ||
                        draftProfile.resumeText.trim().length > 0) && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDoc("resume")}
                          title="Remove uploaded resume"
                          aria-label="Remove uploaded resume"
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-500/35 bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-300 hover:border-rose-400/60 hover:bg-rose-500/20 hover:text-rose-100 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  </div>
                  {draftProfile.resumeFileName && (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-[#b4f416]/25 bg-[#b4f416]/10 px-3 py-1.5">
                      <span className="truncate font-mono text-[11px] text-[#b4f416]">
                        File: {draftProfile.resumeFileName}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveDoc("resume")}
                        title="Remove resume file"
                        aria-label="Remove resume file"
                        className="rounded p-0.5 text-zinc-300 hover:bg-rose-500/25 hover:text-rose-200 transition-colors cursor-pointer shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
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
                    className="w-full rounded-lg border border-white/10 bg-[#070a0e] p-3 text-xs leading-relaxed text-zinc-200 placeholder-zinc-500 focus:border-[#b4f416] focus:outline-none"
                  />
                </div>

                {/* JD Upload */}
                <div className="rounded-2xl border border-white/[0.08] bg-[#111111] p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[#b4f416]" />
                      <h2 className="text-sm font-bold text-white">
                        Job Description (JD)
                      </h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#121820] px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-white/[0.08] transition-colors cursor-pointer">
                        <Upload className="h-3.5 w-3.5 text-[#b4f416]" />
                        <span>
                          {extractingJd ? "Extracting..." : "Upload PDF / TXT"}
                        </span>
                        <input
                          ref={jdInputRef}
                          type="file"
                          accept=".pdf,.txt,.md,.doc,.docx"
                          className="hidden"
                          onChange={(e) =>
                            void handleUploadDoc(e.target.files?.[0], "jd")
                          }
                        />
                      </label>
                      {(draftProfile.jdFileName ||
                        draftProfile.jdText.trim().length > 0) && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDoc("jd")}
                          title="Remove job description"
                          aria-label="Remove job description"
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-500/35 bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-300 hover:border-rose-400/60 hover:bg-rose-500/20 hover:text-rose-100 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  </div>
                  {draftProfile.jdFileName && (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-[#b4f416]/25 bg-[#b4f416]/10 px-3 py-1.5">
                      <span className="truncate font-mono text-[11px] text-[#b4f416]">
                        File: {draftProfile.jdFileName}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveDoc("jd")}
                        title="Remove JD file"
                        aria-label="Remove JD file"
                        className="rounded p-0.5 text-zinc-300 hover:bg-rose-500/25 hover:text-rose-200 transition-colors cursor-pointer shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <textarea
                    rows={8}
                    value={draftProfile.jdText}
                    onChange={(e) =>
                      setDraftProfile((p) => ({ ...p, jdText: e.target.value }))
                    }
                    placeholder="Upload the Job Description PDF/TXT or paste role responsibilities and requirements here..."
                    className="w-full rounded-lg border border-white/10 bg-[#070a0e] p-3 text-xs leading-relaxed text-zinc-200 placeholder-zinc-500 focus:border-[#b4f416] focus:outline-none"
                  />
                </div>
              </div>

              {/* Bottom Save Target Profile Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[#111111] px-6 py-4">
                <div className="min-w-0 flex-1">
                  {profileNotice ? (
                    <p className="text-xs font-medium text-emerald-300">
                      {profileNotice}
                    </p>
                  ) : (
                    <p className="text-xs text-zinc-400">
                      Save your Target Profile to sync Role, Experience, Core
                      Skills, Resume, JD, and DSA settings with Crackpilot.
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="inline-flex items-center gap-2 rounded-full bg-[#b4f416] px-6 py-2.5 text-xs font-bold text-[#0a0a0a] hover:bg-[#c6f527] transition-colors cursor-pointer disabled:opacity-60 shrink-0"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>
                    {savingProfile ? "Saving..." : "Save Target Profile"}
                  </span>
                </button>
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

              {/* Natural Human-Spoken Answer Styles + DSA Coding & OA Teleprompter Simulator */}
              <DsaPracticeLab profile={profile} />

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

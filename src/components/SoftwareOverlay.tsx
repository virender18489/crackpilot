import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Camera,
  Code2,
  ExternalLink,
  Eye,
  EyeOff,
  Headphones,
  KeyRound,
  LayoutDashboard,
  Mic,
  Minus,
  MoreHorizontal,
  MousePointerClick,
  Play,
  Plus,
  Power,
  RefreshCw,
  ScrollText,
  Smartphone,
  Square,
  Type as TypeIcon,
  Video,
  Volume2,
  VolumeX,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import {
  AudioLevelMeter,
  QACardItem,
  SessionTimerDisplay,
} from "./HudTelemetryWidgets";
import { LiveAudioQAEngine } from "./LiveAudioQAEngine";
import { SAMPLE_INTERVIEW_QUESTIONS } from "../data/crackpilotPackages";
import {
  ANSWER_STYLES,
  PROGRAMMING_LANGUAGES,
  normalizeAnswerStyle,
  normalizeProgrammingLanguage,
} from "../data/roleSkills";
import {
  DEFAULT_PRODUCTION_API_URL,
  apiUrl,
  getApiBaseUrl,
  hasConfiguredBackend,
  isDesktopApp,
  setApiBaseUrl,
} from "../lib/api";
import {
  clearActiveProblemContextClient,
  clearOverlayAuthStorage,
  fetchTokenQuota,
  probeBackendHealth,
  resetBackendHealthCache,
  saveTargetProfile,
  startLiveSession,
  stopLiveSession,
  subscribeLocalSync,
  syncTokenElapsedSeconds,
  verifySessionToken,
} from "../lib/clientStore";
import { encodePcm16WavBlob } from "../lib/wavEncoder";
import type {
  AccountQuotaSnapshot,
  ActiveProblemContext,
  AnswerLanguage,
  AnswerStyle,
  DsaTeleprompterData,
  ProgrammingLanguage,
  QAItem,
  SessionTokenState,
  TargetProfile,
} from "../types";

interface SoftwareOverlayProps {
  tokenState: SessionTokenState | null;
  profile: TargetProfile;
  onTokenChange: (token: SessionTokenState | null) => void;
  onProfileChange: (profile: TargetProfile) => void;
  onGoDashboard: () => void;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [altIndex: number]: { transcript: string };
    };
  };
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

const DEFAULT_OVERLAY_BG = "bg-[#1a2c44]/88";

function formatNow(): string {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function SoftwareOverlay({
  tokenState: _externalTokenState,
  profile,
  onTokenChange,
  onProfileChange,
  onGoDashboard,
}: SoftwareOverlayProps) {
  // STRICT MANDATORY AUTH GATE: Always boot unauthenticated (no auto-login from localStorage/sessionStorage)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeSessionToken, setActiveSessionToken] =
    useState<SessionTokenState | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [verifyingToken, setVerifyingToken] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Settings & font drawers
  const [showContextPanel, setShowContextPanel] = useState(false);
  const [showLiveQaBench, setShowLiveQaBench] = useState(false);
  const [showFontPopover, setShowFontPopover] = useState(false);
  const [backendUrlInput, setBackendUrlInput] = useState(() => getApiBaseUrl());
  const [backendSaveNotice, setBackendSaveNotice] = useState<string | null>(null);

  // Resizable HUD window width (drag left/right edges or adjust slider)
  const [hudWidthPx, setHudWidthPx] = useState<number>(1060);
  const [isResizing, setIsResizing] = useState(false);

  // Overlay HUD controls — Scroll defaults to OFF so user can always scroll freely through all answers
  const [autoScroll, setAutoScroll] = useState(false);
  const [videoDurationSec, setVideoDurationSec] = useState<number>(4);
  const [glitchDurationSec, setGlitchDurationSec] = useState<number>(4);
  const [isHidden, setIsHidden] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isBehindMode, setIsBehindMode] = useState(false);
  const [fontSizePx, setFontSizePx] = useState<number>(15);

  // Master Start / Stop session gate — ALWAYS starts false so timer never auto-counts down on launch
  const [isSessionRunning, setIsSessionRunning] = useState(false);
  const isEngineRunning = isSessionRunning;
  const setIsEngineRunning = setIsSessionRunning;

  // Live session connection, glitch, video scan & audio states
  const [isConnected, setIsConnected] = useState(true);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [glitchCountdown, setGlitchCountdown] = useState<number>(0);
  const [videoScanCountdown, setVideoScanCountdown] = useState<number>(0);

  const [isListening, setIsListening] = useState(false);
  const [listenMode, setListenMode] = useState<"mic" | "tab" | null>(null);
  const [audioInputs, setAudioInputs] = useState<
    Array<{ deviceId: string; label: string }>
  >([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>(() =>
    isDesktopApp() ? "call-both" : "default"
  );
  const [hasSharedScreen, setHasSharedScreen] = useState(false);
  const [monitorAudio, setMonitorAudio] = useState(false);

  // Session counters & live Admin quota state (1s ticks isolated inside SessionTimerDisplay)
  const [timerBaseSeconds, setTimerBaseSeconds] = useState(240 * 60);
  const [timerSyncVersion, setTimerSyncVersion] = useState(0);
  const [promptsUsed, setPromptsUsed] = useState(0);
  const [maxPrompts, setMaxPrompts] = useState(80);
  const [capturesUsed, setCapturesUsed] = useState(0);
  const [captureLimit, setCaptureLimit] = useState(80);
  const [quotaBlockedReason, setQuotaBlockedReason] = useState<string | null>(
    null
  );

  const [questionInput, setQuestionInput] = useState("");
  const [activeProblemContext, setActiveProblemContext] =
    useState<ActiveProblemContext | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [serverDiag, setServerDiag] = useState<{
    checked: boolean;
    reachable: boolean;
    groq: boolean;
    deepgram: boolean;
    llmReady: boolean;
    sttReady: boolean;
    error: string | null;
  }>({
    checked: false,
    reachable: false,
    groq: false,
    deepgram: false,
    llmReady: false,
    sttReady: false,
    error: null,
  });
  const [micDiagError, setMicDiagError] = useState<string | null>(null);
  const [liveApiError, setLiveApiError] = useState<string | null>(null);

  const [qaList, setQaList] = useState<QAItem[]>([
    {
      id: "system-init",
      timestamp: formatNow(),
      question: "Session Ready (Standby)",
      answer:
        "Timer is paused. Click Start below to begin listening and start your session timer, or type any question in the box below and click Send.",
      engine: "Standby",
      isStreaming: false,
    },
  ]);

  // Refs
  const feedRef = useRef<HTMLDivElement | null>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const extraAudioStreamsRef = useRef<MediaStream[]>([]);
  const pcmProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const preRollPcmRef = useRef<Float32Array[]>([]);
  const speechPcmRef = useRef<Float32Array[]>([]);
  const flushPcmUtteranceRef = useRef<
    ((opts?: { isFinalFlush?: boolean; fastMode?: boolean }) => void) | null
  >(null);
  const chunkTimerRef = useRef<number | null>(null);
  const pauseTriggerTimerRef = useRef<number | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mixAudioCtxRef = useRef<AudioContext | null>(null);
  const monitorGainRef = useRef<GainNode | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const glitchTimerRef = useRef<number | null>(null);
  const videoScanTimerRef = useRef<number | null>(null);
  const videoFrameIntervalRef = useRef<number | null>(null);
  const capturedVideoFramesRef = useRef<string[]>([]);

  const [showJumpToTop, setShowJumpToTop] = useState(false);
  const [hasUnseenLatest, setHasUnseenLatest] = useState(false);
  const isAtTopRef = useRef<boolean>(true);

  const isEngineRunningRef = useRef(false);
  const isListeningRef = useRef(false);
  const isConnectedRef = useRef(true);
  const glitchActiveRef = useRef(false);
  const profileRef = useRef(profile);
  const qaListRef = useRef(qaList);
  const videoDurationRef = useRef(videoDurationSec);
  const glitchDurationRef = useRef(glitchDurationSec);
  const sessionActiveRef = useRef(false);
  const tokenStateRef = useRef<SessionTokenState | null>(null);
  const quotaBlockedReasonRef = useRef<string | null>(quotaBlockedReason);
  const activeProblemContextRef = useRef<ActiveProblemContext | null>(
    activeProblemContext
  );
  const selectedAudioInputRef = useRef<string>(selectedAudioInput);
  const speechActiveRef = useRef<boolean>(false);
  const lastSpeechAtRef = useRef<number>(0);
  const chunkStartedAtRef = useRef<number>(0);
  const speechSessionStartedAtRef = useRef<number>(0);
  const liveTranscriptRef = useRef<string>("");
  const interimTextRef = useRef<string>("");
  const chunkSeqRef = useRef<number>(0);
  const orderedChunkTextsRef = useRef<Map<number, string>>(new Map());
  const inFlightChunksRef = useRef<number>(0);
  const pendingFinalizeRef = useRef<{ fastMode: boolean } | null>(null);
  const activeQuestionEpochRef = useRef<number>(0);
  const recognitionWorkingRef = useRef<boolean>(false);
  const lastAskedRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const unsyncedSecondsRef = useRef<number>(0);

  profileRef.current = profile;
  qaListRef.current = qaList;
  isEngineRunningRef.current = isEngineRunning;
  isConnectedRef.current = isConnected;
  glitchActiveRef.current = glitchCountdown > 0;
  videoDurationRef.current = videoDurationSec;
  glitchDurationRef.current = glitchDurationSec;
  sessionActiveRef.current = Boolean(isAuthenticated && activeSessionToken);
  tokenStateRef.current = isAuthenticated ? activeSessionToken : null;
  quotaBlockedReasonRef.current = quotaBlockedReason;
  activeProblemContextRef.current = activeProblemContext;
  selectedAudioInputRef.current = selectedAudioInput;

  // Mount-only auth wipe: never re-run on parent callback identity changes
  const onTokenChangeRef = useRef(onTokenChange);
  onTokenChangeRef.current = onTokenChange;
  useEffect(() => {
    clearOverlayAuthStorage();
    setIsAuthenticated(false);
    setActiveSessionToken(null);
    onTokenChangeRef.current(null);
  }, []);

  const applyQuotaSnapshot = useCallback(
    (quota: AccountQuotaSnapshot) => {
      setTimerBaseSeconds(quota.remainingSeconds);
      setTimerSyncVersion((v) => v + 1);
      setPromptsUsed(quota.promptsUsed);
      setMaxPrompts(quota.promptLimit);
      setCapturesUsed(quota.capturesUsed);
      setCaptureLimit(quota.captureLimit);
      setQuotaBlockedReason(quota.blockedReason);
      const curTok = tokenStateRef.current;
      if (
        curTok &&
        (!curTok.quota ||
          curTok.quota.remainingSeconds !== quota.remainingSeconds ||
          curTok.quota.capturesUsed !== quota.capturesUsed ||
          curTok.quota.promptsUsed !== quota.promptsUsed ||
          curTok.quota.status !== quota.status)
      ) {
        const updatedTok = { ...curTok, quota };
        setActiveSessionToken(updatedTok);
        onTokenChange(updatedTok);
      }
    },
    [onTokenChange]
  );

  useEffect(() => {
    if (isAuthenticated && activeSessionToken?.quota) {
      setTimerBaseSeconds(activeSessionToken.quota.remainingSeconds);
      setTimerSyncVersion((v) => v + 1);
      setPromptsUsed(activeSessionToken.quota.promptsUsed);
      setMaxPrompts(activeSessionToken.quota.promptLimit);
      setCapturesUsed(activeSessionToken.quota.capturesUsed);
      setCaptureLimit(activeSessionToken.quota.captureLimit);
      setQuotaBlockedReason(activeSessionToken.quota.blockedReason);
    }
  }, [isAuthenticated, activeSessionToken?.quota]);

  // Enumerate available microphone input devices for the Audio Input Selector
  const refreshAudioInputDevices = useCallback(async () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.enumerateDevices
    ) {
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices
        .filter((d) => d.kind === "audioinput")
        .map((d, idx) => ({
          deviceId: d.deviceId || `mic-${idx}`,
          label: d.label?.trim() || `Microphone ${idx + 1}`,
        }))
        .filter(
          (d, idx, arr) =>
            d.deviceId !== "default" &&
            d.deviceId !== "communications" &&
            arr.findIndex((x) => x.deviceId === d.deviceId) === idx
        );
      setAudioInputs(mics);
    } catch {
      // Ignore enumerateDevices errors in restricted contexts
    }
  }, []);

  useEffect(() => {
    void refreshAudioInputDevices();
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.addEventListener
    ) {
      return;
    }
    const onChange = () => void refreshAudioInputDevices();
    navigator.mediaDevices.addEventListener("devicechange", onChange);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", onChange);
    };
  }, [refreshAudioInputDevices]);

  const desktopMode = isDesktopApp();
  const serverDisplayUrl =
    getApiBaseUrl() ||
    (typeof window !== "undefined" &&
    (window.location.protocol === "http:" ||
      window.location.protocol === "https:")
      ? window.location.origin
      : DEFAULT_PRODUCTION_API_URL);

  const isSessionLive = Boolean(isAuthenticated && activeSessionToken);

  // Verify token submitted by user and jump directly into the main workspace (timer PAUSED, audio Standby)
  const handleVerifyToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const trimmedToken = tokenInput.trim();
    if (!trimmedToken) {
      setAuthError(
        "Please enter your Session Token Key from Dashboard → Overview."
      );
      return;
    }

    setVerifyingToken(true);
    try {
      const data = await verifySessionToken(trimmedToken);
      const verifiedToken: SessionTokenState = {
        ...data.token,
        authenticated: true,
        sessionActive: true,
      };

      // Always land directly on the main workspace with timer PAUSED & audio in Standby (Monitor: OFF)
      isEngineRunningRef.current = false;
      setIsEngineRunning(false);
      setMonitorAudio(false);
      setIsListening(false);
      setIsConnected(true);
      setQuotaBlockedReason(verifiedToken.quota?.blockedReason ?? null);
      if (verifiedToken.quota) {
        setTimerBaseSeconds(verifiedToken.quota.remainingSeconds);
        setTimerSyncVersion((v) => v + 1);
        setPromptsUsed(verifiedToken.quota.promptsUsed);
        setMaxPrompts(verifiedToken.quota.promptLimit);
        setCapturesUsed(verifiedToken.quota.capturesUsed);
        setCaptureLimit(verifiedToken.quota.captureLimit);
      }

      setActiveSessionToken(verifiedToken);
      setIsAuthenticated(true);
      onTokenChange(verifiedToken);
      if (data.profile) {
        onProfileChange(data.profile);
      }

      // Sync session-ready status silently in the background without blocking workspace entry
      void startLiveSession().catch(() => {});
    } catch (err) {
      console.error("[Crackpilot Overlay] Token authentication failed:", err);
      setIsAuthenticated(false);
      setActiveSessionToken(null);
      setAuthError(
        err instanceof Error
          ? err.message
          : "Invalid, expired, or blocked session token."
      );
    } finally {
      setVerifyingToken(false);
    }
  };

  const flushElapsedSeconds = useCallback(() => {
    const currentTok = tokenStateRef.current?.token;
    const elapsed = unsyncedSecondsRef.current;
    if (!currentTok || elapsed <= 0) return;
    unsyncedSecondsRef.current = 0;
    void syncTokenElapsedSeconds(currentTok, elapsed).then((res) => {
      if (res.ok) {
        applyQuotaSnapshot(res.quota);
      }
    });
  }, [applyQuotaSnapshot]);

  const pauseSessionAndTimerRef = useRef<(reason?: string) => void>(() => {});
  const disconnectSessionRef = useRef<() => void>(() => {});

  const handleMinimizeWindow = () => {
    // Minimizing ALWAYS pauses the active session and stops the timer immediately
    pauseSessionAndTimerRef.current(
      "Minimized — session and timer paused. Click Start to resume."
    );

    const bridge = window.crackpilotDesktop;
    if (bridge?.isElectron) {
      console.log("[Crackpilot Overlay] Minimize button clicked -> timer paused + IPC crackpilot:minimize");
      void bridge
        .minimizeWindow()
        .catch((err) => {
          console.error("[Crackpilot Overlay] Async minimizeWindow IPC failed, trying sync fallback:", err);
          if (bridge.minimizeWindowSync) {
            bridge.minimizeWindowSync();
          }
        });
      return;
    }

    if (desktopMode) {
      console.error(
        "[Crackpilot Overlay] Desktop mode detected but window.crackpilotDesktop preload bridge is missing! Check electron/main.cjs preload path."
      );
      setIsHidden(true);
      return;
    }

    setIsCompact((c) => !c);
  };

  const handleToggleMaximize = () => {
    setIsCompact(false);
    const bridge = window.crackpilotDesktop;
    if (bridge?.isElectron) {
      console.log("[Crackpilot Overlay] Maximize button clicked -> IPC crackpilot:toggle-maximize");
      void bridge
        .toggleMaximize()
        .then((max) => setIsMaximized(Boolean(max)))
        .catch((err) => {
          console.error("[Crackpilot Overlay] toggleMaximize IPC failed:", err);
        });
      return;
    }
    setIsMaximized((m) => !m);
  };

  const handleCloseAndDisconnect = () => {
    // Clicking the Cross (×) icon ALWAYS disconnects the session cleanly
    disconnectSessionRef.current();
    const bridge = window.crackpilotDesktop;
    if (bridge?.isElectron && bridge.closeWindow) {
      console.log("[Crackpilot Overlay] Cross (×) clicked -> session disconnected + IPC crackpilot:close");
      window.setTimeout(() => {
        void bridge.closeWindow?.().catch((err) => {
          console.error("[Crackpilot Overlay] closeWindow IPC failed:", err);
        });
      }, 120);
      return;
    }
  };

  // Document Picture-in-Picture Always-On-Top Float Across Browser Tabs
  const handlePopOutFloatingWindow = async () => {
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
      return;
    }

    try {
      const pipWin = await docPip.requestWindow({
        width: Math.min(1000, hudWidthPx),
        height: 660,
      });
      pipWin.document.title = "Crackpilot";
      pipWin.document.body.style.margin = "0";
      pipWin.document.body.style.background = "#070b14";
      pipWin.document.body.style.overflow = "hidden";
      const iframe = pipWin.document.createElement("iframe");
      iframe.src = `${window.location.origin}/?mode=software`;
      iframe.style.width = "100vw";
      iframe.style.height = "100vh";
      iframe.style.border = "none";
      iframe.allow = "microphone; display-capture; clipboard-write";
      pipWin.document.body.appendChild(iframe);
    } catch {
      // Ignore PiP cancellation
    }
  };

  // Horizontal drag-to-resize HUD width from left or right edge
  const startWidthResize = (side: "left" | "right", startClientX: number) => {
    setIsMaximized(false);
    setIsResizing(true);
    const initialWidth = hudWidthPx;

    const onMouseMove = (ev: MouseEvent) => {
      const delta =
        side === "right"
          ? (ev.clientX - startClientX) * 2
          : (startClientX - ev.clientX) * 2;
      const maxAllowed = Math.max(520, window.innerWidth - 20);
      const next = Math.min(maxAllowed, Math.max(480, initialWidth + delta));
      setHudWidthPx(Math.round(next));
    };

    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Hydrate exact remaining balance from backend on session launch without starting countdown
  useEffect(() => {
    if (!isSessionLive || !activeSessionToken?.token) return;
    void fetchTokenQuota(activeSessionToken.token).then((res) => {
      if (res.ok) {
        applyQuotaSnapshot(res.quota);
      }
    });
  }, [isSessionLive, activeSessionToken?.token, applyQuotaSnapshot]);

  // Real-time Server & AI Key Diagnostics (/api/health -> boolean readiness flags)
  const checkServerDiagnostics = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl("/api/health"), {
        method: "GET",
        cache: "no-store",
      });
      const ct = (resp.headers.get("content-type") || "").toLowerCase();
      if (!resp.ok || !ct.includes("application/json")) {
        setServerDiag({
          checked: true,
          reachable: false,
          groq: false,
          deepgram: false,
          llmReady: false,
          sttReady: false,
          error: `Server unreachable (${resp.status})`,
        });
        return;
      }
      const data = (await resp.json()) as {
        ok?: boolean;
        engines?: {
          groq?: boolean;
          deepgram?: boolean;
          llmReady?: boolean;
          sttReady?: boolean;
        };
      };
      const eng = data.engines;
      const llmReady = Boolean(eng?.llmReady ?? true);
      const sttReady = Boolean(eng?.sttReady ?? true);
      let diagErr: string | null = null;
      if (eng && !llmReady && !sttReady) {
        diagErr = "Missing GROQ_API_KEY & DEEPGRAM_API_KEY";
      } else if (eng && !llmReady) {
        diagErr = "Missing GROQ_API_KEY on Server";
      } else if (eng && !sttReady) {
        diagErr = "Missing DEEPGRAM_API_KEY on Server";
      }
      setServerDiag({
        checked: true,
        reachable: Boolean(data.ok),
        groq: Boolean(eng?.groq),
        deepgram: Boolean(eng?.deepgram),
        llmReady,
        sttReady,
        error: diagErr,
      });
    } catch {
      setServerDiag({
        checked: true,
        reachable: false,
        groq: false,
        deepgram: false,
        llmReady: false,
        sttReady: false,
        error: "Server Unreachable — check internet / Server URL",
      });
    }
  }, []);

  useEffect(() => {
    if (!isSessionLive) return;
    void checkServerDiagnostics();
  }, [isSessionLive, checkServerDiagnostics]);

  // Called only when isolated SessionTimerDisplay hits 00:00
  const handleTimeExhausted = useCallback(() => {
    setQuotaBlockedReason(
      "Remaining time is 0 minutes. Ask the admin to add extra time, then click Reconnect."
    );
    isEngineRunningRef.current = false;
    setIsEngineRunning(false);
  }, []);

  // Background 20s quota sync with AdminStore (ONLY deducts elapsed seconds when Start actually ran)
  useEffect(() => {
    if (!isSessionLive || !activeSessionToken?.token) return;
    const intervalId = window.setInterval(() => {
      const currentTok = tokenStateRef.current?.token;
      if (!currentTok) return;
      const elapsed = unsyncedSecondsRef.current;
      unsyncedSecondsRef.current = 0;

      const syncPromise =
        elapsed > 0
          ? syncTokenElapsedSeconds(currentTok, elapsed)
          : fetchTokenQuota(currentTok);

      void syncPromise.then((res) => {
        if (res.ok) {
          applyQuotaSnapshot(res.quota);
        } else if (res.revoked) {
          setQuotaBlockedReason(
            res.error || "This token has been revoked by the administrator."
          );
          setIsEngineRunning(false);
          isEngineRunningRef.current = false;
        }
      });
    }, 20000);
    return () => window.clearInterval(intervalId);
  }, [isSessionLive, activeSessionToken?.token, applyQuotaSnapshot]);

  // 100% Free, non-hijacking scroll tracking:
  // Never force-scroll when the user is reading older answers down the feed.
  const handleFeedScroll = useCallback(() => {
    const el = feedRef.current;
    if (!el) return;
    const nearTop = el.scrollTop < 60;
    isAtTopRef.current = nearTop;
    setShowJumpToTop(!nearTop);
    if (nearTop) {
      setHasUnseenLatest(false);
    }
  }, []);

  const jumpToLatestTop = useCallback(() => {
    if (feedRef.current) {
      feedRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
    isAtTopRef.current = true;
    setShowJumpToTop(false);
    setHasUnseenLatest(false);
  }, []);

  // Never hijack feedRef.current.scrollTop automatically on streaming updates,
  // timer ticks, or audio levels. User scrolls 100% freely unless clicking Latest Answer.

  useEffect(() => {
    if (monitorGainRef.current) {
      // Only pass audio back to speakers for muted browser tab captures;
      // in Electron WASAPI loopback and physical Mic mode, keep gain 0 to avoid echo/howling while Monitor: ON tracks live voice.
      const shouldPassToSpeakers =
        monitorAudio && listenMode === "tab" && !isDesktopApp();
      monitorGainRef.current.gain.value = shouldPassToSpeakers ? 1.0 : 0.0;
    }
  }, [monitorAudio, listenMode]);

  const streamAnswerFromEndpoint = useCallback(
    async (
      qaId: string,
      endpoint:
        | "/api/incoming-question"
        | "/api/answer"
        | "/api/analyze-screen"
        | "/api/analyze-video",
      body: Record<string, unknown>,
      allowWhenPaused = false
    ) => {
      if (
        quotaBlockedReasonRef.current ||
        (!allowWhenPaused && !isEngineRunningRef.current) ||
        !isConnectedRef.current ||
        glitchActiveRef.current
      ) {
        setQaList((prev) =>
          prev.map((q) =>
            q.id === qaId
              ? {
                  ...q,
                  isStreaming: false,
                  error: quotaBlockedReasonRef.current
                    ? quotaBlockedReasonRef.current
                    : !allowWhenPaused && !isEngineRunningRef.current
                      ? "Software is paused. Click Start to resume AI answers and live listening."
                      : glitchActiveRef.current
                        ? "Network paused (Glitch active). Waiting to restore..."
                        : "Session disconnected. Click Reconnect (Alt+R).",
                }
              : q
          )
        );
        return;
      }

      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      const targetUrl = apiUrl(endpoint);
      if (!hasConfiguredBackend()) {
        const msg =
          "No live AI backend server URL is configured in Desktop mode. Open the ••• menu above and set your Crackpilot Node.js Server URL (e.g. http://localhost:3000).";
        console.error("[Crackpilot AI] Blocked request — no backend URL configured:", endpoint);
        setQaList((prev) =>
          prev.map((q) =>
            q.id === qaId ? { ...q, isStreaming: false, error: msg } : q
          )
        );
        return;
      }

      const requestStartedAt = performance.now();
      let firstTokenRecorded = false;

      try {
        const resp = await fetch(targetUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify(body),
        });

        const contentType = (resp.headers.get("content-type") || "").toLowerCase();
        if (!resp.ok || !resp.body || !contentType.includes("text/event-stream")) {
          const errText = await resp.text();
          if (resp.status === 403 && contentType.includes("application/json")) {
            try {
              const parsed = JSON.parse(errText) as {
                error?: string;
                quota?: AccountQuotaSnapshot;
              };
              if (parsed.quota) applyQuotaSnapshot(parsed.quota);
              if (parsed.error) setQuotaBlockedReason(parsed.error);
              throw new Error(parsed.error || "Account quota exhausted or suspended.");
            } catch (quotaErr) {
              if (quotaErr instanceof Error) throw quotaErr;
            }
          }
          const preview = errText.trim().slice(0, 160).replace(/\s+/g, " ");
          console.error(
            `[Crackpilot AI] Invalid response from ${targetUrl} (status=${resp.status}, content-type="${contentType || "none"}", preview="${preview}")`
          );
          if (
            contentType.includes("text/html") ||
            contentType.includes("text/plain") ||
            errText.trim().startsWith("<") ||
            resp.status === 404
          ) {
            throw new Error(
              "Live AI backend server is not reachable at this URL. Start your Crackpilot Node.js server (npm run dev) or set the Server URL in the ••• settings menu."
            );
          }
          throw new Error(preview || `Server returned ${resp.status}`);
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const raw = trimmed.slice(5).trim();
            if (!raw) continue;
            try {
              const payload = JSON.parse(raw) as {
                chunk?: string;
                done?: boolean;
                error?: string;
                meta?: { engine?: string };
                dsaData?: DsaTeleprompterData;
              };
              if (payload.meta?.engine) {
                const eng =
                  payload.meta.engine === "groq"
                    ? "Groq"
                    : payload.meta.engine === "openai"
                      ? "OpenAI"
                      : "AI";
                setLiveApiError(null);
                setQaList((prev) =>
                  prev.map((q) => (q.id === qaId ? { ...q, engine: eng } : q))
                );
              }
              if (payload.dsaData) {
                const dsaPayload = payload.dsaData;
                let measuredLatency: number | undefined;
                if (!firstTokenRecorded) {
                  firstTokenRecorded = true;
                  measuredLatency = Math.max(
                    1,
                    Math.round(performance.now() - requestStartedAt)
                  );
                }
                setActiveProblemContext(dsaPayload.problemContext);
                activeProblemContextRef.current = dsaPayload.problemContext;
                setQaList((prev) =>
                  prev.map((q) =>
                    q.id === qaId
                      ? {
                          ...q,
                          question: `${dsaPayload.problemContext.title} (${dsaPayload.problemContext.preferredLanguage})`,
                          dsaData: dsaPayload,
                          ...(measuredLatency !== undefined
                            ? { latencyMs: measuredLatency }
                            : {}),
                        }
                      : q
                  )
                );
              }
              if (payload.chunk) {
                let measuredLatency: number | undefined;
                if (!firstTokenRecorded) {
                  firstTokenRecorded = true;
                  measuredLatency = Math.max(
                    1,
                    Math.round(performance.now() - requestStartedAt)
                  );
                }
                setQaList((prev) =>
                  prev.map((q) =>
                    q.id === qaId
                      ? {
                          ...q,
                          answer: q.answer + payload.chunk,
                          ...(measuredLatency !== undefined
                            ? { latencyMs: measuredLatency }
                            : {}),
                        }
                      : q
                  )
                );
              }
              if (payload.error) {
                setLiveApiError(payload.error);
                setQaList((prev) =>
                  prev.map((q) =>
                    q.id === qaId
                      ? { ...q, isStreaming: false, error: payload.error }
                      : q
                  )
                );
              }
              if (payload.done) {
                setQaList((prev) =>
                  prev.map((q) =>
                    q.id === qaId ? { ...q, isStreaming: false } : q
                  )
                );
              }
            } catch {
              // Ignore incomplete SSE lines
            }
          }
        }

        setQaList((prev) =>
          prev.map((q) => (q.id === qaId ? { ...q, isStreaming: false } : q))
        );
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setQaList((prev) =>
            prev.map((q) => (q.id === qaId ? { ...q, isStreaming: false } : q))
          );
          return;
        }
        const msg = err instanceof Error ? err.message : "Network error.";
        setQaList((prev) =>
          prev.map((q) =>
            q.id === qaId ? { ...q, isStreaming: false, error: msg } : q
          )
        );
      }
    },
    []
  );

  const askQuestion = useCallback(
    async (questionText: string, fastMode = false, allowWhenPaused = false) => {
      const cleaned = questionText.trim();
      if (!cleaned) return;
      if (quotaBlockedReasonRef.current) {
        return;
      }
      if (!allowWhenPaused && !isEngineRunningRef.current) {
        return;
      }
      if (!isConnectedRef.current) {
        return;
      }
      if (glitchActiveRef.current) {
        return;
      }

      // Prevent duplicate triggers from overlapping speech recognition / VAD chunks
      const now = Date.now();
      const norm = cleaned.toLowerCase();
      if (
        !allowWhenPaused &&
        lastAskedRef.current.text === norm &&
        now - lastAskedRef.current.at < 4000
      ) {
        return;
      }
      lastAskedRef.current = { text: norm, at: now };

      setPromptsUsed((c) => Math.min(maxPrompts, c + 1));

      const qaId = `qa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      // Newest-first reverse stack order: push latest Q&A to the very top
      setQaList((prev) => [
        {
          id: qaId,
          timestamp: formatNow(),
          question: cleaned,
          answer: "",
          engine: "AI",
          isStreaming: true,
        },
        ...prev,
      ]);
      if (!isAtTopRef.current) {
        setHasUnseenLatest(true);
      }

      const cur = profileRef.current;
      const recentHistory = qaListRef.current
        .filter((q) => q.id !== "system-init" && !q.isStreaming && q.answer)
        .slice(0, 3)
        .reverse()
        .map((q) => ({ question: q.question, answer: q.answer }));

      await streamAnswerFromEndpoint(
        qaId,
        "/api/incoming-question",
        {
          token: tokenStateRef.current?.token,
          question: cleaned,
          fastMode,
          role: cur.role,
          experience: cur.experience,
          skills: cur.skills,
          resumeText: cur.resumeText,
          jdText: cur.jdText,
          answerLanguage: cur.answerLanguage,
          answerStyle: normalizeAnswerStyle(cur.answerStyle),
          dsaModeEnabled: Boolean(cur.dsaModeEnabled),
          preferredLanguage: normalizeProgrammingLanguage(cur.preferredLanguage),
          activeProblemContext: activeProblemContextRef.current,
          history: recentHistory,
        },
        allowWhenPaused
      );
    },
    [maxPrompts, streamAnswerFromEndpoint]
  );

  // Sync live events (Dashboard Start Session, Target Profile updates, Python loopback audio)
  // Probed via /api/health first so static Vercel & standalone Electron never spam EventSource MIME errors
  const connectEventStream = useCallback(async (forceProbe = false): Promise<boolean> => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }

    const healthy = await probeBackendHealth(forceProbe);
    if (!healthy) {
      return false;
    }

    const eventsUrl = apiUrl("/api/events");
    try {
      const source = new EventSource(eventsUrl);
      source.onopen = () => {
        setIsConnected(true);
        setIsReconnecting(false);
      };
      source.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as {
            type?: string;
            question?: string;
            token?: SessionTokenState | null;
            tokenValue?: string;
            quota?: AccountQuotaSnapshot;
            profile?: TargetProfile;
            activeProblemContext?: ActiveProblemContext | null;
          };
          // NEVER auto-authenticate or overwrite activeSessionToken from SSE broadcasts
          if (data.type === "dsa_problem_updated" && data.activeProblemContext) {
            setActiveProblemContext(data.activeProblemContext);
            activeProblemContextRef.current = data.activeProblemContext;
          } else if (data.type === "dsa_problem_cleared") {
            setActiveProblemContext(null);
            activeProblemContextRef.current = null;
          } else if (
            data.type === "connected" &&
            data.activeProblemContext !== undefined
          ) {
            setActiveProblemContext(data.activeProblemContext);
            activeProblemContextRef.current = data.activeProblemContext;
          }
          if (
            data.type === "quota_updated" &&
            data.quota &&
            tokenStateRef.current?.token &&
            (!data.tokenValue || data.tokenValue === tokenStateRef.current.token)
          ) {
            applyQuotaSnapshot(data.quota);
          }
          if (
            data.type === "account_revoked" &&
            data.tokenValue &&
            data.tokenValue === tokenStateRef.current?.token
          ) {
            setQuotaBlockedReason(
              "Your token has been revoked by the administrator."
            );
            setIsEngineRunning(false);
            isEngineRunningRef.current = false;
          }
          if (data.profile) {
            onProfileChange(data.profile);
          }
          if (
            data.type === "incoming_question" &&
            data.question &&
            sessionActiveRef.current &&
            isEngineRunningRef.current
          ) {
            void askQuestion(data.question);
          }
        } catch (parseErr) {
          console.warn("[Crackpilot Overlay SSE] Malformed SSE payload:", parseErr);
        }
      };
      source.onerror = () => {
        console.warn(
          "[Crackpilot Overlay SSE] EventSource error on",
          eventsUrl,
          "— closing stream cleanly."
        );
        source.close();
        if (sseRef.current === source) {
          sseRef.current = null;
        }
      };
      sseRef.current = source;
      return true;
    } catch (err) {
      console.error("[Crackpilot Overlay SSE] Failed to open EventSource:", err);
      return false;
    }
  }, [applyQuotaSnapshot, askQuestion, onProfileChange]);

  useEffect(() => {
    const unsubLocal = subscribeLocalSync((msg) => {
      // Only sync target profile silently; NEVER bypass authentication via BroadcastChannel
      if (msg.profile) onProfileChange(msg.profile);
    });
    return () => {
      unsubLocal();
      sseRef.current?.close();
    };
  }, [onProfileChange]);

  useEffect(() => {
    const onOnline = () => {
      if (isEngineRunningRef.current && isConnectedRef.current && !glitchActiveRef.current) {
        void connectEventStream();
      }
    };
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
    };
  }, [connectEventStream]);

  const stopAudioListening = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);
    setListenMode(null);
    setMonitorAudio(false);
    interimTextRef.current = "";
    liveTranscriptRef.current = "";
    analyserRef.current = null;

    activeQuestionEpochRef.current += 1;
    orderedChunkTextsRef.current.clear();
    inFlightChunksRef.current = 0;
    pendingFinalizeRef.current = null;
    speechSessionStartedAtRef.current = 0;
    speechActiveRef.current = false;

    if (chunkTimerRef.current !== null) {
      window.clearInterval(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }
    if (pauseTriggerTimerRef.current !== null) {
      window.clearTimeout(pauseTriggerTimerRef.current);
      pauseTriggerTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        // Ignore
      }
      recognitionRef.current = null;
    }
    if (pcmProcessorRef.current) {
      try {
        pcmProcessorRef.current.onaudioprocess = null;
        pcmProcessorRef.current.disconnect();
      } catch {
        // Ignore
      }
      pcmProcessorRef.current = null;
    }
    preRollPcmRef.current = [];
    speechPcmRef.current = [];
    flushPcmUtteranceRef.current = null;

    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
      monitorGainRef.current = null;
    }
    if (mixAudioCtxRef.current) {
      void mixAudioCtxRef.current.close();
      mixAudioCtxRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;
    }
    if (extraAudioStreamsRef.current.length > 0) {
      extraAudioStreamsRef.current.forEach((s) =>
        s.getTracks().forEach((t) => t.stop())
      );
      extraAudioStreamsRef.current = [];
    }
  }, []);

  const stopScreenStream = useCallback(() => {
    if (videoScanTimerRef.current !== null) {
      window.clearInterval(videoScanTimerRef.current);
      videoScanTimerRef.current = null;
    }
    if (videoFrameIntervalRef.current !== null) {
      window.clearInterval(videoFrameIntervalRef.current);
      videoFrameIntervalRef.current = null;
    }
    setVideoScanCountdown(0);

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    if (hiddenVideoRef.current) {
      hiddenVideoRef.current.srcObject = null;
    }
    setHasSharedScreen(false);
  }, []);

  const rebuildLiveTranscript = useCallback(() => {
    const orderedChunks = Array.from(orderedChunkTextsRef.current.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, txt]) => txt.trim())
      .filter(Boolean);

    const normalizeWord = (w: string) =>
      w.toLowerCase().replace(/^[^\w]+|[^\w]+$/g, "");

    const accWords: string[] = [];
    for (const chunk of orderedChunks) {
      const nextWords = chunk.split(/\s+/).filter(Boolean);
      if (nextWords.length === 0) continue;

      // Boundary deduplication: strip up to 3 overlapping words between adjacent chunks
      // so phrases like "multiple multiple" never duplicate across 3s micro-chunk boundaries
      let overlap = 0;
      const maxCheck = Math.min(3, accWords.length, nextWords.length);
      for (let k = maxCheck; k >= 1; k--) {
        let allMatch = true;
        for (let i = 0; i < k; i++) {
          const prevW = normalizeWord(accWords[accWords.length - k + i]);
          const currW = normalizeWord(nextWords[i]);
          if (!prevW || prevW !== currW) {
            allMatch = false;
            break;
          }
        }
        if (allMatch) {
          overlap = k;
          break;
        }
      }

      const trimmedNext = nextWords.slice(overlap);
      for (const w of trimmedNext) {
        accWords.push(w);
      }
    }

    const merged = accWords.join(" ").replace(/\s+/g, " ").trim();
    liveTranscriptRef.current = merged;
    return merged;
  }, []);

  const commitPendingAnswerIfReady = useCallback(() => {
    const pending = pendingFinalizeRef.current;
    if (!pending) return;
    if (inFlightChunksRef.current > 0) return;

    pendingFinalizeRef.current = null;
    if (pauseTriggerTimerRef.current !== null) {
      window.clearTimeout(pauseTriggerTimerRef.current);
      pauseTriggerTimerRef.current = null;
    }

    const combined = [liveTranscriptRef.current, interimTextRef.current]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    activeQuestionEpochRef.current += 1;
    orderedChunkTextsRef.current.clear();
    chunkSeqRef.current = 0;
    liveTranscriptRef.current = "";
    interimTextRef.current = "";
    speechSessionStartedAtRef.current = 0;
    speechActiveRef.current = false;

    if (combined.length > 2) {
      // Zero artificial delay: fire streaming SSE answer immediately
      void askQuestion(combined, pending.fastMode);
    }
  }, [askQuestion]);

  const transcribeWavBlob = useCallback(
    async (
      wavBlob: Blob,
      opts: {
        epoch: number;
        seq: number;
        isFinalFlush: boolean;
        fastMode?: boolean;
      }
    ) => {
      if (
        !isConnectedRef.current ||
        !isEngineRunningRef.current ||
        glitchActiveRef.current
      ) {
        return;
      }

      // Skip tiny/empty WAV buffers (< 0.4s @ 16kHz 16-bit mono = 44 + 12800 bytes)
      if (wavBlob.size < 44 + 12800) {
        if (opts.isFinalFlush) {
          pendingFinalizeRef.current = { fastMode: Boolean(opts.fastMode) };
          commitPendingAnswerIfReady();
        }
        return;
      }

      if (!hasConfiguredBackend()) {
        setLiveApiError("Configure Server URL in Settings");
        return;
      }

      if (opts.isFinalFlush) {
        pendingFinalizeRef.current = { fastMode: Boolean(opts.fastMode) };
      }

      inFlightChunksRef.current += 1;

      const curProfile = profileRef.current;
      const qs = new URLSearchParams({
        language: "en-IN",
        role: curProfile.role || "",
      }).toString();
      const transcribeUrl = `${apiUrl("/api/transcribe")}?${qs}`;

      try {
        // Send complete self-contained binary .wav Blob (~94KB per 3.5s micro-chunk, well below Vercel 4.5MB limit)
        const resp = await fetch(transcribeUrl, {
          method: "POST",
          headers: {
            "Content-Type": "audio/wav",
          },
          body: wavBlob,
        });
        const contentType = (resp.headers.get("content-type") || "").toLowerCase();
        const rawText = await resp.text();
        if (
          !contentType.includes("application/json") ||
          !rawText.trim() ||
          rawText.trim().startsWith("<")
        ) {
          console.error(
            `[Crackpilot Transcribe] Non-JSON response from ${transcribeUrl} (status=${resp.status}, content-type="${contentType || "none"}", preview="${rawText.trim().slice(0, 120)}")`
          );
          throw new Error(
            "Transcription server returned a non-JSON response. Check your Server URL in ••• Settings."
          );
        }
        let data: { text?: string; skipped?: boolean; error?: string };
        try {
          data = JSON.parse(rawText) as {
            text?: string;
            skipped?: boolean;
            error?: string;
          };
        } catch (parseErr) {
          console.error("[Crackpilot Transcribe] JSON parse failed:", parseErr);
          throw new Error("Transcription server returned invalid JSON.");
        }
        if (!resp.ok) {
          throw new Error(data.error || "Transcription failed.");
        }
        setLiveApiError(null);
        if (!data.skipped && opts.epoch === activeQuestionEpochRef.current) {
          const cleanedChunk = (data.text || "").trim();
          if (cleanedChunk.length > 0) {
            orderedChunkTextsRef.current.set(opts.seq, cleanedChunk);
            rebuildLiveTranscript();
          }
        }
      } catch (err) {
        console.error("[Crackpilot Transcribe] Error:", err);
        const errMsg =
          err instanceof Error ? err.message : "Audio transcription error.";
        setLiveApiError(errMsg);
      } finally {
        inFlightChunksRef.current = Math.max(0, inFlightChunksRef.current - 1);
        if (opts.epoch === activeQuestionEpochRef.current && pendingFinalizeRef.current) {
          commitPendingAnswerIfReady();
        }
      }
    },
    [commitPendingAnswerIfReady, rebuildLiveTranscript]
  );

  // Instant flush trigger (Alt+X) — works anytime during a short or 4-10 minute explanation
  const handleAnswerNow = useCallback(
    (fastMode = false) => {
      if (pauseTriggerTimerRef.current !== null) {
        window.clearTimeout(pauseTriggerTimerRef.current);
        pauseTriggerTimerRef.current = null;
      }
      if (flushPcmUtteranceRef.current && speechPcmRef.current.length > 0) {
        flushPcmUtteranceRef.current({ isFinalFlush: true, fastMode });
        return;
      }
      pendingFinalizeRef.current = { fastMode };
      commitPendingAnswerIfReady();
    },
    [commitPendingAnswerIfReady]
  );

  // Unified Web Audio API 16kHz Mono PCM Micro-Chunk Capture + Adaptive Noise Floor + 60fps AnalyserNode Meter
  // Calibrates ambient noise floor during the first 300ms, slices continuous speech into strictly non-overlapping
  // 3-second WAV micro-chunks (~94KB each) for instant live text, and triggers AI answer after an 850ms silence pause.
  const attachAudioMeter = useCallback(
    (audioStream: MediaStream, monitor: boolean) => {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;

        let ctx: AudioContext;
        try {
          ctx = new AudioCtx({ sampleRate: 16000 });
        } catch {
          ctx = new AudioCtx();
        }
        if (ctx.state === "suspended") {
          void ctx.resume().catch(() => {});
        }

        const source = ctx.createMediaStreamSource(audioStream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.65;

        const gain = ctx.createGain();
        gain.gain.value = monitor ? 1.0 : 0.0;

        source.connect(analyser);
        analyser.connect(gain);
        gain.connect(ctx.destination);

        // Capture raw mono Float32 PCM frames for self-contained 16kHz WAV encoding
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        const silentSink = ctx.createGain();
        silentSink.gain.value = 0.0;
        source.connect(processor);
        processor.connect(silentSink);
        silentSink.connect(ctx.destination);

        audioCtxRef.current = ctx;
        analyserRef.current = analyser;
        monitorGainRef.current = gain;
        pcmProcessorRef.current = processor;

        speechActiveRef.current = false;
        lastSpeechAtRef.current = 0;
        chunkStartedAtRef.current = Date.now();
        speechSessionStartedAtRef.current = 0;
        preRollPcmRef.current = [];
        speechPcmRef.current = [];

        const ROLLING_CHUNK_MS = 3_500; // Strictly non-overlapping 3.5s max WAV micro-chunks
        const PAUSE_TRIGGER_MS = 750; // Fast 750ms silence pause triggers sub-second AI streaming

        // Compact ~0.25s pre-roll ONLY prepended on silence -> speech transition (cleared immediately, zero overlap)
        const maxPreRollFrames = Math.max(
          1,
          Math.ceil((ctx.sampleRate * 0.25) / 4096)
        );

        // Adaptive room/speaker ambient noise floor calibration (first 300ms + gentle idle tracking)
        const calibrationEndsAt = Date.now() + 300;
        let isCalibratingNoise = true;
        let noiseSampleSum = 0;
        let noiseSampleCount = 0;
        let noiseFloorRms = 0.008;

        const flushSpeechToWav = (opts?: {
          isFinalFlush?: boolean;
          fastMode?: boolean;
        }) => {
          const isFinalFlush = Boolean(opts?.isFinalFlush);
          const fastMode = Boolean(opts?.fastMode);

          if (isFinalFlush) {
            speechActiveRef.current = false;
          }

          // Strictly non-overlapping slice: splice out all buffered frames so nothing is re-sent
          const frames = speechPcmRef.current.splice(0);
          chunkStartedAtRef.current = Date.now();

          if (recognitionWorkingRef.current) {
            if (isFinalFlush) {
              pendingFinalizeRef.current = { fastMode };
              commitPendingAnswerIfReady();
            }
            return;
          }

          const epoch = activeQuestionEpochRef.current;
          const seq = ++chunkSeqRef.current;

          const encoded =
            frames.length > 0
              ? encodePcm16WavBlob(frames, ctx.sampleRate, {
                  targetSampleRate: 16000,
                  minDurationSec: 0.4,
                })
              : null;

          if (!encoded) {
            if (isFinalFlush) {
              pendingFinalizeRef.current = { fastMode };
              commitPendingAnswerIfReady();
            }
            return;
          }

          void transcribeWavBlob(encoded.blob, {
            epoch,
            seq,
            isFinalFlush,
            fastMode,
          });
        };

        flushPcmUtteranceRef.current = flushSpeechToWav;

        processor.onaudioprocess = (ev) => {
          if (!isListeningRef.current) return;
          const input = ev.inputBuffer.getChannelData(0);
          if (!input || input.length === 0) return;

          const frameCopy = new Float32Array(input.length);
          frameCopy.set(input);

          let sumSq = 0;
          for (let i = 0; i < frameCopy.length; i++) {
            sumSq += frameCopy[i] * frameCopy[i];
          }
          const rms = Math.sqrt(sumSq / frameCopy.length);
          const now = Date.now();

          // Phase 1: 300ms ambient noise floor calibration so room/speaker hum never sticks "Speech detected"
          if (isCalibratingNoise) {
            noiseSampleSum += rms;
            noiseSampleCount += 1;
            preRollPcmRef.current.push(frameCopy);
            if (preRollPcmRef.current.length > maxPreRollFrames) {
              preRollPcmRef.current.shift();
            }
            if (now >= calibrationEndsAt) {
              const avgAmbient =
                noiseSampleCount > 0 ? noiseSampleSum / noiseSampleCount : 0.008;
              noiseFloorRms = Math.min(0.045, Math.max(0.004, avgAmbient));
              isCalibratingNoise = false;
            }
            return;
          }

          // Dynamic hysteresis thresholds above calibrated ambient floor
          const speechStartThreshold = Math.min(
            0.14,
            Math.max(0.018, noiseFloorRms * 2.5 + 0.008)
          );
          const speechSustainThreshold = Math.min(
            0.11,
            Math.max(0.014, noiseFloorRms * 2.0 + 0.006)
          );
          const activeThreshold = speechActiveRef.current
            ? speechSustainThreshold
            : speechStartThreshold;

          if (rms > activeThreshold) {
            if (pauseTriggerTimerRef.current !== null) {
              window.clearTimeout(pauseTriggerTimerRef.current);
              pauseTriggerTimerRef.current = null;
            }
            if (!speechActiveRef.current) {
              speechActiveRef.current = true;
              chunkStartedAtRef.current = now;
              if (speechSessionStartedAtRef.current === 0) {
                speechSessionStartedAtRef.current = now;
              }
              const preRoll = preRollPcmRef.current.splice(0);
              speechPcmRef.current = [...preRoll, frameCopy];
            } else {
              speechPcmRef.current.push(frameCopy);
            }
            lastSpeechAtRef.current = now;

            // Non-overlapping 3-second live micro-chunk slice during continuous speech
            if (now - chunkStartedAtRef.current >= ROLLING_CHUNK_MS) {
              flushSpeechToWav({ isFinalFlush: false, fastMode: false });
            }
          } else if (speechActiveRef.current) {
            speechPcmRef.current.push(frameCopy);
            const silenceMs = now - lastSpeechAtRef.current;
            const chunkMs = now - chunkStartedAtRef.current;

            if (silenceMs >= PAUSE_TRIGGER_MS) {
              // Fast 850ms silence pause -> flush trailing audio and stream AI answer immediately
              flushSpeechToWav({ isFinalFlush: true, fastMode: false });
            } else if (chunkMs >= ROLLING_CHUNK_MS) {
              // Brief breath pause inside continuous speech -> slice 3s non-overlapping micro-chunk
              flushSpeechToWav({ isFinalFlush: false, fastMode: false });
            }
          } else {
            // Gently adapt ambient floor while silent so AC/fan/speaker hum never triggers false speech
            noiseFloorRms = Math.min(
              0.045,
              Math.max(0.004, noiseFloorRms * 0.96 + rms * 0.04)
            );
            preRollPcmRef.current.push(frameCopy);
            if (preRollPcmRef.current.length > maxPreRollFrames) {
              preRollPcmRef.current.shift();
            }
          }
        };

        // Audio level animation is isolated inside memoized AudioLevelMeter (GPU scaleX, 0 parent re-renders)
      } catch (err) {
        console.warn("[Crackpilot Audio] Web Audio PCM WAV init warning:", err);
      }
    },
    [commitPendingAnswerIfReady, transcribeWavBlob]
  );

  // Capture Microphone audio (captures nearby speaker / interviewer laptop voice & works out of the box in Electron + Browser)
  const startMicrophoneAudio = useCallback(
    async (deviceId?: string) => {
      if (!isEngineRunningRef.current || !isConnectedRef.current) {
        return;
      }
      stopAudioListening();
      recognitionWorkingRef.current = false;

      try {
        const audioConstraint: MediaTrackConstraints = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        };
        if (deviceId && deviceId !== "default" && deviceId !== "system-loopback") {
          audioConstraint.deviceId = { exact: deviceId };
        }

        let micStream: MediaStream;
        try {
          micStream = await navigator.mediaDevices.getUserMedia({
            audio: audioConstraint,
          });
        } catch {
          micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
        }

        if (!isEngineRunningRef.current) {
          micStream.getTracks().forEach((t) => t.stop());
          return;
        }

        // Refresh device labels now that microphone permission is granted
        void refreshAudioInputDevices();

        audioStreamRef.current = micStream;
        isListeningRef.current = true;
        setIsListening(true);
        setListenMode("mic");
        setMonitorAudio(true);

        attachAudioMeter(micStream, false);

        // Start real-time Web Speech Recognition when supported (instant live Q streaming in Chrome/Edge)
        // Automatically falls back to VAD + /api/transcribe in Electron if Web Speech API errors
        const SpeechRecCtor =
          (
            window as unknown as {
              SpeechRecognition?: new () => SpeechRecognitionLike;
              webkitSpeechRecognition?: new () => SpeechRecognitionLike;
            }
          ).SpeechRecognition ||
          (
            window as unknown as {
              webkitSpeechRecognition?: new () => SpeechRecognitionLike;
            }
          ).webkitSpeechRecognition;

        if (SpeechRecCtor && !isDesktopApp()) {
          try {
            const rec = new SpeechRecCtor();
            rec.continuous = true;
            rec.interimResults = true;
            rec.lang = "en-IN";

            rec.onresult = (event) => {
              recognitionWorkingRef.current = true;
              let interim = "";
              let finalChunk = "";
              for (let i = event.resultIndex; i < event.results.length; i++) {
                const text = event.results[i][0]?.transcript || "";
                if (event.results[i].isFinal) {
                  finalChunk += `${text} `;
                } else {
                  interim += text;
                }
              }
              const trimmedInterim = interim.trim();
              interimTextRef.current = trimmedInterim;

              if (speechSessionStartedAtRef.current === 0 && (trimmedInterim || finalChunk.trim())) {
                speechSessionStartedAtRef.current = Date.now();
              }

              const cleanedFinal = finalChunk.trim();
              if (cleanedFinal.length > 0) {
                const seq = ++chunkSeqRef.current;
                orderedChunkTextsRef.current.set(seq, cleanedFinal);
                rebuildLiveTranscript();
                interimTextRef.current = "";
              }

              // Reset 750ms silence trigger on every live word for fast response after speech ends
              if (pauseTriggerTimerRef.current !== null) {
                window.clearTimeout(pauseTriggerTimerRef.current);
              }
              if (liveTranscriptRef.current || interimTextRef.current) {
                pauseTriggerTimerRef.current = window.setTimeout(() => {
                  pendingFinalizeRef.current = { fastMode: false };
                  commitPendingAnswerIfReady();
                }, 750);
              }
            };

            rec.onerror = (ev) => {
              if (
                ev.error === "network" ||
                ev.error === "service-not-allowed" ||
                ev.error === "not-allowed"
              ) {
                recognitionWorkingRef.current = false;
                try {
                  rec.onend = null;
                  rec.stop();
                } catch {
                  // Ignore
                }
              }
            };

            rec.onend = () => {
              if (isListeningRef.current && isEngineRunningRef.current) {
                try {
                  rec.start();
                } catch {
                  recognitionWorkingRef.current = false;
                }
              }
            };

            recognitionRef.current = rec;
            rec.start();
          } catch {
            recognitionWorkingRef.current = false;
          }
        }

        setMicDiagError(null);
      } catch (err) {
        console.error("[Crackpilot Audio] Microphone capture error:", err);
        const errName = err instanceof Error ? err.name : "";
        const errMsg = err instanceof Error ? err.message : "";
        if (
          errName === "NotAllowedError" ||
          errName === "PermissionDeniedError" ||
          /denied|permission/i.test(errMsg)
        ) {
          setMicDiagError("Mic Permission Denied");
        } else if (errName === "NotFoundError") {
          setMicDiagError("No Microphone Detected");
        } else {
          setMicDiagError(errMsg || "Mic Capture Error");
        }
      }
    },
    [
      attachAudioMeter,
      commitPendingAnswerIfReady,
      rebuildLiveTranscript,
      refreshAudioInputDevices,
      stopAudioListening,
    ]
  );

  // Capture System / Loopback / Meeting Tab Audio (interviewer audio via display media loopback)
  const startTabSystemAudio = useCallback(async () => {
    if (!isEngineRunningRef.current || !isConnectedRef.current) {
      return;
    }
    stopAudioListening();
    recognitionWorkingRef.current = false;

    try {
      let displayStream: MediaStream;
      try {
        displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: {
            echoCancellation: false,
            noiseSuppression: true,
            autoGainControl: true,
            suppressLocalAudioPlayback: false,
          } as MediaTrackConstraints,
        });
      } catch {
        displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
      }

      if (!isEngineRunningRef.current) {
        displayStream.getTracks().forEach((t) => t.stop());
        return;
      }

      screenStreamRef.current = displayStream;
      setHasSharedScreen(true);

      const videoTrack = displayStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => stopScreenStream();
      }
      if (hiddenVideoRef.current) {
        hiddenVideoRef.current.srcObject = displayStream;
        await hiddenVideoRef.current.play();
      }

      const audioTracks = displayStream.getAudioTracks();
      if (audioTracks.length === 0) {
        return;
      }

      const audioOnly = new MediaStream(audioTracks);
      audioStreamRef.current = audioOnly;
      isListeningRef.current = true;
      setIsListening(true);
      setListenMode("tab");
      setMonitorAudio(true);
      setMicDiagError(null);
      attachAudioMeter(audioOnly, false);
    } catch (err) {
      console.warn("[Crackpilot Audio] System / Loopback audio capture cancelled:", err);
    }
  }, [attachAudioMeter, stopAudioListening, stopScreenStream]);

  // Dual Two-Laptop / Mobile Call Capture: mixes System Loopback (Zoom/Meet/Teams on Laptop A)
  // + Physical Microphone (Laptop B / Mobile B external speaker audio) with zero feedback echo.
  const startCallAndMicAudio = useCallback(async () => {
    if (!isEngineRunningRef.current || !isConnectedRef.current) {
      return;
    }
    stopAudioListening();
    recognitionWorkingRef.current = false;

    const acquiredStreams: MediaStream[] = [];
    let hasLoopback = false;

    // 1) Try Electron/Browser System Loopback Audio (Zoom / Google Meet / Teams incoming call audio)
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      if (!isEngineRunningRef.current) {
        displayStream.getTracks().forEach((t) => t.stop());
        return;
      }
      screenStreamRef.current = displayStream;
      setHasSharedScreen(true);
      const videoTrack = displayStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => stopScreenStream();
      }
      if (hiddenVideoRef.current) {
        hiddenVideoRef.current.srcObject = displayStream;
        await hiddenVideoRef.current.play().catch(() => {});
      }
      const sysAudioTracks = displayStream.getAudioTracks();
      if (sysAudioTracks.length > 0) {
        acquiredStreams.push(new MediaStream(sysAudioTracks));
        hasLoopback = true;
      }
    } catch (err) {
      console.warn("[Crackpilot Audio] Loopback display capture unavailable, continuing with mic:", err);
    }

    // 2) Also attach Physical Microphone so external Laptop B / Mobile B speaker audio is captured
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (!isEngineRunningRef.current) {
        micStream.getTracks().forEach((t) => t.stop());
        acquiredStreams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
        return;
      }
      void refreshAudioInputDevices();
      acquiredStreams.push(micStream);
      setMicDiagError(null);
    } catch (err) {
      console.warn("[Crackpilot Audio] Mic capture unavailable in dual mode:", err);
      if (!hasLoopback) {
        const errName = err instanceof Error ? err.name : "";
        setMicDiagError(
          errName === "NotAllowedError" ? "Mic Permission Denied" : "Audio Capture Unavailable"
        );
      }
    }

    if (acquiredStreams.length === 0) {
      return;
    }

    // Mix all acquired streams cleanly if both Loopback + Mic succeeded
    let finalStream: MediaStream = acquiredStreams[0];
    if (acquiredStreams.length > 1) {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const mixCtx = new AudioCtx();
        mixAudioCtxRef.current = mixCtx;
        if (mixCtx.state === "suspended") {
          void mixCtx.resume().catch(() => {});
        }
        const dest = mixCtx.createMediaStreamDestination();
        for (const s of acquiredStreams) {
          const src = mixCtx.createMediaStreamSource(s);
          src.connect(dest);
        }
        extraAudioStreamsRef.current = acquiredStreams;
        finalStream = dest.stream;
      } catch {
        extraAudioStreamsRef.current = acquiredStreams.slice(1);
        finalStream = acquiredStreams[0];
      }
    }

    audioStreamRef.current = finalStream;
    isListeningRef.current = true;
    setIsListening(true);
    setListenMode(hasLoopback ? "tab" : "mic");
    setMonitorAudio(true);

    attachAudioMeter(finalStream, false);
  }, [
    attachAudioMeter,
    refreshAudioInputDevices,
    stopAudioListening,
    stopScreenStream,
  ]);

  const startSelectedAudioSource = useCallback(
    async (sourceId: string) => {
      if (sourceId === "call-both") {
        await startCallAndMicAudio();
      } else if (sourceId === "system-loopback") {
        await startTabSystemAudio();
      } else {
        await startMicrophoneAudio(sourceId);
      }
    },
    [startCallAndMicAudio, startMicrophoneAudio, startTabSystemAudio]
  );

  const ensureScreenStream = useCallback(async (): Promise<HTMLVideoElement> => {
    if (
      screenStreamRef.current &&
      screenStreamRef.current.getVideoTracks().some((t) => t.readyState === "live") &&
      hiddenVideoRef.current
    ) {
      return hiddenVideoRef.current;
    }

    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });

    screenStreamRef.current = displayStream;
    setHasSharedScreen(true);

    const videoTrack = displayStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.onended = () => stopScreenStream();
    }

    const audioTracks = displayStream.getAudioTracks();
    if (
      audioTracks.length > 0 &&
      isEngineRunningRef.current &&
      !isListeningRef.current
    ) {
      const audioOnly = new MediaStream(audioTracks);
      audioStreamRef.current = audioOnly;
      isListeningRef.current = true;
      setIsListening(true);
      setListenMode("tab");
      attachAudioMeter(audioOnly, false);
    }

    const videoEl = hiddenVideoRef.current;
    if (!videoEl) throw new Error("Video preview element unavailable.");
    videoEl.srcObject = displayStream;
    await videoEl.play();
    await new Promise((r) => setTimeout(r, 250));
    return videoEl;
  }, [attachAudioMeter, stopScreenStream]);

  const snapshotVideoFrame = (videoEl: HTMLVideoElement): string | null => {
    if (!videoEl.videoWidth || !videoEl.videoHeight) return null;
    const canvas = document.createElement("canvas");
    const maxWidth = 1280;
    const scale = Math.min(1, maxWidth / videoEl.videoWidth);
    canvas.width = Math.round(videoEl.videoWidth * scale);
    canvas.height = Math.round(videoEl.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8).split(",")[1] || null;
  };

  // Capture (Alt+S) or Mobile Companion Screen Tap
  const handleCaptureScreen = useCallback(
    async (captureSource: "alt_s" | "mobile_companion" = "alt_s") => {
      if (
        quotaBlockedReasonRef.current ||
        capturesUsed >= captureLimit ||
        !isConnectedRef.current ||
        glitchActiveRef.current
      ) {
        return;
      }

      try {
        const videoEl = await ensureScreenStream();
        const imageBase64 = snapshotVideoFrame(videoEl);
        if (!imageBase64) {
          throw new Error("Screen frame not ready yet. Please try Alt+S again.");
        }

        setCapturesUsed((c) => Math.min(captureLimit, c + 1));
        setPromptsUsed((c) => Math.min(maxPrompts, c + 1));

        const cur = profileRef.current;
        const isDsa = Boolean(cur.dsaModeEnabled);
        const qaId = `cap-${Date.now()}`;
        setQaList((prev) => [
          {
            id: qaId,
            timestamp: formatNow(),
            question: isDsa
              ? captureSource === "mobile_companion"
                ? `Mobile Companion Screen Tap — Parsing DSA / OA Problem (${normalizeProgrammingLanguage(cur.preferredLanguage)})`
                : `Screen Capture (Alt+S) — Parsing DSA / OA Problem (${normalizeProgrammingLanguage(cur.preferredLanguage)})`
              : "Screen Capture (Alt+S) — Reading Question & Chat Box",
            answer: "",
            engine: isDsa ? "DSA Vision" : "Vision",
            isStreaming: true,
          },
          ...prev,
        ]);
        if (!isAtTopRef.current) {
          setHasUnseenLatest(true);
        }

        await streamAnswerFromEndpoint(qaId, "/api/analyze-screen", {
          token: tokenStateRef.current?.token,
          imageBase64,
          mimeType: "image/jpeg",
          role: cur.role,
          answerLanguage: cur.answerLanguage,
          answerStyle: normalizeAnswerStyle(cur.answerStyle),
          dsaModeEnabled: isDsa,
          preferredLanguage: normalizeProgrammingLanguage(cur.preferredLanguage),
          source: captureSource,
        });
      } catch (err) {
        console.warn("[Crackpilot Overlay] Screen capture cancelled:", err);
      }
    },
    [captureLimit, capturesUsed, ensureScreenStream, maxPrompts, streamAnswerFromEndpoint]
  );

  // Video (Alt+V): 4s / 6s / 8s / 10s multi-frame page question scan
  const handleVideoPageScan = useCallback(async () => {
    if (!isConnectedRef.current || glitchActiveRef.current) {
      return;
    }
    if (videoScanTimerRef.current !== null) return;

    const duration = videoDurationRef.current;

    try {
      const videoEl = await ensureScreenStream();
      capturedVideoFramesRef.current = [];
      setVideoScanCountdown(duration);

      const firstFrame = snapshotVideoFrame(videoEl);
      if (firstFrame) {
        capturedVideoFramesRef.current.push(firstFrame);
      }

      const frameGapMs = duration <= 4 ? 1000 : duration <= 6 ? 1100 : 1350;
      videoFrameIntervalRef.current = window.setInterval(() => {
        if (capturedVideoFramesRef.current.length >= 8) return;
        const frame = snapshotVideoFrame(videoEl);
        if (frame) {
          capturedVideoFramesRef.current.push(frame);
        }
      }, frameGapMs);

      let remaining = duration;
      videoScanTimerRef.current = window.setInterval(() => {
        remaining -= 1;
        setVideoScanCountdown(remaining);

        if (remaining <= 0) {
          if (videoScanTimerRef.current !== null) {
            window.clearInterval(videoScanTimerRef.current);
            videoScanTimerRef.current = null;
          }
          if (videoFrameIntervalRef.current !== null) {
            window.clearInterval(videoFrameIntervalRef.current);
            videoFrameIntervalRef.current = null;
          }

          const lastFrame = snapshotVideoFrame(videoEl);
          if (lastFrame && capturedVideoFramesRef.current.length < 8) {
            capturedVideoFramesRef.current.push(lastFrame);
          }

          const framesToSend = capturedVideoFramesRef.current.splice(0);

          if (framesToSend.length === 0) {
            return;
          }

          setCapturesUsed((c) => Math.min(captureLimit, c + 1));
          setPromptsUsed((c) => Math.min(maxPrompts, c + 1));

          const qaId = `vid-${Date.now()}`;
          setQaList((prev) => [
            {
              id: qaId,
              timestamp: formatNow(),
              question: `Video Page Scan (${duration}s · ${framesToSend.length} frames) — All Page Questions`,
              answer: "",
              engine: "Video AI",
              isStreaming: true,
            },
            ...prev,
          ]);
          if (!isAtTopRef.current) {
            setHasUnseenLatest(true);
          }

          void streamAnswerFromEndpoint(qaId, "/api/analyze-video", {
            token: tokenStateRef.current?.token,
            frames: framesToSend,
            mimeType: "image/jpeg",
            durationSec: duration,
            role: profileRef.current.role,
            answerLanguage: profileRef.current.answerLanguage,
            answerStyle: normalizeAnswerStyle(profileRef.current.answerStyle),
            dsaModeEnabled: Boolean(profileRef.current.dsaModeEnabled),
            preferredLanguage: normalizeProgrammingLanguage(
              profileRef.current.preferredLanguage
            ),
          });
        }
      }, 1000);
    } catch (err) {
      setVideoScanCountdown(0);
      console.warn("[Crackpilot Overlay] Video page scan cancelled:", err);
    }
  }, [captureLimit, ensureScreenStream, maxPrompts, streamAnswerFromEndpoint]);

  // Fast (Alt+X)
  const handleFastTrigger = useCallback(async () => {
    if (!isConnectedRef.current || glitchActiveRef.current) {
      return;
    }

    if (liveTranscriptRef.current || interimTextRef.current || speechPcmRef.current.length > 0) {
      handleAnswerNow(true);
      return;
    }

    if (questionInput.trim()) {
      const text = questionInput.trim();
      setQuestionInput("");
      await askQuestion(text, true);
      return;
    }

    const lastRealQa = qaListRef.current.find((q) => q.id !== "system-init");
    if (lastRealQa && !isListeningRef.current) {
      await askQuestion(lastRealQa.question, true);
      return;
    }

    if (!isListeningRef.current) {
      await startSelectedAudioSource(selectedAudioInputRef.current);
    }
  }, [
    askQuestion,
    handleAnswerNow,
    questionInput,
    startSelectedAudioSource,
  ]);

  // Reconnect (Alt+R) — sync remaining quota & pull the latest live Vercel deployment cleanly
  const handleReconnect = useCallback(async () => {
    if (glitchTimerRef.current !== null) {
      window.clearInterval(glitchTimerRef.current);
      glitchTimerRef.current = null;
    }
    setGlitchCountdown(0);
    setIsReconnecting(true);

    try {
      // Flush any unsynced elapsed seconds before reloading so zero time is lost
      if (tokenStateRef.current?.token) {
        const elapsed = unsyncedSecondsRef.current;
        unsyncedSecondsRef.current = 0;
        if (elapsed > 0) {
          await syncTokenElapsedSeconds(tokenStateRef.current.token, elapsed).catch(
            () => {}
          );
        }
      }
      resetBackendHealthCache();
      setLiveApiError(null);
      if (window.crackpilotDesktop?.reloadLiveApp) {
        await window.crackpilotDesktop.reloadLiveApp();
        return;
      }
      window.location.reload();
    } catch (err) {
      console.error("[Crackpilot Overlay] Reconnect reload failed:", err);
      window.location.reload();
    } finally {
      setIsReconnecting(false);
    }
  }, []);

  // Glitch (4s / 6s / 8s / 10s)
  const handleGlitchTrigger = useCallback(() => {
    if (glitchTimerRef.current !== null) {
      window.clearInterval(glitchTimerRef.current);
      glitchTimerRef.current = null;
    }

    const secs = glitchDurationRef.current;
    if (abortRef.current) abortRef.current.abort();
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }

    setGlitchCountdown(secs);

    let left = secs;
    glitchTimerRef.current = window.setInterval(() => {
      left -= 1;
      setGlitchCountdown(left);

      if (left <= 0) {
        if (glitchTimerRef.current !== null) {
          window.clearInterval(glitchTimerRef.current);
          glitchTimerRef.current = null;
        }
        setIsConnected(true);
        void connectEventStream();
      }
    }, 1000);
  }, [connectEventStream]);

  // Cleanly pause/stop active session & freeze timer (used by Stop button, Minimize, Hide, and OS minimize)
  const pauseEngineSession = useCallback(
    (_notice?: string) => {
      isEngineRunningRef.current = false;
      setIsEngineRunning(false);
      flushElapsedSeconds();

      if (glitchTimerRef.current !== null) {
        window.clearInterval(glitchTimerRef.current);
        glitchTimerRef.current = null;
      }
      if (videoScanTimerRef.current !== null) {
        window.clearInterval(videoScanTimerRef.current);
        videoScanTimerRef.current = null;
      }
      if (videoFrameIntervalRef.current !== null) {
        window.clearInterval(videoFrameIntervalRef.current);
        videoFrameIntervalRef.current = null;
      }
      setGlitchCountdown(0);
      setVideoScanCountdown(0);

      stopAudioListening();

      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      setQaList((prev) =>
        prev.map((q) => {
          if (q.id === "system-init") {
            return {
              ...q,
              question: "Session Paused",
              answer:
                "Timer is stopped. Click Start below to resume your session and capture interviewer audio.",
              engine: "Paused",
              isStreaming: false,
            };
          }
          return q.isStreaming ? { ...q, isStreaming: false } : q;
        })
      );
    },
    [flushElapsedSeconds, stopAudioListening]
  );

  pauseSessionAndTimerRef.current = pauseEngineSession;

  // Master Start / Stop Toggle: starts or cleanly pauses timer, audio capture, live stream, shortcuts, and AI processing
  const handleToggleEngineStartStop = useCallback(async () => {
    if (isEngineRunningRef.current) {
      pauseEngineSession();
      return;
    }

    if (quotaBlockedReasonRef.current) {
      return;
    }

    // Start session & countdown timer immediately
    isEngineRunningRef.current = true;
    setIsEngineRunning(true);
    setIsConnected(true);
    setQaList((prev) =>
      prev.map((q) =>
        q.id === "system-init"
          ? {
              ...q,
              question: "Session Active — Listening for Questions",
              answer:
                "Timer running and audio capture active. Spoken questions appear live in Q and stream answers in A automatically.",
              engine: "Live",
            }
          : q
      )
    );

    try {
      resetBackendHealthCache();
      await connectEventStream(true);
    } catch (err) {
      console.error("[Crackpilot Overlay] Start stream failed:", err);
    }

    if (isEngineRunningRef.current && !isListeningRef.current) {
      await startSelectedAudioSource(selectedAudioInputRef.current);
    }
  }, [connectEventStream, pauseEngineSession, startSelectedAudioSource]);

  // Disconnect (Disconnect button, Cross × icon, or Alt+D) — strictly reset auth state & return to Authenticate Crackpilot screen
  const handleDisconnect = useCallback(() => {
    pauseEngineSession("Session Disconnected.");
    stopScreenStream();
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
    flushElapsedSeconds();
    clearOverlayAuthStorage();
    setIsConnected(false);
    setIsAuthenticated(false);
    setActiveSessionToken(null);
    tokenStateRef.current = null;
    sessionActiveRef.current = false;
    setTokenInput("");
    setAuthError(null);
    setShowLiveQaBench(false);
    setShowContextPanel(false);
    onTokenChange(null);
    void stopLiveSession();
  }, [flushElapsedSeconds, onTokenChange, pauseEngineSession, stopScreenStream]);

  disconnectSessionRef.current = handleDisconnect;

  // Pause timer on minimize/hide AND strictly wipe auth state on beforeunload / window close
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden && isEngineRunningRef.current) {
        pauseEngineSession(
          "Window minimized — timer paused. Click Start to resume."
        );
      }
    };
    const onBeforeUnload = () => {
      flushElapsedSeconds();
      clearOverlayAuthStorage();
      setIsAuthenticated(false);
      setActiveSessionToken(null);
      tokenStateRef.current = null;
      sessionActiveRef.current = false;
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", onBeforeUnload);

    const unsubMin = window.crackpilotDesktop?.onWindowMinimized?.(() => {
      if (isEngineRunningRef.current) {
        pauseEngineSession(
          "Minimized — session and timer paused. Click Start to resume."
        );
      }
    });
    const unsubClose = window.crackpilotDesktop?.onWindowClosing?.(() => {
      disconnectSessionRef.current();
    });

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
      unsubMin?.();
      unsubClose?.();
    };
  }, [flushElapsedSeconds, pauseEngineSession]);

  const handleToggleBehindMode = useCallback(() => {
    const bridge = window.crackpilotDesktop;
    if (bridge?.isElectron && bridge.toggleBehindMode) {
      void bridge
        .toggleBehindMode()
        .then((nextState) => {
          setIsBehindMode(Boolean(nextState));
        })
        .catch((err) => {
          console.error("[Crackpilot Overlay] toggleBehindMode IPC failed:", err);
        });
      return;
    }

    // Graceful web preview fallback outside Electron
    setIsBehindMode((prev) => !prev);
  }, []);

  // Sync Behind (Alt+M) state from Electron globalShortcut IPC events
  useEffect(() => {
    const bridge = window.crackpilotDesktop;
    if (!bridge?.isElectron) return;
    if (bridge.getBehindMode) {
      void bridge
        .getBehindMode()
        .then((enabled) => setIsBehindMode(Boolean(enabled)))
        .catch(() => {});
    }
    const unsubBehind = bridge.onBehindModeChanged?.((enabled) => {
      setIsBehindMode(Boolean(enabled));
    });
    return () => {
      unsubBehind?.();
    };
  }, []);

  const handleFontIncreaseCycle = useCallback(() => {
    setFontSizePx((prev) => (prev >= 26 ? 12 : prev + 2));
  }, []);

  const handleToggleAutoScroll = useCallback((forceOn?: boolean) => {
    setAutoScroll((prev) => {
      const next = typeof forceOn === "boolean" ? forceOn : !prev;
      if (next && feedRef.current) {
        feedRef.current.scrollTo({
          top: 0,
          behavior: "smooth",
        });
        isAtTopRef.current = true;
        setShowJumpToTop(false);
        setHasUnseenLatest(false);
      }
      return next;
    });
  }, []);

  // All keyboard shortcuts active when session is live (AI triggers gated by Start/Stop toggle)
  useEffect(() => {
    if (!isSessionLive) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      if (e.ctrlKey && !e.altKey && key === "t") {
        e.preventDefault();
        handleToggleAutoScroll(true);
        return;
      }

      if (!e.altKey) return;

      // === TEMPORARILY COMMENTED OUT: Alt+H shortcut (uncomment when requested) ===
      // if (key === "h") {
      //   e.preventDefault();
      //   if (window.crackpilotDesktop?.isElectron) {
      //     void window.crackpilotDesktop.hideWindow();
      //   } else {
      //     setIsHidden((h) => !h);
      //   }
      //   return;
      // }
      // ============================================================================

      if (key === "m" && !window.crackpilotDesktop?.isElectron) {
        e.preventDefault();
        handleToggleBehindMode();
        return;
      }

      if (key === "f") {
        e.preventDefault();
        handleFontIncreaseCycle();
        return;
      }

      if (key === "d") {
        e.preventDefault();
        handleDisconnect();
        return;
      }

      if (!isEngineRunningRef.current) {
        if (key === "x" || key === "s" || key === "v" || key === "r" || key === "t") {
          e.preventDefault();
        }
        return;
      }

      if (key === "t") {
        e.preventDefault();
        handleToggleAutoScroll();
      } else if (key === "x") {
        e.preventDefault();
        void handleFastTrigger();
      } else if (key === "s") {
        e.preventDefault();
        void handleCaptureScreen();
      } else if (key === "v") {
        e.preventDefault();
        void handleVideoPageScan();
      } else if (key === "r") {
        e.preventDefault();
        void handleReconnect();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    isSessionLive,
    handleCaptureScreen,
    handleDisconnect,
    handleFastTrigger,
    handleFontIncreaseCycle,
    handleReconnect,
    handleToggleAutoScroll,
    handleToggleBehindMode,
    handleVideoPageScan,
  ]);

  useEffect(() => {
    return () => {
      stopAudioListening();
      stopScreenStream();
      sseRef.current?.close();
      abortRef.current?.abort();
      if (glitchTimerRef.current !== null) {
        window.clearInterval(glitchTimerRef.current);
      }
      window.speechSynthesis?.cancel();
    };
  }, [stopAudioListening, stopScreenStream]);

  const handleCopyCard = useCallback((item: QAItem) => {
    try {
      const content =
        item.id === "system-init"
          ? `${item.question}\n${item.answer}`
          : item.answer || item.question;
      void navigator.clipboard.writeText(content).then(() => {
        setCopiedId(item.id);
        window.setTimeout(() => {
          setCopiedId((cur) => (cur === item.id ? null : cur));
        }, 1500);
      });
    } catch {
      // Ignore clipboard failures in restricted iframes
    }
  }, []);

  const handleSpeakCard = useCallback((item: QAItem) => {
    try {
      if (!("speechSynthesis" in window) || !item.answer) return;
      setSpeakingId((prevId) => {
        if (prevId === item.id) {
          window.speechSynthesis.cancel();
          return null;
        }
        window.speechSynthesis.cancel();
        const plain = item.answer
          .replace(/```[\s\S]*?```/g, "")
          .replace(/[#*`]/g, "")
          .trim();
        const utter = new SpeechSynthesisUtterance(plain);
        utter.lang =
          profileRef.current.answerLanguage === "Hindi" ? "hi-IN" : "en-IN";
        utter.onend = () => setSpeakingId(null);
        utter.onerror = () => setSpeakingId(null);
        window.speechSynthesis.speak(utter);
        return item.id;
      });
    } catch {
      setSpeakingId(null);
    }
  }, []);

  const handleSendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionInput.trim()) return;
    const text = questionInput.trim();
    setQuestionInput("");
    void askQuestion(text, false, true);
  };

  const updateInlineProfile = (patch: Partial<TargetProfile>) => {
    const next = { ...profile, ...patch };
    onProfileChange(next);
    void saveTargetProfile(next);
  };

  const questionFontPx = Math.min(30, fontSizePx + 1);

  // Hidden state (only allowed after authentication; never hide the Authenticate Crackpilot screen)
  if (isHidden && isSessionLive) {
    return (
      <div className="min-h-screen bg-[#070c16] flex items-end justify-end p-5">
        <button
          type="button"
          onClick={() => setIsHidden(false)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700/70 bg-[#0d1424]/90 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Eye className="h-3.5 w-3.5 text-sky-400" />
          <span>Show Crackpilot (Alt+H)</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`h-screen w-screen overflow-hidden flex items-center justify-center ${
        desktopMode
          ? "bg-transparent p-0"
          : "bg-gradient-to-br from-[#0a1322] via-[#13263f] to-[#0b1526] p-2 sm:p-4"
      } ${isResizing ? "select-none cursor-ew-resize" : ""}`}
    >
      <video ref={hiddenVideoRef} className="hidden" muted playsInline />

      {/* Rock-Solid Viewport-Locked Overlay Window */}
      <div
        style={
          desktopMode || isMaximized
            ? undefined
            : { width: `min(100%, ${hudWidthPx}px)` }
        }
        className={`relative flex flex-col overflow-hidden rounded-xl border ${
          isBehindMode ? "border-[#b4f416]/60" : "border-slate-500/35"
        } shadow-2xl transition-colors ${
          desktopMode ? "" : "backdrop-blur-md"
        } ${DEFAULT_OVERLAY_BG} ${
          desktopMode
            ? "h-full w-full"
            : isMaximized
              ? "h-full w-full"
              : isCompact
                ? "h-[460px] max-h-full"
                : "h-full max-h-[860px]"
        }`}
      >
        {/* Left & Right Drag-to-Resize Width Handles */}
        {!desktopMode && (
          <>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize window width from left edge"
              onMouseDown={(e) => startWidthResize("left", e.clientX)}
              title="Drag to adjust width"
              className="absolute inset-y-0 left-0 z-20 w-2 cursor-ew-resize hover:bg-sky-400/25 transition-colors"
            />
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize window width from right edge"
              onMouseDown={(e) => startWidthResize("right", e.clientX)}
              title="Drag to adjust width"
              className="absolute inset-y-0 right-0 z-20 w-2 cursor-ew-resize hover:bg-sky-400/25 transition-colors"
            />
          </>
        )}

        {/* Fixed-Height Top Header (shrink-0 h-11, never wraps) */}
        <header className="relative z-30 flex h-11 shrink-0 items-center justify-between gap-2 overflow-hidden whitespace-nowrap border-b border-slate-700/60 bg-[#0d1220]/95 px-3">
          {/* Left Brand + Drag Zone */}
          <div className="app-drag flex flex-1 h-full items-center gap-2.5 min-w-0 pl-1">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-[#405fe8] text-[11px] font-bold text-white shrink-0">
              C
            </span>
            <span className="text-xs font-semibold tracking-tight text-slate-100 whitespace-nowrap shrink-0">
              Crackpilot
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-slate-800/90 border border-slate-700/70 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#b4f416] whitespace-nowrap shrink-0">
              <span>v1.0.7</span>
              <span className="text-slate-500">•</span>
              <span className="text-emerald-300 font-normal">live</span>
            </span>
            {profile.dsaModeEnabled && (
              <span className="hidden sm:inline-flex items-center gap-1 rounded border border-[#b4f416]/50 bg-[#b4f416]/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#b4f416] whitespace-nowrap">
                <Code2 className="h-3 w-3" />
                <span>
                  DSA · {normalizeProgrammingLanguage(profile.preferredLanguage)}
                </span>
              </span>
            )}
          </div>

          {/* Center: Classic "..." Handle + Live A/B Engine Toggle (Siblings outside app-drag) */}
          <div className="app-no-drag relative z-30 flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowContextPanel((v) => !v)}
              title="Width, Server URL, Target Profile & Quick Test Settings"
              className={`app-no-drag rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                showContextPanel
                  ? "bg-slate-700/80 text-sky-300"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              }`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {isSessionLive && (
              <button
                type="button"
                onClick={() => setShowLiveQaBench((v) => !v)}
                title="Dual-Pipeline Ultra-Low-Latency Live Audio Q&A (Deepgram+Groq vs Gemini Live)"
                className={`app-no-drag inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                  showLiveQaBench
                    ? "border-[#c6f527]/60 bg-[#1a2610] text-[#c6f527]"
                    : "border-slate-700/80 bg-slate-800/70 text-slate-300 hover:text-white"
                }`}
              >
                <Zap className="h-3 w-3 text-[#c6f527]" />
                <span>Live A/B</span>
              </button>
            )}
          </div>

          {/* Right Drag Spacer */}
          <div className="app-drag flex-1 h-full" />

          {/* Right: Float on Top (PiP) + Window Controls (— □ ×) — Sibling outside app-drag */}
          <div className="app-no-drag relative z-30 flex items-center gap-1 shrink-0 text-slate-400">
            {!desktopMode && (
              <button
                type="button"
                onClick={() => void handlePopOutFloatingWindow()}
                title="Float Always On Top Across Tabs"
                className="app-no-drag rounded p-1.5 hover:bg-slate-800 hover:text-sky-300 transition-colors cursor-pointer"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={handleMinimizeWindow}
              title="Minimize window & pause timer"
              className="app-no-drag rounded p-1.5 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleToggleMaximize}
              title="Maximize / Restore"
              className="app-no-drag rounded p-1.5 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            >
              <Square className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={handleCloseAndDisconnect}
              title="Close & Disconnect Session"
              className="app-no-drag rounded p-1.5 hover:bg-rose-500/80 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>

        {/* Collapsible "..." Settings Drawer */}
        {showContextPanel && (
          <div className="shrink-0 border-b border-slate-700/70 bg-[#0d1424]/95 px-4 py-3 text-xs text-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-medium text-slate-400">
                  Width: <strong className="text-sky-300">{hudWidthPx}px</strong>
                </span>
                <input
                  type="range"
                  min={480}
                  max={1400}
                  step={20}
                  value={hudWidthPx}
                  onChange={(e) => {
                    setIsMaximized(false);
                    setHudWidthPx(Number(e.target.value));
                  }}
                  className="w-36 accent-sky-400 cursor-pointer"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={profile.answerLanguage}
                  onChange={(e) =>
                    updateInlineProfile({
                      answerLanguage: e.target.value as AnswerLanguage,
                    })
                  }
                  className="rounded-md border border-slate-700 bg-[#131d33] px-2.5 py-1 text-xs text-slate-100"
                >
                  <option value="English">English</option>
                  <option value="Hinglish">Hinglish</option>
                  <option value="Hindi">हिन्दी (Hindi)</option>
                </select>

                <select
                  value={normalizeAnswerStyle(profile.answerStyle)}
                  onChange={(e) =>
                    updateInlineProfile({
                      answerStyle: e.target.value as AnswerStyle,
                    })
                  }
                  className="rounded-md border border-slate-700 bg-[#131d33] px-2.5 py-1 text-xs text-slate-100"
                >
                  {ANSWER_STYLES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() =>
                    updateInlineProfile({
                      dsaModeEnabled: !profile.dsaModeEnabled,
                      preferredLanguage: normalizeProgrammingLanguage(
                        profile.preferredLanguage
                      ),
                    })
                  }
                  className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                    profile.dsaModeEnabled
                      ? "border-[#b4f416]/60 bg-[#b4f416]/15 text-[#b4f416]"
                      : "border-slate-700 bg-[#131d33] text-slate-300 hover:text-white"
                  }`}
                >
                  <Code2 className="h-3.5 w-3.5" />
                  <span>DSA: {profile.dsaModeEnabled ? "ON" : "OFF"}</span>
                </button>

                {profile.dsaModeEnabled && (
                  <select
                    value={normalizeProgrammingLanguage(profile.preferredLanguage)}
                    onChange={(e) =>
                      updateInlineProfile({
                        preferredLanguage: e.target.value as ProgrammingLanguage,
                      })
                    }
                    className="rounded-md border border-[#b4f416]/45 bg-[#131d33] px-2 py-1 text-xs font-semibold text-[#b4f416]"
                  >
                    {PROGRAMMING_LANGUAGES.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  type="button"
                  onClick={onGoDashboard}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-sky-300 hover:bg-slate-700 cursor-pointer"
                >
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  <span>Dashboard</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
              <span>
                Target Role: <strong className="text-slate-200">{profile.role}</strong> ·{" "}
                Resume:{" "}
                <strong className={profile.resumeText ? "text-emerald-400" : "text-amber-300"}>
                  {profile.resumeText ? profile.resumeFileName || "Loaded" : "Not uploaded"}
                </strong>{" "}
                · JD:{" "}
                <strong className={profile.jdText ? "text-emerald-400" : "text-amber-300"}>
                  {profile.jdText ? profile.jdFileName || "Loaded" : "Not uploaded"}
                </strong>
              </span>
            </div>

            {desktopMode && (
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 pt-2.5">
                <span className="text-[11px] font-medium text-slate-400 shrink-0">
                  AI Server URL:
                </span>
                <input
                  type="text"
                  value={backendUrlInput}
                  onChange={(e) => setBackendUrlInput(e.target.value)}
                  placeholder="http://localhost:3000 or https://your-api.com (optional)"
                  className="flex-1 min-w-[200px] rounded-md border border-slate-700 bg-[#090e1a] px-2.5 py-1 font-mono text-[11px] text-sky-300 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const saved = setApiBaseUrl(backendUrlInput);
                      setBackendUrlInput(saved);
                      resetBackendHealthCache();
                      setBackendSaveNotice(
                        saved
                          ? `Saved backend: ${saved}`
                          : "Cleared — standalone local mode active."
                      );
                      void connectEventStream(true);
                      setTimeout(() => setBackendSaveNotice(null), 2500);
                    } catch (err) {
                      setBackendSaveNotice(
                        err instanceof Error ? err.message : "Invalid URL."
                      );
                    }
                  }}
                  className="rounded-md bg-[#405fe8] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#3552d6] cursor-pointer"
                >
                  Save URL
                </button>
                {backendSaveNotice && (
                  <span className="text-[11px] text-emerald-300">
                    {backendSaveNotice}
                  </span>
                )}
              </div>
            )}

            {isSessionLive && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-slate-400 mr-1">
                  Quick Test:
                </span>
                {SAMPLE_INTERVIEW_QUESTIONS.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => {
                      setShowContextPanel(false);
                      void askQuestion(q.text);
                    }}
                    className="rounded border border-slate-700/80 bg-[#141f36] px-2 py-0.5 text-[11px] text-slate-200 hover:border-sky-400/60 hover:text-white transition-colors cursor-pointer"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Dual-Pipeline Ultra-Low-Latency Live Audio Q&A Panel (Strictly gated behind authentication) */}
        {isSessionLive && showLiveQaBench && (
          <div className="shrink-0 max-h-[75vh] overflow-y-auto hud-scroll border-b border-slate-700/70 bg-[#080d17]/98 p-3">
            <LiveAudioQAEngine compact />
          </div>
        )}

        {/* MANDATORY AUTHENTICATION GATE: Block main Q&A workspace and control bar until isAuthenticated === true */}
        {!isSessionLive ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <form
              onSubmit={handleVerifyToken}
              className="w-full max-w-md rounded-xl border border-slate-700/70 bg-[#0d1424]/95 p-6 space-y-5 shadow-2xl"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#405fe8]/20 border border-[#405fe8]/40 text-sky-400">
                  <KeyRound className="h-5 w-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-white">
                      Authenticate Crackpilot
                    </h2>
                    <span className="inline-flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-[#b4f416]">
                      <span>v1.0.7</span>
                      <span className="text-slate-500">•</span>
                      <span className="text-emerald-300">live</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Copy the Generated Token from Dashboard → Overview and paste
                    it below.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Session Token Key
                </label>
                <input
                  type="text"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="CP-XXXXXX-XXXXXX-XXXX"
                  className="w-full rounded-lg border border-slate-700 bg-[#090e1a] px-3.5 py-2.5 font-mono text-sm text-sky-300 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                />
              </div>

              {authError && (
                <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                  {authError}
                </p>
              )}

              <button
                type="submit"
                disabled={verifyingToken}
                className="w-full rounded-lg bg-[#405fe8] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#3552d6] transition-colors cursor-pointer disabled:opacity-60"
              >
                {verifyingToken ? "Authenticating..." : "Authenticate Software"}
              </button>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">Need a token?</span>
                <button
                  type="button"
                  onClick={onGoDashboard}
                  className="font-medium text-sky-400 hover:text-sky-300 cursor-pointer"
                >
                  Open Dashboard → Overview
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* ACTIVE LIVE HUD OVERLAY — Opens directly after token auth (Timer PAUSED, Monitor OFF until Start) */
          <>
            {/* Isolated Middle Q&A Scroll Container (Zero Notification Banners + Zero Intermediate Listening Cards) */}
            <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
              {showJumpToTop && (
                <button
                  type="button"
                  onClick={jumpToLatestTop}
                  className={`absolute top-3 right-5 z-20 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-xl backdrop-blur-md transition-colors cursor-pointer ${
                    hasUnseenLatest
                      ? "border-[#b4f416]/70 bg-[#b4f416] text-slate-950 hover:bg-[#c8ff3d]"
                      : "border-sky-400/50 bg-[#0f192d]/95 text-sky-100 hover:bg-[#162440]"
                  }`}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                  <span>{hasUnseenLatest ? "New Answer · Jump to Top" : "Latest Answer"}</span>
                </button>
              )}

              <div
                ref={feedRef}
                onScroll={handleFeedScroll}
                style={{ overflowAnchor: "none" }}
                className="hud-scroll flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 pb-8 space-y-3"
              >
                {/* Memoized Q&A Cards in Newest-First (Reverse Chronological) Order */}
                {qaList.map((item) => (
                  <QACardItem
                    key={item.id}
                    item={item}
                    fontSizePx={fontSizePx}
                    questionFontPx={questionFontPx}
                    dsaModeEnabled={Boolean(profile.dsaModeEnabled)}
                    isCopied={copiedId === item.id}
                    isSpeaking={speakingId === item.id}
                    onCopy={handleCopyCard}
                    onSpeak={handleSpeakCard}
                  />
                ))}
              </div>
            </div>

            {/* Bottom Docked Input + Telemetry Strip + 2-Row HUD Controls */}
            <div className="relative shrink-0 border-t border-slate-600/35 bg-[#101c30]/75 px-4 pt-3 pb-3.5 space-y-2.5">
              {/* Custom Font Size Popover */}
              {showFontPopover && (
                <div className="absolute bottom-24 right-4 z-30 w-64 rounded-xl border border-slate-600/70 bg-[#0d1424]/98 p-3.5 shadow-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-100">
                      Q&amp;A Font Size
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-sky-300">
                        {fontSizePx}px
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowFontPopover(false)}
                        className="text-slate-400 hover:text-white cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setFontSizePx((v) => Math.max(12, v - 1))
                      }
                      className="rounded-md bg-slate-800 p-1.5 text-slate-200 hover:bg-slate-700 cursor-pointer"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <input
                      type="range"
                      min={12}
                      max={28}
                      step={1}
                      value={fontSizePx}
                      onChange={(e) => setFontSizePx(Number(e.target.value))}
                      className="flex-1 accent-sky-400 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setFontSizePx((v) => Math.min(28, v + 1))
                      }
                      className="rounded-md bg-slate-800 p-1.5 text-slate-200 hover:bg-slate-700 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Tip: Press Alt+F anytime to step font size up quickly.
                  </p>
                </div>
              )}

              {/* Persistent Active DSA Problem Context Pill (No Re-Capture Needed for Follow-Ups) */}
              {profile.dsaModeEnabled && activeProblemContext && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#b4f416]/40 bg-[#141c0b] px-3 py-1.5 text-[11px]">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="inline-flex items-center gap-1 rounded bg-[#b4f416] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#0a0a0a]">
                      <Code2 className="h-3 w-3" />
                      ACTIVE PROBLEM
                    </span>
                    <span className="truncate font-semibold text-white">
                      {activeProblemContext.title}
                    </span>
                    <span className="font-mono text-[10px] text-[#b4f416]">
                      {activeProblemContext.topicPattern} ·{" "}
                      {normalizeProgrammingLanguage(profile.preferredLanguage)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveProblemContext(null);
                      activeProblemContextRef.current = null;
                      void clearActiveProblemContextClient();
                    }}
                    className="inline-flex items-center gap-1 rounded border border-white/10 bg-black/40 px-2 py-0.5 text-[10px] font-medium text-zinc-300 hover:border-rose-400/40 hover:text-rose-200 cursor-pointer shrink-0"
                  >
                    <X className="h-3 w-3" />
                    <span>Clear</span>
                  </button>
                </div>
              )}

              {/* Input Row */}
              <form
                onSubmit={handleSendSubmit}
                className="flex items-center gap-2.5"
              >
                <input
                  type="text"
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  placeholder={
                    profile.dsaModeEnabled && activeProblemContext
                      ? `Ask follow-up on "${activeProblemContext.title}" (e.g., optimize to O(1) space)...`
                      : "Type question here..."
                  }
                  className="flex-1 rounded-lg border border-slate-500/40 bg-[#1a2940]/85 px-3.5 py-2.5 text-sm text-white placeholder-slate-400 focus:border-sky-400/70 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!questionInput.trim()}
                  className="shrink-0 rounded-lg bg-[#5b74d8] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4e67cc] transition-colors disabled:opacity-45 cursor-pointer"
                >
                  Send
                </button>
              </form>

              {quotaBlockedReason && (
                <div className="rounded-lg border border-rose-500/45 bg-rose-950/75 px-3.5 py-2 text-xs text-rose-200 flex items-center justify-between gap-2">
                  <span>{quotaBlockedReason}</span>
                  <button
                    type="button"
                    onClick={() => void handleReconnect()}
                    className="shrink-0 rounded bg-rose-500/25 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-500/40 cursor-pointer"
                  >
                    Sync Quota (Alt+R)
                  </button>
                </div>
              )}

              {/* Compact Status Line */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
                <div className="flex flex-wrap items-center gap-2.5">
                  <SessionTimerDisplay
                    initialSeconds={timerBaseSeconds}
                    syncVersion={timerSyncVersion}
                    isRunning={
                      isSessionLive &&
                      isConnected &&
                      isSessionRunning &&
                      !isHidden &&
                      glitchCountdown === 0
                    }
                    isEngineRunning={isEngineRunning}
                    unsyncedSecondsRef={unsyncedSecondsRef}
                    onTimeExhausted={handleTimeExhausted}
                  />
                  <span className="text-slate-500">·</span>
                  <span className="tabular-nums">
                    Captures:{" "}
                    <strong className="font-semibold text-white">
                      {capturesUsed}/{captureLimit}
                    </strong>
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className="tabular-nums">
                    Prompts:{" "}
                    <strong className="font-semibold text-white">
                      {promptsUsed}/{maxPrompts}
                    </strong>
                  </span>

                  {/* Real-Time Diagnostic Indicator (replaces legacy file:///api URL) */}
                  {(() => {
                    const activeDiagError =
                      micDiagError || liveApiError || serverDiag.error;
                    const isHealthy =
                      !activeDiagError &&
                      serverDiag.checked &&
                      serverDiag.reachable &&
                      serverDiag.llmReady &&
                      serverDiag.sttReady;
                    const readyLabel =
                      serverDiag.groq && serverDiag.deepgram
                        ? "Connected: Vercel + Mic Ready (Groq/Deepgram)"
                        : "Connected: Vercel + Mic Ready";
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          setLiveApiError(null);
                          void checkServerDiagnostics();
                        }}
                        title={`Server: ${serverDisplayUrl} — Click to re-check Mic & Server diagnostics`}
                        className={`inline-flex max-w-[260px] items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                          activeDiagError
                            ? "border-rose-500/60 bg-rose-950/60 text-rose-200 hover:border-rose-400"
                            : isHealthy
                              ? "border-emerald-500/50 bg-emerald-950/45 text-emerald-300 hover:border-emerald-400"
                              : "border-slate-700/80 bg-[#0c1424]/90 text-slate-300 hover:border-sky-400/50"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            activeDiagError
                              ? "bg-rose-400 animate-pulse"
                              : isHealthy
                                ? "bg-[#b4f416]"
                                : "bg-amber-400 animate-pulse"
                          }`}
                        />
                        <span className="truncate">
                          {activeDiagError
                            ? activeDiagError
                            : isHealthy
                              ? readyLabel
                              : "Checking Server..."}
                        </span>
                      </button>
                    );
                  })()}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Explicit Audio Source Switcher: Call + Mic (Zoom/Meet Loopback + Mic), Microphone, or System / Tab Audio */}
                  <div className="inline-flex items-center overflow-hidden rounded-md border border-slate-700/80 bg-[#0c1424]/90 p-0.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAudioInput("call-both");
                        selectedAudioInputRef.current = "call-both";
                        if (isEngineRunningRef.current) {
                          void startSelectedAudioSource("call-both");
                        }
                      }}
                      title="Capture both Zoom/Meet/Teams System Loopback Audio AND Physical Microphone (best for 2-laptop / mobile calls)"
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-medium transition-colors cursor-pointer ${
                        selectedAudioInput === "call-both"
                          ? "bg-[#b4f416]/20 text-[#d9ff66]"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Headphones className="h-3 w-3" />
                      <span>Call + Mic</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const targetMic =
                          selectedAudioInput === "system-loopback" ||
                          selectedAudioInput === "call-both"
                            ? "default"
                            : selectedAudioInput;
                        setSelectedAudioInput(targetMic);
                        selectedAudioInputRef.current = targetMic;
                        if (isEngineRunningRef.current) {
                          void startSelectedAudioSource(targetMic);
                        }
                      }}
                      title="Use Physical Microphone only (for external Laptop B / Mobile B speaker audio)"
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-medium transition-colors cursor-pointer ${
                        selectedAudioInput !== "system-loopback" &&
                        selectedAudioInput !== "call-both"
                          ? "bg-[#b4f416]/20 text-[#d9ff66]"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Mic className="h-3 w-3" />
                      <span>Mic</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAudioInput("system-loopback");
                        selectedAudioInputRef.current = "system-loopback";
                        if (isEngineRunningRef.current) {
                          void startSelectedAudioSource("system-loopback");
                        }
                      }}
                      title="Capture Zoom / Google Meet / Teams System Loopback Audio only"
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-medium transition-colors cursor-pointer ${
                        selectedAudioInput === "system-loopback"
                          ? "bg-sky-500/25 text-sky-200"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Headphones className="h-3 w-3" />
                      <span>System</span>
                    </button>
                  </div>

                  {/* Live Mic / Audio Level Meter + Hardware Mic Selector */}
                  <div className="inline-flex items-center gap-2 rounded-md border border-slate-700/80 bg-[#0c1424]/90 px-2 py-0.5">
                    <AudioLevelMeter
                      analyserRef={analyserRef}
                      audioCtxRef={audioCtxRef}
                      isListening={isListening}
                      label={
                        isListening
                          ? selectedAudioInput === "call-both"
                            ? "Call + Mic Live"
                            : listenMode === "tab"
                              ? "Loopback Live"
                              : "Mic Live"
                          : "Audio Standby"
                      }
                    />
                    {selectedAudioInput !== "system-loopback" &&
                      selectedAudioInput !== "call-both" && (
                        <select
                          aria-label="Select Microphone Input Device"
                          value={selectedAudioInput}
                          onChange={(e) => {
                            const nextId = e.target.value;
                            setSelectedAudioInput(nextId);
                            selectedAudioInputRef.current = nextId;
                            if (isEngineRunningRef.current) {
                              void startSelectedAudioSource(nextId);
                            }
                          }}
                          className="max-w-[140px] truncate bg-transparent text-[11px] text-slate-200 focus:outline-none cursor-pointer"
                        >
                          <option value="default" className="bg-[#0d1424] text-slate-100">
                            Default Mic
                          </option>
                          {audioInputs.map((dev) => (
                            <option
                              key={dev.deviceId}
                              value={dev.deviceId}
                              className="bg-[#0d1424] text-slate-100"
                            >
                              {dev.label}
                            </option>
                          ))}
                        </select>
                      )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setMonitorAudio((v) => !v)}
                    title="Hear captured audio through speakers/headphones"
                    className="inline-flex items-center gap-1 text-[11px] text-slate-300 hover:text-white cursor-pointer"
                  >
                    {monitorAudio ? (
                      <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <VolumeX className="h-3.5 w-3.5 text-slate-400" />
                    )}
                    <span>Monitor: {monitorAudio ? "ON" : "OFF"}</span>
                  </button>
                </div>
              </div>

              {/* Row 1 Control Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Single Master Start / Stop Toggle Button (exact same position) */}
                <button
                  type="button"
                  onClick={() => void handleToggleEngineStartStop()}
                  title={
                    isEngineRunning
                      ? "Stop audio listening, live stream, and AI processing"
                      : "Start audio listening, live stream, shortcuts, and AI processing"
                  }
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-bold transition-colors cursor-pointer min-w-[88px] justify-center ${
                    isEngineRunning
                      ? "bg-rose-600 text-white hover:bg-rose-500 shadow-sm shadow-rose-950/60"
                      : "bg-[#c6f527] text-[#050709] hover:bg-[#b5e41c] shadow-sm shadow-[#c6f527]/25"
                  }`}
                >
                  {isEngineRunning ? (
                    <>
                      <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                      <Square className="h-3 w-3 fill-current" />
                      <span>Stop</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>Start</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleAutoScroll()}
                  title="Auto-Scroll ON/OFF (Alt+T / Ctrl+T)"
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    autoScroll
                      ? "border-slate-500/40 bg-[#1c2640]/95 text-sky-300"
                      : "border-slate-700/80 bg-[#141c30]/85 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <ScrollText className="h-3.5 w-3.5" />
                  <span>Scroll: {autoScroll ? "ON" : "OFF"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleFastTrigger()}
                  title="Fast 3-bullet answer (Alt+X)"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#2fa877] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#279367] transition-colors cursor-pointer"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>Fast (Alt+X)</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleCaptureScreen("alt_s")}
                  title="Capture screen / chat box / DSA problem (Alt+S)"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#405fe8] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#3552d6] transition-colors cursor-pointer"
                >
                  <Camera className="h-3.5 w-3.5" />
                  <span>
                    {hasSharedScreen ? "Capture (Alt+S)" : "Capture (Alt+S)"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleCaptureScreen("mobile_companion")}
                  title="Mobile Companion Screen Tap — capture & parse visible problem"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/50 bg-[#1f293f]/95 px-2.5 py-1.5 text-xs font-medium text-slate-100 hover:border-[#b4f416]/50 hover:text-[#b4f416] transition-colors cursor-pointer"
                >
                  <Smartphone className="h-3.5 w-3.5 text-[#b4f416]" />
                  <span>Screen</span>
                </button>

                {/* Video 4s / 6s / 8s / 10s Page Scan */}
                <div className="inline-flex items-center overflow-hidden rounded-lg border border-slate-600/50 bg-[#1f293f]/95">
                  <button
                    type="button"
                    onClick={() => void handleVideoPageScan()}
                    disabled={videoScanCountdown > 0}
                    title="Record timed screen video across page to solve all questions (Alt+V)"
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      videoScanCountdown > 0
                        ? "bg-sky-600 text-white"
                        : "text-slate-100 hover:bg-slate-700/70"
                    }`}
                  >
                    <Video className="h-3.5 w-3.5 text-sky-300" />
                    <span>
                      {videoScanCountdown > 0
                        ? `Scanning ${videoScanCountdown}s`
                        : "Video"}
                    </span>
                  </button>
                  <select
                    aria-label="Video scan duration"
                    value={videoDurationSec}
                    onChange={(e) => setVideoDurationSec(Number(e.target.value))}
                    className="border-l border-slate-600/60 bg-[#162036] px-2 py-1.5 text-xs font-medium text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value={4}>4s</option>
                    <option value={6}>6s</option>
                    <option value={8}>8s</option>
                    <option value={10}>10s</option>
                  </select>
                </div>

                {/* Reconnect (Alt+R) */}
                <button
                  type="button"
                  onClick={() => void handleReconnect()}
                  title="Instant Reconnect (Alt+R)"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/50 bg-[#1f293f]/95 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700/70 transition-colors cursor-pointer"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 text-sky-300 ${
                      isReconnecting ? "animate-spin" : ""
                    }`}
                  />
                  <span>Reconnect</span>
                </button>
              </div>

              {/* Row 2 Control Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Glitch (4s / 6s / 8s / 10s timed offline pause) */}
                <div className="inline-flex items-center overflow-hidden rounded-lg border border-slate-600/50 bg-[#1f293f]/95">
                  <button
                    type="button"
                    onClick={handleGlitchTrigger}
                    title="Pause internet/stream for selected seconds, then auto-restore"
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      glitchCountdown > 0
                        ? "bg-amber-600 text-white"
                        : "text-slate-200 hover:bg-slate-700/70"
                    }`}
                  >
                    <WifiOff className="h-3.5 w-3.5 text-amber-300" />
                    <span>
                      {glitchCountdown > 0
                        ? `Offline ${glitchCountdown}s`
                        : "Glitch"}
                    </span>
                  </button>
                  <select
                    aria-label="Glitch offline duration"
                    value={glitchDurationSec}
                    onChange={(e) =>
                      setGlitchDurationSec(Number(e.target.value))
                    }
                    className="border-l border-slate-600/60 bg-[#162036] px-2 py-1.5 text-xs font-medium text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value={4}>4s</option>
                    <option value={6}>6s</option>
                    <option value={8}>8s</option>
                    <option value={10}>10s</option>
                  </select>
                </div>

                {/* Hide (pauses timer & hides overlay) */}
                <button
                  type="button"
                  onClick={() => {
                    pauseEngineSession(
                      "Overlay hidden — timer paused. Click Start to resume."
                    );
                    if (window.crackpilotDesktop?.isElectron) {
                      void window.crackpilotDesktop.hideWindow();
                    } else {
                      setIsHidden(true);
                    }
                  }}
                  title="Hide Software & pause timer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/50 bg-[#1f293f]/95 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700/70 transition-colors cursor-pointer"
                >
                  <EyeOff className="h-3.5 w-3.5 text-slate-300" />
                  <span>Hide</span>
                </button>

                {/* Behind / Write (Alt+M) Click-Through Mode Toggle with Smart Hover Restore */}
                <button
                  type="button"
                  onClick={handleToggleBehindMode}
                  onMouseEnter={() => {
                    if (isBehindMode && window.crackpilotDesktop?.setBehindHoverInteractive) {
                      void window.crackpilotDesktop
                        .setBehindHoverInteractive(true)
                        .catch(() => {});
                    }
                  }}
                  onMouseLeave={() => {
                    if (isBehindMode && window.crackpilotDesktop?.setBehindHoverInteractive) {
                      void window.crackpilotDesktop
                        .setBehindHoverInteractive(false)
                        .catch(() => {});
                    }
                  }}
                  aria-pressed={isBehindMode}
                  title={
                    isBehindMode
                      ? "Click-through active: clicks & typing pass to the window behind Crackpilot. Click this button or press Alt+M to turn OFF."
                      : "Enable Behind / Write Mode (Alt+M): keep overlay visible on top while clicking & typing directly behind it."
                  }
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                    isBehindMode
                      ? "border-[#b4f416] bg-[#b4f416]/15 text-[#d9ff66] shadow-[0_0_12px_rgba(180,244,22,0.22)]"
                      : "border-slate-600/50 bg-[#1a2234] text-slate-200 hover:bg-slate-700/70"
                  }`}
                >
                  {isBehindMode ? (
                    <span className="h-2 w-2 rounded-full bg-[#b4f416] animate-pulse" />
                  ) : (
                    <MousePointerClick className="h-3.5 w-3.5 text-sky-300" />
                  )}
                  <span>
                    {isBehindMode
                      ? "Behind: ON (Alt+M)"
                      : "Behind / Write (Alt+M)"}
                  </span>
                </button>

                {/* Font (Alt+F + Custom Popover Slider) */}
                <button
                  type="button"
                  onClick={() => setShowFontPopover((v) => !v)}
                  title="Adjust Q&A font size (Alt+F)"
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    showFontPopover
                      ? "border-sky-400/70 bg-sky-600/30 text-white"
                      : "border-slate-600/50 bg-[#1f293f]/95 text-slate-200 hover:bg-slate-700/70"
                  }`}
                >
                  <TypeIcon className="h-3.5 w-3.5 text-sky-300" />
                  <span>Font ({fontSizePx}px)</span>
                </button>

                {/* Disconnect (Alt+D) */}
                <button
                  type="button"
                  onClick={handleDisconnect}
                  title="Disconnect Session (Alt+D)"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#9e5370] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#8c4460] transition-colors cursor-pointer"
                >
                  <Power className="h-3.5 w-3.5" />
                  <span>Disconnect</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

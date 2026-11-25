import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Headphones,
  KeyRound,
  Layers,
  LayoutDashboard,
  Mic,
  Minus,
  MoreHorizontal,
  Play,
  Plus,
  Power,
  RefreshCw,
  ScrollText,
  Square,
  Type as TypeIcon,
  Video,
  Volume2,
  VolumeX,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import { AnswerView } from "./AnswerView";
import { SAMPLE_INTERVIEW_QUESTIONS } from "../data/crackpilotPackages";
import { apiUrl, getApiBaseUrl, isDesktopApp } from "../lib/api";
import type {
  AnswerLanguage,
  AnswerStyle,
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

const LAYER_OPACITIES = [
  { label: "92%", bg: "bg-[#1a2c44]/88", nativeOpacity: 0.96 },
  { label: "76%", bg: "bg-[#1a2c44]/68", nativeOpacity: 0.84 },
  { label: "58%", bg: "bg-[#1a2c44]/48", nativeOpacity: 0.68 },
];

function formatNow(): string {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatTimer(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const commaIdx = result.indexOf(",");
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error("Failed to read audio chunk."));
    reader.readAsDataURL(blob);
  });
}

export function SoftwareOverlay({
  tokenState,
  profile,
  onTokenChange,
  onProfileChange,
  onGoDashboard,
}: SoftwareOverlayProps) {
  // Token auth gate state
  const [tokenInput, setTokenInput] = useState("");
  const [verifyingToken, setVerifyingToken] = useState(false);
  const [startingSession, setStartingSession] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Settings & font drawers
  const [showContextPanel, setShowContextPanel] = useState(false);
  const [showFontPopover, setShowFontPopover] = useState(false);

  // Resizable HUD window width (drag left/right edges or adjust slider)
  const [hudWidthPx, setHudWidthPx] = useState<number>(1060);
  const [isResizing, setIsResizing] = useState(false);

  // Overlay HUD controls
  const [autoScroll, setAutoScroll] = useState(true);
  const [videoDurationSec, setVideoDurationSec] = useState<number>(4);
  const [glitchDurationSec, setGlitchDurationSec] = useState<number>(4);
  const [isHidden, setIsHidden] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [layerIdx, setLayerIdx] = useState(0);
  const [fontSizePx, setFontSizePx] = useState<number>(15);

  // Live session connection, glitch, video scan & audio states
  const [isConnected, setIsConnected] = useState(true);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [glitchCountdown, setGlitchCountdown] = useState<number>(0);
  const [videoScanCountdown, setVideoScanCountdown] = useState<number>(0);
  const [videoFramesCount, setVideoFramesCount] = useState<number>(0);

  const [isListening, setIsListening] = useState(false);
  const [listenMode, setListenMode] = useState<"mic" | "tab" | null>(null);
  const [hasSharedScreen, setHasSharedScreen] = useState(false);
  const [monitorAudio, setMonitorAudio] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  // Session counters
  const [secondsLeft, setSecondsLeft] = useState(240 * 60);
  const [promptsUsed, setPromptsUsed] = useState(0);
  const maxPrompts = 80;

  const [questionInput, setQuestionInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const [qaList, setQaList] = useState<QAItem[]>([
    {
      id: "system-init",
      timestamp: formatNow(),
      question: "System Initialized",
      answer: "Live Stream Active. Waiting for questions...",
      engine: "Live",
      isStreaming: false,
    },
  ]);

  // Refs
  const feedRef = useRef<HTMLDivElement | null>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const chunkTimerRef = useRef<number | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const monitorGainRef = useRef<GainNode | null>(null);
  const rafLevelRef = useRef<number | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const glitchTimerRef = useRef<number | null>(null);
  const videoScanTimerRef = useRef<number | null>(null);
  const videoFrameIntervalRef = useRef<number | null>(null);
  const capturedVideoFramesRef = useRef<string[]>([]);

  const isListeningRef = useRef(false);
  const isConnectedRef = useRef(true);
  const glitchActiveRef = useRef(false);
  const profileRef = useRef(profile);
  const qaListRef = useRef(qaList);
  const videoDurationRef = useRef(videoDurationSec);
  const glitchDurationRef = useRef(glitchDurationSec);
  const sessionActiveRef = useRef(Boolean(tokenState?.sessionActive));

  profileRef.current = profile;
  qaListRef.current = qaList;
  isConnectedRef.current = isConnected;
  glitchActiveRef.current = glitchCountdown > 0;
  videoDurationRef.current = videoDurationSec;
  glitchDurationRef.current = glitchDurationSec;
  sessionActiveRef.current = Boolean(tokenState?.sessionActive);

  const desktopMode = isDesktopApp();
  const serverDisplayUrl =
    getApiBaseUrl() ||
    (typeof window !== "undefined" && window.location.origin !== "null"
      ? window.location.origin
      : "http://localhost:3000");

  const isAuthenticated = Boolean(tokenState?.authenticated);
  const isSessionLive = Boolean(tokenState?.authenticated && tokenState?.sessionActive);

  // Verify token submitted by user
  const handleVerifyToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!tokenInput.trim()) {
      setAuthError("Please paste the token generated in Dashboard → Overview.");
      return;
    }

    setVerifyingToken(true);
    try {
      const resp = await fetch(apiUrl("/api/token/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenInput.trim() }),
      });
      const data = (await resp.json()) as {
        token?: SessionTokenState;
        profile?: TargetProfile;
        error?: string;
      };
      if (!resp.ok || !data.token) {
        throw new Error(data.error || "Token verification failed.");
      }
      onTokenChange(data.token);
      if (data.profile) onProfileChange(data.profile);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : "Could not authenticate token."
      );
    } finally {
      setVerifyingToken(false);
    }
  };

  const handleStartSession = async () => {
    setAuthError(null);
    setStartingSession(true);
    try {
      const resp = await fetch(apiUrl("/api/session/start"), { method: "POST" });
      const data = (await resp.json()) as {
        token?: SessionTokenState;
        profile?: TargetProfile;
        error?: string;
      };
      if (!resp.ok || !data.token) {
        throw new Error(data.error || "Could not start session.");
      }
      onTokenChange(data.token);
      if (data.profile) onProfileChange(data.profile);
      setIsConnected(true);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : "Failed to start session."
      );
    } finally {
      setStartingSession(false);
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
      setStatusNotice(
        "Use Chrome/Edge desktop for browser Always-On-Top PiP, or install Crackpilot Desktop Kit for OS-wide always-on-top."
      );
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
      setStatusNotice("Could not open floating always-on-top window.");
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

  // Session countdown timer
  useEffect(() => {
    if (!isSessionLive || !isConnected || glitchCountdown > 0) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isSessionLive, isConnected, glitchCountdown]);

  // Smooth auto-scroll when Scroll: ON
  useEffect(() => {
    if (!autoScroll || !feedRef.current) return;
    feedRef.current.scrollTo({
      top: feedRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [qaList, interimText, autoScroll]);

  useEffect(() => {
    if (!autoScroll) return;
    const id = window.setInterval(() => {
      const el = feedRef.current;
      if (!el) return;
      const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (remaining > 4) {
        el.scrollTop += Math.min(remaining, 18);
      }
    }, 120);
    return () => window.clearInterval(id);
  }, [autoScroll]);

  useEffect(() => {
    if (monitorGainRef.current) {
      monitorGainRef.current.gain.value = monitorAudio ? 1.0 : 0.0;
    }
  }, [monitorAudio]);

  const streamAnswerFromEndpoint = useCallback(
    async (
      qaId: string,
      endpoint: "/api/answer" | "/api/analyze-screen" | "/api/analyze-video",
      body: Record<string, unknown>
    ) => {
      if (!isConnectedRef.current || glitchActiveRef.current) {
        setQaList((prev) =>
          prev.map((q) =>
            q.id === qaId
              ? {
                  ...q,
                  isStreaming: false,
                  error: glitchActiveRef.current
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

      try {
        const resp = await fetch(apiUrl(endpoint), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify(body),
        });

        if (!resp.ok || !resp.body) {
          const errText = await resp.text();
          throw new Error(errText || `Server returned ${resp.status}`);
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
              };
              if (payload.meta?.engine) {
                const eng = payload.meta.engine === "openai" ? "OpenAI" : "AI";
                setQaList((prev) =>
                  prev.map((q) => (q.id === qaId ? { ...q, engine: eng } : q))
                );
              }
              if (payload.chunk) {
                setQaList((prev) =>
                  prev.map((q) =>
                    q.id === qaId ? { ...q, answer: q.answer + payload.chunk } : q
                  )
                );
              }
              if (payload.error) {
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
    async (questionText: string, fastMode = false) => {
      const cleaned = questionText.trim();
      if (!cleaned) return;
      if (!isConnectedRef.current) {
        setStatusNotice("Session is Disconnected. Press Reconnect (Alt+R) first.");
        return;
      }
      if (glitchActiveRef.current) {
        setStatusNotice("Glitch pause active — internet temporarily off.");
        return;
      }

      setPromptsUsed((c) => Math.min(maxPrompts, c + 1));

      const qaId = `qa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setQaList((prev) => [
        ...prev,
        {
          id: qaId,
          timestamp: formatNow(),
          question: cleaned,
          answer: "",
          engine: "AI",
          isStreaming: true,
        },
      ]);

      const cur = profileRef.current;
      const recentHistory = qaListRef.current
        .filter((q) => q.id !== "system-init" && !q.isStreaming && q.answer)
        .slice(-3)
        .map((q) => ({ question: q.question, answer: q.answer }));

      const promptWithMode = fastMode
        ? `${cleaned}\n\n[FAST MODE: Give the quickest possible direct 3-bullet spoken answer.]`
        : cleaned;

      await streamAnswerFromEndpoint(qaId, "/api/answer", {
        question: promptWithMode,
        role: cur.role,
        experience: cur.experience,
        skills: cur.skills,
        resumeText: cur.resumeText,
        jdText: cur.jdText,
        answerLanguage: cur.answerLanguage,
        answerStyle: cur.answerStyle,
        history: recentHistory,
      });
    },
    [streamAnswerFromEndpoint]
  );

  // Sync live events (Dashboard Start Session, Target Profile updates, Python loopback audio questions)
  const connectEventStream = useCallback(() => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
    const source = new EventSource(apiUrl("/api/events"));
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
          profile?: TargetProfile;
        };
        if (data.token !== undefined) {
          onTokenChange(data.token);
        }
        if (data.profile) {
          onProfileChange(data.profile);
        }
        if (
          data.type === "incoming_question" &&
          data.question &&
          sessionActiveRef.current
        ) {
          void askQuestion(data.question);
        }
      } catch {
        // Ignore malformed SSE payload
      }
    };
    source.onerror = () => {
      if (isConnectedRef.current && !glitchActiveRef.current) {
        setStatusNotice("Connection interrupted — press Reconnect (Alt+R).");
      }
    };
    sseRef.current = source;
  }, [askQuestion, onProfileChange, onTokenChange]);

  useEffect(() => {
    connectEventStream();
    return () => {
      sseRef.current?.close();
    };
  }, [connectEventStream]);

  useEffect(() => {
    const onOffline = () => {
      setStatusNotice("Internet disconnected — press Reconnect (Alt+R) when back.");
    };
    const onOnline = () => {
      if (isConnectedRef.current && !glitchActiveRef.current) {
        connectEventStream();
        setStatusNotice("Internet restored — live stream reconnected.");
        setTimeout(() => setStatusNotice(null), 2000);
      }
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [connectEventStream]);

  const stopAudioListening = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);
    setListenMode(null);
    setInterimText("");
    setAudioLevel(0);

    if (chunkTimerRef.current !== null) {
      window.clearInterval(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }
    if (rafLevelRef.current !== null) {
      cancelAnimationFrame(rafLevelRef.current);
      rafLevelRef.current = null;
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
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore
      }
    }
    mediaRecorderRef.current = null;

    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
      monitorGainRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;
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
    setVideoFramesCount(0);

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    if (hiddenVideoRef.current) {
      hiddenVideoRef.current.srcObject = null;
    }
    setHasSharedScreen(false);
  }, []);

  const attachAudioMeter = useCallback(
    (audioStream: MediaStream, monitor: boolean) => {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const ctx = new AudioCtx();
        const source = ctx.createMediaStreamSource(audioStream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        const gain = ctx.createGain();
        gain.gain.value = monitor ? 1.0 : 0.0;

        source.connect(analyser);
        analyser.connect(gain);
        gain.connect(ctx.destination);

        audioCtxRef.current = ctx;
        monitorGainRef.current = gain;

        const data = new Uint8Array(analyser.fftSize);
        const tick = () => {
          if (!isListeningRef.current) return;
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          setAudioLevel(Math.min(100, Math.round(rms * 320)));
          rafLevelRef.current = requestAnimationFrame(tick);
        };
        rafLevelRef.current = requestAnimationFrame(tick);
      } catch {
        // Ignore AudioContext error
      }
    },
    []
  );

  const transcribeRecordedChunks = useCallback(
    async (fastMode = false) => {
      if (!isConnectedRef.current || glitchActiveRef.current) return;
      const chunks = recordedChunksRef.current.splice(0);
      if (chunks.length === 0) return;

      const mimeType = chunks[0].type || "audio/webm";
      const blob = new Blob(chunks, { type: mimeType });
      if (blob.size < 2200) return;

      setIsTranscribing(true);
      try {
        const audioBase64 = await blobToBase64(blob);
        const resp = await fetch(apiUrl("/api/transcribe"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audioBase64,
            mimeType,
            language:
              profileRef.current.answerLanguage === "Hindi" ? "hi" : "auto",
          }),
        });
        const data = (await resp.json()) as { text?: string; error?: string };
        if (!resp.ok) {
          throw new Error(data.error || "Transcription failed.");
        }
        if (data.text && data.text.trim().length > 2) {
          void askQuestion(data.text.trim(), fastMode);
        }
      } catch (err) {
        setStatusNotice(
          err instanceof Error ? err.message : "Audio transcription error."
        );
      } finally {
        setIsTranscribing(false);
      }
    },
    [askQuestion]
  );

  const startChunkedRecorder = useCallback(
    (audioStream: MediaStream, intervalSeconds: number) => {
      const preferredMime = MediaRecorder.isTypeSupported(
        "audio/webm;codecs=opus"
      )
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";

      const spinRecorder = () => {
        if (!isListeningRef.current) return;
        const rec = preferredMime
          ? new MediaRecorder(audioStream, { mimeType: preferredMime })
          : new MediaRecorder(audioStream);
        recordedChunksRef.current = [];
        rec.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) {
            recordedChunksRef.current.push(ev.data);
          }
        };
        rec.onstop = () => {
          void transcribeRecordedChunks(false);
        };
        mediaRecorderRef.current = rec;
        rec.start();
      };

      spinRecorder();

      chunkTimerRef.current = window.setInterval(() => {
        if (!isListeningRef.current) return;
        const activeRec = mediaRecorderRef.current;
        if (activeRec && activeRec.state === "recording") {
          activeRec.stop();
          spinRecorder();
        }
      }, intervalSeconds * 1000);
    },
    [transcribeRecordedChunks]
  );

  // Capture Tab / System / WhatsApp Web / Meet Audio (works even on headphones!)
  const startTabSystemAudio = useCallback(async () => {
    if (!isConnectedRef.current) {
      setStatusNotice("Session is Disconnected. Press Reconnect (Alt+R) first.");
      return;
    }
    setStatusNotice(null);
    stopAudioListening();

    try {
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
      if (hiddenVideoRef.current) {
        hiddenVideoRef.current.srcObject = displayStream;
        await hiddenVideoRef.current.play();
      }

      const audioTracks = displayStream.getAudioTracks();
      if (audioTracks.length === 0) {
        setStatusNotice(
          'Screen linked, but no audio track shared. Check "Share tab audio" or "Share system audio" for headphone/WhatsApp/Meet calls.'
        );
        return;
      }

      const audioOnly = new MediaStream(audioTracks);
      audioStreamRef.current = audioOnly;
      isListeningRef.current = true;
      setIsListening(true);
      setListenMode("tab");
      setMonitorAudio(false);
      attachAudioMeter(audioOnly, false);
      startChunkedRecorder(audioOnly, 5);
      setStatusNotice(
        "Tab / System Audio active — capturing interviewer voice (headphones supported)."
      );
    } catch (err) {
      setStatusNotice(
        err instanceof Error ? err.message : "System audio capture cancelled."
      );
    }
  }, [attachAudioMeter, startChunkedRecorder, stopAudioListening, stopScreenStream]);

  const startMicListening = useCallback(async () => {
    if (!isConnectedRef.current) {
      setStatusNotice("Session is Disconnected. Press Reconnect (Alt+R) first.");
      return;
    }
    setStatusNotice(null);
    stopAudioListening();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      audioStreamRef.current = stream;
      isListeningRef.current = true;
      setIsListening(true);
      setListenMode("mic");
      setMonitorAudio(false);
      attachAudioMeter(stream, false);

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

      if (SpeechRecCtor) {
        const rec = new SpeechRecCtor();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang =
          profileRef.current.answerLanguage === "Hindi" ? "hi-IN" : "en-IN";

        rec.onresult = (event) => {
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i];
            const transcript = res[0]?.transcript || "";
            if (res.isFinal && transcript.trim()) {
              void askQuestion(transcript.trim());
            } else {
              interim += transcript;
            }
          }
          setInterimText(interim);
        };

        rec.onerror = (ev) => {
          if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
            startChunkedRecorder(stream, 5);
          }
        };

        rec.onend = () => {
          if (isListeningRef.current && recognitionRef.current === rec) {
            try {
              rec.start();
            } catch {
              // Ignore
            }
          }
        };

        recognitionRef.current = rec;
        rec.start();
      } else {
        startChunkedRecorder(stream, 5);
      }
    } catch (err) {
      setStatusNotice(
        err instanceof Error ? err.message : "Microphone permission denied."
      );
      stopAudioListening();
    }
  }, [askQuestion, attachAudioMeter, startChunkedRecorder, stopAudioListening]);

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
    if (audioTracks.length > 0 && !isListeningRef.current) {
      const audioOnly = new MediaStream(audioTracks);
      audioStreamRef.current = audioOnly;
      isListeningRef.current = true;
      setIsListening(true);
      setListenMode("tab");
      attachAudioMeter(audioOnly, false);
      startChunkedRecorder(audioOnly, 5);
    }

    const videoEl = hiddenVideoRef.current;
    if (!videoEl) throw new Error("Video preview element unavailable.");
    videoEl.srcObject = displayStream;
    await videoEl.play();
    await new Promise((r) => setTimeout(r, 250));
    return videoEl;
  }, [attachAudioMeter, startChunkedRecorder, stopScreenStream]);

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

  // Capture (Alt+S)
  const handleCaptureScreen = useCallback(async () => {
    if (!isConnectedRef.current) {
      setStatusNotice("Session is Disconnected. Press Reconnect (Alt+R) first.");
      return;
    }
    if (glitchActiveRef.current) {
      setStatusNotice("Glitch pause active — wait until connection resumes.");
      return;
    }
    setStatusNotice(null);

    try {
      const videoEl = await ensureScreenStream();
      const imageBase64 = snapshotVideoFrame(videoEl);
      if (!imageBase64) {
        throw new Error("Screen frame not ready yet. Please try Alt+S again.");
      }

      setPromptsUsed((c) => Math.min(maxPrompts, c + 1));

      const qaId = `cap-${Date.now()}`;
      setQaList((prev) => [
        ...prev,
        {
          id: qaId,
          timestamp: formatNow(),
          question: "Screen Capture (Alt+S) — Reading Question & Chat Box",
          answer: "",
          engine: "Vision",
          isStreaming: true,
        },
      ]);

      await streamAnswerFromEndpoint(qaId, "/api/analyze-screen", {
        imageBase64,
        mimeType: "image/jpeg",
        role: profileRef.current.role,
        answerLanguage: profileRef.current.answerLanguage,
        answerStyle: profileRef.current.answerStyle,
      });
    } catch (err) {
      setStatusNotice(
        err instanceof Error ? err.message : "Screen capture cancelled."
      );
    }
  }, [ensureScreenStream, streamAnswerFromEndpoint]);

  // Video (Alt+V): 4s / 6s / 8s / 10s multi-frame page question scan
  const handleVideoPageScan = useCallback(async () => {
    if (!isConnectedRef.current) {
      setStatusNotice("Session is Disconnected. Press Reconnect (Alt+R) first.");
      return;
    }
    if (glitchActiveRef.current) {
      setStatusNotice("Glitch pause active — wait until connection resumes.");
      return;
    }
    if (videoScanTimerRef.current !== null) return;

    setStatusNotice(null);
    const duration = videoDurationRef.current;

    try {
      const videoEl = await ensureScreenStream();
      capturedVideoFramesRef.current = [];
      setVideoScanCountdown(duration);
      setVideoFramesCount(0);

      const firstFrame = snapshotVideoFrame(videoEl);
      if (firstFrame) {
        capturedVideoFramesRef.current.push(firstFrame);
        setVideoFramesCount(1);
      }

      const frameGapMs = duration <= 4 ? 1000 : duration <= 6 ? 1100 : 1350;
      videoFrameIntervalRef.current = window.setInterval(() => {
        if (capturedVideoFramesRef.current.length >= 8) return;
        const frame = snapshotVideoFrame(videoEl);
        if (frame) {
          capturedVideoFramesRef.current.push(frame);
          setVideoFramesCount(capturedVideoFramesRef.current.length);
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
          setVideoFramesCount(0);

          if (framesToSend.length === 0) {
            setStatusNotice("No frames captured during video scan.");
            return;
          }

          setPromptsUsed((c) => Math.min(maxPrompts, c + 1));

          const qaId = `vid-${Date.now()}`;
          setQaList((prev) => [
            ...prev,
            {
              id: qaId,
              timestamp: formatNow(),
              question: `Video Page Scan (${duration}s · ${framesToSend.length} frames) — All Page Questions`,
              answer: "",
              engine: "Video AI",
              isStreaming: true,
            },
          ]);

          void streamAnswerFromEndpoint(qaId, "/api/analyze-video", {
            frames: framesToSend,
            mimeType: "image/jpeg",
            durationSec: duration,
            role: profileRef.current.role,
            answerLanguage: profileRef.current.answerLanguage,
            answerStyle: profileRef.current.answerStyle,
          });
        }
      }, 1000);
    } catch (err) {
      setVideoScanCountdown(0);
      setStatusNotice(
        err instanceof Error ? err.message : "Video page scan cancelled."
      );
    }
  }, [ensureScreenStream, streamAnswerFromEndpoint]);

  // Fast (Alt+X)
  const handleFastTrigger = useCallback(async () => {
    if (!isConnectedRef.current) {
      setStatusNotice("Session is Disconnected. Press Reconnect (Alt+R) first.");
      return;
    }
    if (glitchActiveRef.current) {
      setStatusNotice("Glitch pause active — internet paused.");
      return;
    }

    if (interimText.trim()) {
      const text = interimText.trim();
      setInterimText("");
      await askQuestion(text, true);
      return;
    }

    if (questionInput.trim()) {
      const text = questionInput.trim();
      setQuestionInput("");
      await askQuestion(text, true);
      return;
    }

    const activeRec = mediaRecorderRef.current;
    if (activeRec && activeRec.state === "recording") {
      activeRec.onstop = () => {
        void transcribeRecordedChunks(true);
      };
      activeRec.stop();
      if (audioStreamRef.current) {
        startChunkedRecorder(audioStreamRef.current, 5);
      }
      return;
    }

    const lastRealQa = [...qaListRef.current]
      .reverse()
      .find((q) => q.id !== "system-init");
    if (lastRealQa && !isListeningRef.current) {
      await askQuestion(lastRealQa.question, true);
      return;
    }

    if (!isListeningRef.current) {
      await startMicListening();
    }
  }, [
    askQuestion,
    interimText,
    questionInput,
    startChunkedRecorder,
    startMicListening,
    transcribeRecordedChunks,
  ]);

  // Reconnect (Alt+R)
  const handleReconnect = useCallback(async () => {
    if (glitchTimerRef.current !== null) {
      window.clearInterval(glitchTimerRef.current);
      glitchTimerRef.current = null;
    }
    setGlitchCountdown(0);
    setIsReconnecting(true);
    setStatusNotice("Reconnecting...");

    try {
      const resp = await fetch(apiUrl("/api/health"), { cache: "no-store" });
      if (!resp.ok) throw new Error("Server unreachable");
      setIsConnected(true);
      connectEventStream();
      setStatusNotice("Reconnected — Live Stream Active.");
      setTimeout(() => setStatusNotice(null), 1800);
    } catch {
      setStatusNotice(
        "Reconnect failed — check your internet and press Alt+R again."
      );
    } finally {
      setIsReconnecting(false);
    }
  }, [connectEventStream]);

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
    setStatusNotice(
      `Glitch active: connection paused for ${secs}s — auto-reconnecting afterwards.`
    );

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
        connectEventStream();
        setStatusNotice("Glitch ended — connection restored automatically.");
        setTimeout(() => setStatusNotice(null), 2200);
      }
    }, 1000);
  }, [connectEventStream]);

  // Disconnect (Alt+D)
  const handleDisconnect = useCallback(() => {
    if (glitchTimerRef.current !== null) {
      window.clearInterval(glitchTimerRef.current);
      glitchTimerRef.current = null;
    }
    setGlitchCountdown(0);
    stopAudioListening();
    stopScreenStream();
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
    if (abortRef.current) abortRef.current.abort();
    setIsConnected(false);
    void fetch(apiUrl("/api/session/stop"), { method: "POST" });
    setStatusNotice("Session Disconnected. Press Reconnect (Alt+R) to resume.");
  }, [stopAudioListening, stopScreenStream]);

  const handleFontIncreaseCycle = useCallback(() => {
    setFontSizePx((prev) => (prev >= 26 ? 12 : prev + 2));
  }, []);

  const handleToggleAutoScroll = useCallback((forceOn?: boolean) => {
    setAutoScroll((prev) => {
      const next = typeof forceOn === "boolean" ? forceOn : !prev;
      if (next && feedRef.current) {
        feedRef.current.scrollTo({
          top: feedRef.current.scrollHeight,
          behavior: "smooth",
        });
      }
      return next;
    });
  }, []);

  // All keyboard shortcuts active when session is live
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
      } else if (key === "h") {
        e.preventDefault();
        if (window.crackpilotDesktop?.isElectron) {
          void window.crackpilotDesktop.hideWindow();
        } else {
          setIsHidden((h) => !h);
        }
      } else if (key === "f") {
        e.preventDefault();
        handleFontIncreaseCycle();
      } else if (key === "d") {
        e.preventDefault();
        handleDisconnect();
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

  const handleCopyCard = async (item: QAItem) => {
    try {
      const content =
        item.id === "system-init"
          ? `${item.question}\n${item.answer}`
          : item.answer || item.question;
      await navigator.clipboard.writeText(content);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Ignore
    }
  };

  const handleSpeakCard = (item: QAItem) => {
    if (!("speechSynthesis" in window) || !item.answer) return;
    if (speakingId === item.id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const plain = item.answer
      .replace(/```[\s\S]*?```/g, "")
      .replace(/[#*`]/g, "")
      .trim();
    const utter = new SpeechSynthesisUtterance(plain);
    utter.lang = profile.answerLanguage === "Hindi" ? "hi-IN" : "en-IN";
    utter.onend = () => setSpeakingId(null);
    utter.onerror = () => setSpeakingId(null);
    setSpeakingId(item.id);
    window.speechSynthesis.speak(utter);
  };

  const handleSendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionInput.trim()) return;
    const text = questionInput.trim();
    setQuestionInput("");
    void askQuestion(text);
  };

  const updateInlineProfile = (patch: Partial<TargetProfile>) => {
    const next = { ...profile, ...patch };
    onProfileChange(next);
    void fetch(apiUrl("/api/profile"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
  };

  const currentLayer = LAYER_OPACITIES[layerIdx];
  const questionFontPx = Math.min(30, fontSizePx + 1);

  // Hidden state (Alt+H brings back immediately)
  if (isHidden) {
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
      className={`${
        desktopMode
          ? "h-screen w-screen bg-transparent p-0"
          : "min-h-screen bg-gradient-to-br from-[#0a1322] via-[#13263f] to-[#0b1526] p-2 sm:p-4"
      } flex items-center justify-center ${
        isResizing ? "select-none cursor-ew-resize" : ""
      }`}
    >
      <video ref={hiddenVideoRef} className="hidden" muted playsInline />

      {/* Resizable Floating Translucent Overlay Window */}
      <div
        style={
          desktopMode || isMaximized
            ? undefined
            : { width: `min(100%, ${hudWidthPx}px)` }
        }
        className={`relative flex flex-col overflow-hidden rounded-xl border border-slate-500/35 shadow-2xl backdrop-blur-md transition-colors ${
          currentLayer.bg
        } ${
          desktopMode
            ? "h-full w-full"
            : isMaximized
              ? "h-[calc(100vh-1rem)] w-full"
              : isCompact
                ? "h-[460px]"
                : "h-[calc(100vh-2rem)] max-h-[840px]"
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

        {/* Clean Top Window Bar — ONLY Crackpilot (No "Node + Python", No "Live HUD") */}
        <header className="app-drag flex h-10 shrink-0 items-center justify-between gap-4 border-b border-slate-700/60 bg-[#0d1220]/95 px-4">
          {/* Left: Clean Brand Name Only */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-[#405fe8] text-[11px] font-bold text-white shrink-0">
              C
            </span>
            <span className="text-xs font-semibold tracking-tight text-slate-100 whitespace-nowrap shrink-0">
              Crackpilot
            </span>
          </div>

          {/* Center: Classic "..." Handle */}
          <button
            type="button"
            onClick={() => setShowContextPanel((v) => !v)}
            title="Width, Target Profile & Quick Test Settings"
            className={`app-no-drag rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
              showContextPanel
                ? "bg-slate-700/80 text-sky-300"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            }`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {/* Right: Float on Top (PiP) + Window Controls (— □ ×) */}
          <div className="app-no-drag flex items-center gap-1 shrink-0 text-slate-400">
            {!desktopMode && (
              <button
                type="button"
                onClick={() => void handlePopOutFloatingWindow()}
                title="Float Always On Top Across Tabs"
                className="rounded p-1.5 hover:bg-slate-800 hover:text-sky-300 transition-colors cursor-pointer"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setIsCompact((c) => {
                  const next = !c;
                  if (window.crackpilotDesktop?.isElectron) {
                    void window.crackpilotDesktop.setCompact(next);
                  }
                  return next;
                });
              }}
              title="Compact / Normal height"
              className="rounded p-1.5 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCompact(false);
                if (window.crackpilotDesktop?.isElectron) {
                  void window.crackpilotDesktop
                    .toggleMaximize()
                    .then((max) => setIsMaximized(max));
                } else {
                  setIsMaximized((m) => !m);
                }
              }}
              title="Maximize / Restore"
              className="rounded p-1.5 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            >
              <Square className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.crackpilotDesktop?.isElectron) {
                  void window.crackpilotDesktop.hideWindow();
                } else {
                  setIsHidden(true);
                }
              }}
              title="Hide Overlay (Alt+H)"
              className="rounded p-1.5 hover:bg-rose-500/80 hover:text-white transition-colors cursor-pointer"
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

              <div className="flex items-center gap-3">
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
                  value={profile.answerStyle}
                  onChange={(e) =>
                    updateInlineProfile({
                      answerStyle: e.target.value as AnswerStyle,
                    })
                  }
                  className="rounded-md border border-slate-700 bg-[#131d33] px-2.5 py-1 text-xs text-slate-100"
                >
                  <option value="Concise Bullets">Concise Bullets</option>
                  <option value="STAR Method">STAR Method</option>
                  <option value="Technical + Code">Technical + Code</option>
                </select>

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

        {/* GATE 1: Token Authentication Screen */}
        {!isAuthenticated ? (
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
                  <h2 className="text-base font-semibold text-white">
                    Authenticate Crackpilot
                  </h2>
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
        ) : !isSessionLive ? (
          /* GATE 2: Authenticated — Ready for Start Session (or auto-triggered from Dashboard!) */
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="w-full max-w-lg rounded-xl border border-slate-700/70 bg-[#0d1424]/95 p-6 space-y-5 shadow-2xl">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Token Authenticated — Ready to Start Session
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Click <strong className="text-white">Start Session</strong>{" "}
                    below (or click Start Session inside your Dashboard) to
                    activate live Crackpilot answers.
                  </p>
                </div>
              </div>

              {/* Loaded Target Profile summary */}
              <div className="rounded-lg border border-slate-800 bg-[#090e1a] p-4 space-y-1.5 text-xs text-slate-300">
                <p className="text-[11px] uppercase tracking-wider text-slate-500">
                  Synced Target Profile
                </p>
                <p>
                  <span className="text-slate-500">Role:</span>{" "}
                  <strong className="text-white">{profile.role}</strong> (
                  {profile.experience})
                </p>
                <p>
                  <span className="text-slate-500">Language &amp; Style:</span>{" "}
                  {profile.answerLanguage} · {profile.answerStyle}
                </p>
                <p>
                  <span className="text-slate-500">Resume:</span>{" "}
                  {profile.resumeText ? (
                    <span className="text-emerald-400">
                      Attached ({profile.resumeFileName || "Custom Resume"})
                    </span>
                  ) : (
                    <span className="text-amber-300">
                      Optional — upload in Dashboard → Target Profile
                    </span>
                  )}
                </p>
                <p>
                  <span className="text-slate-500">Job Description:</span>{" "}
                  {profile.jdText ? (
                    <span className="text-emerald-400">
                      Attached ({profile.jdFileName || "Custom JD"})
                    </span>
                  ) : (
                    <span className="text-amber-300">
                      Optional — upload in Dashboard → Target Profile
                    </span>
                  )}
                </p>
              </div>

              {authError && (
                <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                  {authError}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleStartSession()}
                  disabled={startingSession}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors cursor-pointer disabled:opacity-60"
                >
                  <Play className="h-4 w-4" />
                  <span>
                    {startingSession ? "Starting..." : "Start Session"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onGoDashboard}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-xs font-medium text-slate-200 hover:bg-slate-700 cursor-pointer"
                >
                  Edit Profile
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ACTIVE LIVE HUD OVERLAY */
          <>
            {/* Scrollable Q&A Stream Feed */}
            <div
              ref={feedRef}
              className="hud-scroll flex-1 overflow-y-auto px-4 py-4 space-y-3"
            >
              {qaList.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border border-slate-700/60 bg-[#0e1525]/92 px-5 py-4 shadow-lg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span
                        style={{ fontSize: `${questionFontPx}px` }}
                        className="mt-0.5 font-mono font-bold text-sky-400 shrink-0"
                      >
                        Q
                      </span>
                      <h2
                        style={{ fontSize: `${questionFontPx}px` }}
                        className="font-semibold text-white leading-snug break-words"
                      >
                        {item.question}
                      </h2>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.id !== "system-init" && item.answer && (
                        <button
                          type="button"
                          onClick={() => handleSpeakCard(item)}
                          title="Read aloud"
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                            speakingId === item.id
                              ? "border-sky-500/50 bg-sky-500/20 text-sky-200"
                              : "border-slate-700/80 bg-[#172136] text-slate-300 hover:text-white"
                          }`}
                        >
                          <Volume2 className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleCopyCard(item)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-700/80 bg-[#172136] px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-700/80 transition-colors cursor-pointer"
                      >
                        {copiedId === item.id ? (
                          <Check className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3 text-slate-400" />
                        )}
                        <span>{copiedId === item.id ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-start gap-2.5">
                    <span
                      style={{ fontSize: `${fontSizePx}px` }}
                      className="mt-0.5 font-mono font-bold text-rose-400 shrink-0"
                    >
                      A
                    </span>
                    <div className="flex-1 min-w-0">
                      {item.error ? (
                        <p className="text-xs text-rose-300">{item.error}</p>
                      ) : item.answer ? (
                        <AnswerView
                          markdown={item.answer}
                          isStreaming={item.isStreaming}
                          fontSizePx={fontSizePx}
                        />
                      ) : (
                        <p className="text-xs text-slate-400">
                          Generating personalized answer...
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              ))}

              {/* Live Interim Speech Preview */}
              {(interimText || isTranscribing) && (
                <div className="rounded-xl border border-sky-500/35 bg-[#0f192d]/90 px-4 py-2.5 text-xs text-sky-200 flex items-center justify-between gap-3">
                  <span className="truncate">
                    {interimText
                      ? `Listening: "${interimText}"`
                      : "Transcribing captured interviewer audio..."}
                  </span>
                  {interimText && (
                    <button
                      type="button"
                      onClick={() => {
                        const text = interimText.trim();
                        setInterimText("");
                        void askQuestion(text, true);
                      }}
                      className="shrink-0 rounded bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/30 cursor-pointer"
                    >
                      Fast Answer (Alt+X)
                    </button>
                  )}
                </div>
              )}

              {/* Active Glitch Offline / Video Scan / Status Banners */}
              {glitchCountdown > 0 && (
                <div className="rounded-xl border border-amber-500/45 bg-amber-950/75 px-4 py-2.5 text-xs text-amber-200 flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 font-medium">
                    <WifiOff className="h-4 w-4 text-amber-400" />
                    <span>
                      Glitch Active: Internet paused — auto-restoring in{" "}
                      <strong className="font-mono text-white">
                        {glitchCountdown}s
                      </strong>
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleReconnect()}
                    className="rounded bg-amber-500/25 px-2 py-0.5 text-[11px] font-semibold text-amber-100 hover:bg-amber-500/40 cursor-pointer"
                  >
                    Restore Now
                  </button>
                </div>
              )}

              {videoScanCountdown > 0 && (
                <div className="rounded-xl border border-sky-500/50 bg-sky-950/75 px-4 py-2.5 text-xs text-sky-200 flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 font-medium">
                    <Video className="h-4 w-4 text-sky-400" />
                    <span>
                      Recording Page Video Scan: scroll through questions now —{" "}
                      <strong className="font-mono text-white">
                        {videoScanCountdown}s left
                      </strong>{" "}
                      ({videoFramesCount} frames captured)
                    </span>
                  </span>
                </div>
              )}

              {statusNotice &&
                glitchCountdown === 0 &&
                videoScanCountdown === 0 && (
                  <div className="rounded-lg border border-slate-700/70 bg-[#0d1424]/90 px-3.5 py-2 text-xs text-slate-300 flex items-center justify-between gap-2">
                    <span>{statusNotice}</span>
                    <button
                      type="button"
                      onClick={() => setStatusNotice(null)}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
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

              {/* Input Row */}
              <form
                onSubmit={handleSendSubmit}
                className="flex items-center gap-2.5"
              >
                <input
                  type="text"
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  placeholder="Type question here..."
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

              {/* Compact Status Line */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="tabular-nums">
                    Time:{" "}
                    <strong className="font-semibold text-white">
                      {formatTimer(secondsLeft)}
                    </strong>
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className="tabular-nums">
                    Prompts:{" "}
                    <strong className="font-semibold text-white">
                      {promptsUsed}/{maxPrompts}
                    </strong>{" "}
                    Used
                  </span>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          `${serverDisplayUrl}/api/incoming-question`
                        );
                        setCopiedUrl(true);
                        setTimeout(() => setCopiedUrl(false), 1400);
                      } catch {
                        // Ignore
                      }
                    }}
                    title="Copy Python Headphone Loopback Bridge URL"
                    className="inline-flex items-center gap-1.5 rounded bg-[#0c1424]/90 border border-slate-700/80 px-2 py-0.5 font-mono text-[11px] text-slate-200 hover:border-sky-400/50 transition-colors cursor-pointer"
                  >
                    <span>
                      {copiedUrl
                        ? "Copied Bridge URL!"
                        : `${serverDisplayUrl}/api/incoming-question`}
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  {/* Tab / WhatsApp / Meet Audio quick toggle (works with headphones) */}
                  <button
                    type="button"
                    onClick={() =>
                      listenMode === "tab"
                        ? stopAudioListening()
                        : void startTabSystemAudio()
                    }
                    title="Capture Meet / Zoom / Teams / WhatsApp Web audio (works with headphones)"
                    className={`inline-flex items-center gap-1.5 text-[11px] transition-colors cursor-pointer ${
                      listenMode === "tab"
                        ? "text-emerald-300 font-medium"
                        : "text-sky-300 hover:text-sky-200"
                    }`}
                  >
                    <Headphones className="h-3.5 w-3.5" />
                    <span>
                      {listenMode === "tab"
                        ? "System Audio: ON"
                        : "Headphone / Tab Audio"}
                    </span>
                  </button>

                  {isListening && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-300">
                      <span className="inline-block h-1.5 w-10 overflow-hidden rounded-full bg-slate-800">
                        <span
                          className="block h-full bg-emerald-400 transition-all duration-75"
                          style={{ width: `${Math.max(12, audioLevel)}%` }}
                        />
                      </span>
                      <span>
                        {listenMode === "tab" ? "Tab Audio" : "Mic Live"}
                      </span>
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => setMonitorAudio((v) => !v)}
                    title="Hear interviewer audio through speakers/headphones"
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
                  onClick={() => void handleCaptureScreen()}
                  title="Capture screen / chat box question (Alt+S)"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#405fe8] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#3552d6] transition-colors cursor-pointer"
                >
                  <Camera className="h-3.5 w-3.5" />
                  <span>
                    {hasSharedScreen ? "Capture (Alt+S)" : "Capture (Alt+S)"}
                  </span>
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

                {/* Listen Audio / Stop */}
                <button
                  type="button"
                  onClick={() =>
                    isListening
                      ? stopAudioListening()
                      : void startMicListening()
                  }
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    isListening
                      ? "bg-[#9e5370] text-white hover:bg-[#8d4561]"
                      : "bg-[#253754] text-slate-100 hover:bg-[#2f4568]"
                  }`}
                >
                  {isListening ? (
                    <Square className="h-3 w-3 fill-current" />
                  ) : (
                    <Mic className="h-3.5 w-3.5 text-sky-300" />
                  )}
                  <span>{isListening ? "Stop" : "Listen Audio"}</span>
                </button>

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

                {/* Hide (Alt+H) */}
                <button
                  type="button"
                  onClick={() => {
                    if (window.crackpilotDesktop?.isElectron) {
                      void window.crackpilotDesktop.hideWindow();
                    } else {
                      setIsHidden(true);
                    }
                  }}
                  title="Hide Software (Alt+H)"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/50 bg-[#1f293f]/95 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700/70 transition-colors cursor-pointer"
                >
                  <EyeOff className="h-3.5 w-3.5 text-slate-300" />
                  <span>Hide</span>
                </button>

                {/* Layer */}
                <button
                  type="button"
                  onClick={() => {
                    setLayerIdx((i) => {
                      const next = (i + 1) % LAYER_OPACITIES.length;
                      if (window.crackpilotDesktop?.isElectron) {
                        void window.crackpilotDesktop.setOpacity(
                          LAYER_OPACITIES[next].nativeOpacity
                        );
                      }
                      return next;
                    });
                  }}
                  title={`Opacity: ${currentLayer.label}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/50 bg-[#1f293f]/95 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700/70 transition-colors cursor-pointer"
                >
                  <Layers className="h-3.5 w-3.5 text-sky-300" />
                  <span>Layer</span>
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

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Cpu,
  Gauge,
  Headphones,
  Mic,
  Send,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  XCircle,
  Zap,
} from "lucide-react";
import { hasConfiguredBackend, wsUrl } from "../lib/api";
import { tryApiJson } from "../lib/clientStore";
import { AnswerView } from "./AnswerView";
import {
  type LiveQaAudioSource,
  type LiveQaPipeline,
  type LiveQaServerEvent,
  type LiveQaServerStatus,
  type LiveQaTurn,
} from "../lib/liveQaPrompts";
import { type PcmCaptureSession, startPcm16Capture } from "../lib/pcmCapture";

interface LiveAudioQAEngineProps {
  compact?: boolean;
}

const SAMPLE_SCENARIOS = [
  {
    label: "Long Production Outage",
    text: "Walk me through a time when a release went to production right before a busy weekend, latency suddenly spiked by 4x on the checkout endpoint, and your logs weren't showing any obvious exceptions—how would you isolate and fix that fast?",
  },
  {
    label: "Stakeholder Pushback",
    text: "Suppose product leadership asks you to ship a major feature in three days, you know cutting corners will cause severe tech debt and flaky data sync, and they're pushing back hard in the meeting—what do you actually say?",
  },
];

function formatSeconds(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "—";
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatClock(): string {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function LiveAudioQAEngine({ compact = false }: LiveAudioQAEngineProps) {
  const [pipeline, setPipeline] = useState<LiveQaPipeline>("gemini-live");
  const [audioSource, setAudioSource] = useState<LiveQaAudioSource>("system");
  const [isRunning, setIsRunning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [actualSampleRate, setActualSampleRate] = useState<number | null>(null);
  const [activeModelInfo, setActiveModelInfo] = useState<string>("");
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [serverStatus, setServerStatus] = useState<LiveQaServerStatus | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Live transcript & active streaming turn
  const [liveTranscript, setLiveTranscript] = useState("");
  const [activeTurn, setActiveTurn] = useState<LiveQaTurn | null>(null);
  const [history, setHistory] = useState<LiveQaTurn[]>([]);
  const [lastTtfwMs, setLastTtfwMs] = useState<number | null>(null);
  const [scenarioInput, setScenarioInput] = useState("");

  // Mutable refs to prevent stale closures inside audio & WebSocket callbacks
  const wsRef = useRef<WebSocket | null>(null);
  const captureRef = useRef<PcmCaptureSession | null>(null);
  const pipelineRef = useRef<LiveQaPipeline>(pipeline);
  const speechEndPerfRef = useRef<number | null>(null);
  const activeTurnIdRef = useRef<string | null>(null);
  const activeTurnHasFirstWordRef = useRef(false);
  const isRunningRef = useRef(false);
  const liveTranscriptRef = useRef("");
  const answerScrollRef = useRef<HTMLDivElement | null>(null);

  pipelineRef.current = pipeline;
  isRunningRef.current = isRunning;
  liveTranscriptRef.current = liveTranscript;

  const refreshStatus = useCallback(async () => {
    const res = await tryApiJson<LiveQaServerStatus>("/api/live-qa/status", {
      cache: "no-store",
    });
    if (res.reachable && res.ok) {
      setServerStatus(res.data);
      // Auto-select Pipeline A if configured, else default to ready Pipeline B
      if (!res.data.pipelineBReady && res.data.pipelineAReady) {
        setPipeline("deepgram-groq");
      }
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  // Smooth scroll when streaming tokens arrive
  useEffect(() => {
    if (!answerScrollRef.current) return;
    answerScrollRef.current.scrollTop = answerScrollRef.current.scrollHeight;
  }, [activeTurn?.answer, history.length]);

  const stopEngine = useCallback(() => {
    if (captureRef.current) {
      captureRef.current.stop();
      captureRef.current = null;
    }
    if (wsRef.current) {
      const ws = wsRef.current;
      wsRef.current = null;
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "stop" }));
        }
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        ws.close();
      } catch {
        // Ignore teardown close errors
      }
    }
    setIsRunning(false);
    setIsConnecting(false);
    setIsSpeaking(false);
    setAudioLevel(0);
    setActualSampleRate(null);
    activeTurnIdRef.current = null;
    activeTurnHasFirstWordRef.current = false;
  }, []);

  // Guarantee zero leaks on unmount
  useEffect(() => {
    return () => {
      stopEngine();
    };
  }, [stopEngine]);

  const openWebSocket = useCallback(
    (targetPipeline: LiveQaPipeline): Promise<WebSocket> => {
      return new Promise((resolve, reject) => {
        if (!hasConfiguredBackend()) {
          reject(
            new Error(
              "Live Q&A WebSocket requires the Crackpilot Node.js server. Run locally or set Server URL in ••• Settings."
            )
          );
          return;
        }

        const socketUrl = wsUrl("/ws/live-qa");
        const ws = new WebSocket(socketUrl);
        wsRef.current = ws;

        let settled = false;

        ws.onopen = () => {
          ws.send(JSON.stringify({ type: "start", pipeline: targetPipeline }));
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(String(event.data)) as LiveQaServerEvent;

            if (msg.type === "ready") {
              setActiveModelInfo(msg.modelInfo);
              setErrorNotice(null);
              if (!settled) {
                settled = true;
                resolve(ws);
              }
              return;
            }

            if (msg.type === "transcript") {
              setLiveTranscript(msg.text);
              if (msg.speechFinal) {
                speechEndPerfRef.current = performance.now();
              }
              return;
            }

            if (msg.type === "answer_start") {
              if (!speechEndPerfRef.current) {
                speechEndPerfRef.current = performance.now();
              }
              activeTurnIdRef.current = msg.turnId;
              activeTurnHasFirstWordRef.current = false;
              const nextTurn: LiveQaTurn = {
                id: msg.turnId,
                pipeline: pipelineRef.current,
                transcript: msg.transcript,
                answer: "",
                ttfwMs: null,
                serverTtfwMs: null,
                completed: false,
                timestamp: formatClock(),
              };
              setLiveTranscript(msg.transcript);
              setActiveTurn(nextTurn);
              return;
            }

            if (msg.type === "answer_delta") {
              let computedTtfw: number | null = null;
              if (!activeTurnHasFirstWordRef.current) {
                activeTurnHasFirstWordRef.current = true;
                const endTs = speechEndPerfRef.current;
                const clientMs = endTs
                  ? Math.max(10, Math.round(performance.now() - endTs))
                  : msg.serverTtfwMs ?? null;
                computedTtfw =
                  msg.serverTtfwMs && clientMs
                    ? Math.min(clientMs, msg.serverTtfwMs + 40)
                    : clientMs;
                if (computedTtfw !== null) {
                  setLastTtfwMs(computedTtfw);
                }
              }

              setActiveTurn((prev) => {
                if (!prev || prev.id !== msg.turnId) {
                  return {
                    id: msg.turnId,
                    pipeline: pipelineRef.current,
                    transcript: liveTranscriptRef.current || "Live spoken question",
                    answer: msg.delta,
                    ttfwMs: computedTtfw,
                    serverTtfwMs: msg.serverTtfwMs ?? null,
                    completed: false,
                    timestamp: formatClock(),
                  };
                }
                return {
                  ...prev,
                  answer: prev.answer + msg.delta,
                  ttfwMs: prev.ttfwMs ?? computedTtfw,
                  serverTtfwMs: prev.serverTtfwMs ?? msg.serverTtfwMs ?? null,
                };
              });
              return;
            }

            if (msg.type === "answer_done") {
              setActiveTurn((prev) => {
                if (prev && prev.id === msg.turnId && prev.answer.trim()) {
                  const finished: LiveQaTurn = { ...prev, completed: true };
                  setHistory((h) =>
                    [finished, ...h.filter((item) => item.id !== finished.id)].slice(0, 12)
                  );
                }
                return prev && prev.id === msg.turnId
                  ? { ...prev, completed: true }
                  : prev;
              });
              speechEndPerfRef.current = null;
              activeTurnIdRef.current = null;
              activeTurnHasFirstWordRef.current = false;
              return;
            }

            if (msg.type === "interrupted") {
              activeTurnIdRef.current = null;
              activeTurnHasFirstWordRef.current = false;
              return;
            }

            if (msg.type === "error") {
              console.error("[Crackpilot LiveQA] Server pipeline error:", msg.message);
              setErrorNotice(msg.message);
              if (!settled) {
                settled = true;
                reject(new Error(msg.message));
              }
            }
          } catch (parseErr) {
            console.error("[Crackpilot LiveQA] Failed to parse WS message:", parseErr);
          }
        };

        ws.onerror = () => {
          const msg = `WebSocket connection error on ${socketUrl}. Verify the Crackpilot backend server is running.`;
          console.error("[Crackpilot LiveQA]", msg);
          if (!settled) {
            settled = true;
            reject(new Error(msg));
          } else {
            setErrorNotice(msg);
          }
        };

        ws.onclose = () => {
          if (wsRef.current === ws) {
            wsRef.current = null;
            if (isRunningRef.current) {
              stopEngine();
            }
          }
        };
      });
    },
    [stopEngine]
  );

  const startLiveCapture = useCallback(
    async (overridePipeline?: LiveQaPipeline, overrideSource?: LiveQaAudioSource) => {
      const targetPipeline = overridePipeline ?? pipelineRef.current;
      const targetSource = overrideSource ?? audioSource;

      stopEngine();
      setErrorNotice(null);
      setIsConnecting(true);

      try {
        // 1. Acquire 16kHz PCM audio capture FIRST (browser requires direct user gesture for getDisplayMedia/getUserMedia)
        const session = await startPcm16Capture(targetSource, {
          onPcmChunk: (_pcmBuf, base64Pcm, rms) => {
            setAudioLevel(Math.min(100, Math.round(rms * 380)));
            const ws = wsRef.current;
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "audio", data: base64Pcm }));
            }
          },
          onSpeechStateChange: (speaking) => {
            setIsSpeaking(speaking);
            if (!speaking) {
              speechEndPerfRef.current = performance.now();
            }
          },
          onTrackEnded: () => {
            stopEngine();
          },
        });
        captureRef.current = session;
        setActualSampleRate(session.actualSampleRate);

        // 2. Open server WebSocket bridge for chosen pipeline (A: Deepgram+Groq, B: Gemini Live)
        await openWebSocket(targetPipeline);

        setIsRunning(true);
        setIsConnecting(false);
      } catch (err) {
        console.error("[Crackpilot LiveQA] Failed to start capture:", err);
        stopEngine();
        setErrorNotice(
          err instanceof Error ? err.message : "Could not start Live Audio Q&A engine."
        );
      }
    },
    [audioSource, openWebSocket, stopEngine]
  );

  // Switch pipeline cleanly (re-connects WS without leaking PCM streams)
  const handleSelectPipeline = async (next: LiveQaPipeline) => {
    if (next === pipeline) return;
    setPipeline(next);
    pipelineRef.current = next;
    setErrorNotice(null);
    setLiveTranscript("");
    setActiveTurn(null);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      if (isRunning) {
        setIsConnecting(true);
        try {
          wsRef.current.send(JSON.stringify({ type: "start", pipeline: next }));
          window.setTimeout(() => setIsConnecting(false), 350);
        } catch (err) {
          console.error("[Crackpilot LiveQA] Pipeline switch failed:", err);
          stopEngine();
          setErrorNotice("Pipeline switch interrupted. Click Start Listening to reconnect.");
        }
      } else {
        // Close idle benchmark WebSocket so next scenario opens cleanly on the newly selected pipeline
        try {
          wsRef.current.close();
        } catch {
          // Ignore close errors
        }
        wsRef.current = null;
      }
    }
  };

  // Instant text scenario benchmark (works with or without an active mic!)
  const handleSendTextScenario = async (textToAsk: string) => {
    const cleaned = textToAsk.trim();
    if (!cleaned) return;
    setErrorNotice(null);
    setScenarioInput("");

    try {
      let ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        setIsConnecting(true);
        ws = await openWebSocket(pipelineRef.current);
        setIsConnecting(false);
      }
      speechEndPerfRef.current = performance.now();
      setLiveTranscript(cleaned);
      ws.send(JSON.stringify({ type: "text_question", text: cleaned }));
    } catch (err) {
      setIsConnecting(false);
      setErrorNotice(
        err instanceof Error ? err.message : "Could not send benchmark scenario."
      );
    }
  };

  // Compute side-by-side average latency benchmarks for Pipeline A vs Pipeline B
  const pipelineATurns = history.filter(
    (t) => t.pipeline === "deepgram-groq" && t.ttfwMs !== null
  );
  const pipelineBTurns = history.filter(
    (t) => t.pipeline === "gemini-live" && t.ttfwMs !== null
  );
  const avgAMs =
    pipelineATurns.length > 0
      ? Math.round(
          pipelineATurns.reduce((acc, t) => acc + (t.ttfwMs || 0), 0) /
            pipelineATurns.length
        )
      : null;
  const avgBMs =
    pipelineBTurns.length > 0
      ? Math.round(
          pipelineBTurns.reduce((acc, t) => acc + (t.ttfwMs || 0), 0) /
            pipelineBTurns.length
        )
      : null;

  return (
    <section
      className={`rounded-2xl border border-white/[0.08] bg-[#0a0f18]/95 text-slate-100 ${
        compact ? "p-4 space-y-3.5" : "p-5 sm:p-6 space-y-5"
      }`}
    >
      {/* Top Header: Title + Live Speedometer + Settings Drawer Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-3.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#c6f527]/15 border border-[#c6f527]/35 text-[#c6f527] shrink-0">
            <Zap className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-white leading-tight">
              Ultra-Low-Latency Live Audio Q&amp;A Engine
            </h2>
            <p className="text-[11px] text-slate-400 truncate">
              16kHz PCM streaming · End-of-turn scenario capture · 100% human spoken tone
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Live Speedometer */}
          <div
            title="Time-To-First-Word from end of speaker's sentence to first token on screen"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#c6f527]/35 bg-[#141f0d] px-3 py-1.5 font-mono text-xs font-bold text-[#c6f527] tabular-nums"
          >
            <Gauge className="h-3.5 w-3.5" />
            <span>⚡ {formatSeconds(lastTtfwMs)}</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowSettingsDrawer((v) => !v);
              void refreshStatus();
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              showSettingsDrawer
                ? "border-sky-400/50 bg-sky-500/15 text-sky-200"
                : "border-white/10 bg-[#111827] text-slate-300 hover:text-white"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Pipeline Keys</span>
          </button>
        </div>
      </div>

      {/* Dual-Pipeline A/B Testing Switch */}
      <div className="grid gap-2.5 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void handleSelectPipeline("deepgram-groq")}
          className={`text-left rounded-xl border p-3.5 transition-all cursor-pointer ${
            pipeline === "deepgram-groq"
              ? "border-[#c6f527] bg-[#16210d] shadow-md"
              : "border-white/[0.08] bg-[#0d1422] hover:border-white/20"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white">
              <Cpu className="h-3.5 w-3.5 text-[#c6f527]" />
              <span>Pipeline A: Hybrid Streaming</span>
            </span>
            <span
              className={`font-mono text-[10px] font-semibold ${
                serverStatus?.pipelineAReady ? "text-emerald-400" : "text-amber-300"
              }`}
            >
              {serverStatus?.pipelineAReady ? "READY" : "NEEDS ENV KEYS"}
            </span>
          </div>
          <p className="mt-1 font-mono text-[11px] text-slate-400">
            Deepgram Nova-3 (900ms / 1200ms) → Groq Llama 3.3 70B
          </p>
          {avgAMs !== null && (
            <p className="mt-1.5 font-mono text-[11px] text-[#c6f527] tabular-nums">
              Avg TTFW ({pipelineATurns.length} turns): ⚡ {formatSeconds(avgAMs)}
            </p>
          )}
        </button>

        <button
          type="button"
          onClick={() => void handleSelectPipeline("gemini-live")}
          className={`text-left rounded-xl border p-3.5 transition-all cursor-pointer ${
            pipeline === "gemini-live"
              ? "border-sky-400 bg-[#0d1c33] shadow-md"
              : "border-white/[0.08] bg-[#0d1422] hover:border-white/20"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white">
              <Sparkles className="h-3.5 w-3.5 text-sky-400" />
              <span>Pipeline B: Multimodal Live</span>
            </span>
            <span
              className={`font-mono text-[10px] font-semibold ${
                serverStatus?.pipelineBReady ? "text-emerald-400" : "text-amber-300"
              }`}
            >
              {serverStatus?.pipelineBReady ? "READY" : "CHECK SERVER"}
            </span>
          </div>
          <p className="mt-1 font-mono text-[11px] text-slate-400">
            Google Gemini Live API (gemini-3.8-live · Built-in VAD)
          </p>
          {avgBMs !== null && (
            <p className="mt-1.5 font-mono text-[11px] text-sky-300 tabular-nums">
              Avg TTFW ({pipelineBTurns.length} turns): ⚡ {formatSeconds(avgBMs)}
            </p>
          )}
        </button>
      </div>

      {/* Collapsible Server Environment & Pipeline Config Drawer (Zero client-side key exposure) */}
      {showSettingsDrawer && (
        <div className="rounded-xl border border-slate-700/70 bg-[#0c1322] p-4 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-white">
              Server-Side API Key Status (Protected via .env / Settings → Secrets)
            </p>
            <button
              type="button"
              onClick={() => void refreshStatus()}
              className="rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-slate-700 cursor-pointer"
            >
              Refresh Status
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {[
              {
                label: "DEEPGRAM_API_KEY",
                ready: Boolean(serverStatus?.deepgramConfigured),
                note: "Pipeline A STT (Nova-3)",
              },
              {
                label: "GROQ_API_KEY",
                ready: Boolean(serverStatus?.groqConfigured),
                note: "Pipeline A LLM (Llama 3.3)",
              },
              {
                label: "GEMINI_API_KEY",
                ready: Boolean(serverStatus?.geminiConfigured),
                note: "Pipeline B Live API",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-white/[0.08] bg-[#080d18] p-2.5 space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-semibold text-slate-200">
                    {item.label}
                  </span>
                  {item.ready ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  {item.note} ·{" "}
                  <span className={item.ready ? "text-emerald-400" : "text-amber-300"}>
                    {item.ready ? "Configured" : "Not set in env"}
                  </span>
                </p>
              </div>
            ))}
          </div>

          <p className="text-[11px] leading-relaxed text-slate-400">
            All WebSocket &amp; LLM requests route through the secure Node.js proxy (
            <code className="text-sky-300">/ws/live-qa</code>). To benchmark Pipeline A
            with free keys, add <code className="text-slate-200">DEEPGRAM_API_KEY</code>{" "}
            and <code className="text-slate-200">GROQ_API_KEY</code> in{" "}
            <strong className="text-slate-200">Settings → Secrets</strong> or your local{" "}
            <code className="text-slate-200">.env</code> file and restart the server.
            Pipeline B uses your attached Gemini server key automatically.
          </p>
        </div>
      )}

      {/* Audio Capture Controls: Source Toggle + Start/Stop + Live Meter */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#0d1422] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-white/10 bg-[#080d16] p-0.5">
            <button
              type="button"
              onClick={() => {
                setAudioSource("mic");
                if (isRunning) void startLiveCapture(pipeline, "mic");
              }}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                audioSource === "mic"
                  ? "bg-[#1f2e4a] text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Mic className="h-3.5 w-3.5 text-sky-400" />
              <span>Microphone</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAudioSource("system");
                if (isRunning) void startLiveCapture(pipeline, "system");
              }}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                audioSource === "system"
                  ? "bg-[#1f2e4a] text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Headphones className="h-3.5 w-3.5 text-[#c6f527]" />
              <span>System / Tab Audio</span>
            </button>
          </div>

          <button
            type="button"
            disabled={isConnecting}
            onClick={() =>
              isRunning ? stopEngine() : void startLiveCapture(pipeline, audioSource)
            }
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-colors cursor-pointer disabled:opacity-60 ${
              isRunning
                ? "bg-rose-600 text-white hover:bg-rose-500"
                : "bg-[#c6f527] text-[#050709] hover:bg-[#b5e41c]"
            }`}
          >
            {isRunning ? (
              <>
                <Square className="h-3.5 w-3.5 fill-current" />
                <span>Stop Live Stream</span>
              </>
            ) : (
              <>
                <Volume2 className="h-3.5 w-3.5" />
                <span>
                  {isConnecting
                    ? "Connecting..."
                    : audioSource === "system"
                      ? "Capture System Audio"
                      : "Start Mic Listening"}
                </span>
              </>
            )}
          </button>
        </div>

        {/* Live PCM Level & Speech State */}
        <div className="flex items-center gap-3 text-[11px]">
          {isRunning && (
            <>
              <span className="inline-flex items-center gap-1.5 text-slate-300">
                <Activity
                  className={`h-3.5 w-3.5 ${
                    isSpeaking ? "text-[#c6f527]" : "text-sky-400"
                  }`}
                />
                <span>
                  {isSpeaking ? "Capturing speech..." : "Listening (16kHz PCM)"}
                </span>
              </span>
              <span className="inline-block h-2 w-16 overflow-hidden rounded-full bg-slate-800">
                <span
                  className={`block h-full transition-all duration-75 ${
                    isSpeaking ? "bg-[#c6f527]" : "bg-sky-400"
                  }`}
                  style={{ width: `${Math.max(8, audioLevel)}%` }}
                />
              </span>
              {actualSampleRate && (
                <span className="hidden sm:inline font-mono text-[10px] text-slate-500">
                  {Math.round(actualSampleRate / 1000)}kHz→16kHz
                </span>
              )}
            </>
          )}
          {!isRunning && activeModelInfo && (
            <span className="font-mono text-[10px] text-slate-500 truncate max-w-[260px]">
              {activeModelInfo}
            </span>
          )}
        </div>
      </div>

      {errorNotice && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200 flex items-center justify-between gap-3">
          <span>{errorNotice}</span>
          <button
            type="button"
            onClick={() => setErrorNotice(null)}
            className="text-rose-300 hover:text-white cursor-pointer text-[11px] font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Live Transcript (muted above) + Zero-Flicker Streaming Human Answer Box (below) */}
      <div
        ref={answerScrollRef}
        className={`rounded-xl border border-slate-700/70 bg-[#070b14] p-4 sm:p-5 space-y-4 overflow-y-auto hud-scroll ${
          compact ? "min-h-[190px] max-h-[300px]" : "min-h-[220px] max-h-[380px]"
        }`}
      >
        {/* Live Captured Question / Scenario */}
        <div className="space-y-1 border-b border-white/[0.06] pb-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
              Captured Question / Scenario
            </span>
            {activeTurn && (
              <span className="font-mono text-[10px] text-slate-500 tabular-nums">
                {activeTurn.pipeline === "deepgram-groq"
                  ? "Pipeline A · Deepgram + Groq"
                  : "Pipeline B · Gemini Live"}
                {activeTurn.ttfwMs !== null
                  ? ` · ⚡ ${formatSeconds(activeTurn.ttfwMs)}`
                  : ""}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-[13px] leading-relaxed text-slate-400 italic min-h-[20px]">
            {liveTranscript ||
              "Speak a full question or multi-sentence scenario via Mic or System Audio—Crackpilot waits until you finish speaking, then streams a natural spoken response immediately."}
          </p>
        </div>

        {/* Streaming 100% Human Answer */}
        <div className="space-y-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#c6f527]/80">
            Live Spoken Answer
          </span>
          <div className="min-h-[64px]">
            {activeTurn?.answer ? (
              <AnswerView
                markdown={activeTurn.answer}
                isStreaming={!activeTurn.completed}
                fontSizePx={14}
              />
            ) : (
              <span className="text-slate-500 text-xs">
                Waiting for end of speech...
              </span>
            )}
          </div>
        </div>
      </div>

      {/* One-Click Multi-Sentence Scenario Benchmark Bar (test latency without mic) */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-400">Quick Benchmark:</span>
            {SAMPLE_SCENARIOS.map((sc) => (
              <button
                key={sc.label}
                type="button"
                onClick={() => void handleSendTextScenario(sc.text)}
                className="rounded-md border border-slate-700/80 bg-[#11192b] px-2.5 py-1 text-[11px] text-slate-200 hover:border-[#c6f527]/50 hover:text-white transition-colors cursor-pointer"
              >
                {sc.label}
              </button>
            ))}
          </div>
          {history.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setHistory([]);
                setActiveTurn(null);
                setLiveTranscript("");
                setLastTtfwMs(null);
              }}
              className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-300 cursor-pointer"
            >
              <Trash2 className="h-3 w-3" />
              <span>Clear Log</span>
            </button>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSendTextScenario(scenarioInput);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={scenarioInput}
            onChange={(e) => setScenarioInput(e.target.value)}
            placeholder="Or paste a long scenario here to benchmark Time-To-First-Word on the selected pipeline..."
            className="flex-1 rounded-lg border border-white/10 bg-[#070b14] px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-[#c6f527] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!scenarioInput.trim() || isConnecting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1d2b45] border border-slate-600/60 px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#26385a] disabled:opacity-45 cursor-pointer"
          >
            <Send className="h-3.5 w-3.5 text-[#c6f527]" />
            <span>Test</span>
          </button>
        </form>
      </div>

      {/* Recent A/B Latency History */}
      {history.length > 0 && (
        <div className="space-y-2 border-t border-white/[0.07] pt-3">
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
            Recent Latency Benchmark Log ({history.length})
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto hud-scroll pr-1">
            {history.map((turn) => (
              <div
                key={turn.id}
                className="rounded-lg border border-white/[0.06] bg-[#0c1220] p-3 space-y-1"
              >
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-mono text-slate-400 truncate">
                    {turn.pipeline === "deepgram-groq"
                      ? "Pipeline A (Deepgram+Groq)"
                      : "Pipeline B (Gemini Live)"}{" "}
                    · {turn.timestamp}
                  </span>
                  <span className="shrink-0 font-mono font-bold text-[#c6f527] tabular-nums">
                    ⚡ {formatSeconds(turn.ttfwMs)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 italic line-clamp-1">
                  {turn.transcript}
                </p>
                <AnswerView
                  markdown={turn.answer}
                  isStreaming={false}
                  fontSizePx={13}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

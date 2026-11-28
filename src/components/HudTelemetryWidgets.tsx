import React, { useEffect, useRef, useState } from "react";
import { Check, Copy, Volume2, Zap } from "lucide-react";
import { AnswerView } from "./AnswerView";
import { DsaTeleprompterView } from "./DsaTeleprompterView";
import type { QAItem } from "../types";

function formatTimerDisplay(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

interface SessionTimerDisplayProps {
  initialSeconds: number;
  syncVersion: number;
  isRunning: boolean;
  isEngineRunning: boolean;
  unsyncedSecondsRef: React.MutableRefObject<number>;
  onTimeExhausted: () => void;
}

/**
 * Isolated 1-second countdown timer.
 * Owns its own local tick state so 1Hz timer updates NEVER re-render
 * SoftwareOverlay or the Q&A feed.
 */
export const SessionTimerDisplay = React.memo(function SessionTimerDisplay({
  initialSeconds,
  syncVersion,
  isRunning,
  isEngineRunning,
  unsyncedSecondsRef,
  onTimeExhausted,
}: SessionTimerDisplayProps) {
  const [secondsLeft, setSecondsLeft] = useState<number>(initialSeconds);
  const onTimeExhaustedRef = useRef(onTimeExhausted);
  onTimeExhaustedRef.current = onTimeExhausted;

  useEffect(() => {
    setSecondsLeft(Math.max(0, Math.floor(initialSeconds)));
  }, [initialSeconds, syncVersion]);

  useEffect(() => {
    if (!isRunning) return;
    const intervalId = window.setInterval(() => {
      unsyncedSecondsRef.current += 1;
      setSecondsLeft((prev) => {
        const next = prev > 0 ? prev - 1 : 0;
        if (next === 0) {
          window.clearInterval(intervalId);
          onTimeExhaustedRef.current();
        }
        return next;
      });
    }, 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [isRunning, unsyncedSecondsRef]);

  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums whitespace-nowrap">
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          isEngineRunning ? "bg-[#b4f416]" : "bg-amber-400/80"
        }`}
      />
      <span>Time:</span>
      <strong className="inline-block min-w-[44px] font-mono font-semibold text-white tabular-nums">
        {formatTimerDisplay(secondsLeft)}
      </strong>
      <span
        className={`font-mono text-[10px] uppercase tracking-wider ${
          isEngineRunning ? "text-[#b4f416]" : "text-amber-300"
        }`}
      >
        {isEngineRunning ? "Running" : "Paused"}
      </span>
    </span>
  );
});

interface AudioLevelMeterProps {
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  audioCtxRef: React.MutableRefObject<AudioContext | null>;
  isListening: boolean;
  label: string;
}

/**
 * Isolated GPU-composited audio level bar.
 * Runs its own requestAnimationFrame loop and updates transform: scaleX(...)
 * directly on the DOM node with ZERO React re-renders and ZERO layout reflows.
 */
export const AudioLevelMeter = React.memo(function AudioLevelMeter({
  analyserRef,
  audioCtxRef,
  isListening,
  label,
}: AudioLevelMeterProps) {
  const barRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const barEl = barRef.current;
    if (!isListening) {
      if (barEl) {
        barEl.style.transform = "scaleX(0)";
        barEl.style.backgroundColor = "rgba(52, 211, 153, 0.6)";
      }
      return;
    }

    let rafId: number | null = null;
    let smoothedLevel = 0;
    let dataBuffer: Uint8Array<ArrayBuffer> | null = null;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      try {
        const ctx = audioCtxRef.current;
        const analyser = analyserRef.current;
        const el = barRef.current;
        if (ctx && ctx.state === "suspended") {
          void ctx.resume().catch(() => {});
        }
        if (analyser && el) {
          if (!dataBuffer || dataBuffer.length !== analyser.fftSize) {
            dataBuffer = new Uint8Array(analyser.fftSize);
          }
          analyser.getByteTimeDomainData(dataBuffer);
          let sum = 0;
          for (let i = 0; i < dataBuffer.length; i++) {
            const v = (dataBuffer[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / dataBuffer.length);
          const targetLevel = Math.min(100, Math.round(rms * 520));
          smoothedLevel =
            targetLevel > smoothedLevel
              ? targetLevel
              : Math.max(0, Math.round(smoothedLevel * 0.82 + targetLevel * 0.18));

          const scale = Math.max(0.06, Math.min(1, smoothedLevel / 100));
          el.style.transform = `scaleX(${scale.toFixed(3)})`;
          el.style.backgroundColor =
            smoothedLevel > 12 ? "#b4f416" : "rgba(52, 211, 153, 0.65)";
        }
      } catch {
        // Ignore transient AudioContext teardown frames
      }
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      if (barRef.current) {
        barRef.current.style.transform = "scaleX(0)";
      }
    };
  }, [analyserRef, audioCtxRef, isListening]);

  return (
    <>
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-medium whitespace-nowrap ${
          isListening ? "text-[#c6f527]" : "text-slate-400"
        }`}
      >
        <span>{label}</span>
      </span>
      <span
        aria-label="Live audio input level"
        className="relative inline-block h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-slate-800"
      >
        <span
          ref={barRef}
          className="block h-full w-full origin-left will-change-transform rounded-full"
          style={{
            transform: "scaleX(0)",
            backgroundColor: "rgba(52, 211, 153, 0.6)",
          }}
        />
      </span>
    </>
  );
});

interface QACardItemProps {
  item: QAItem;
  fontSizePx: number;
  questionFontPx: number;
  isCopied: boolean;
  isSpeaking: boolean;
  onCopy: (item: QAItem) => void;
  onSpeak: (item: QAItem) => void;
}

/**
 * Memoized Q&A card so live streaming into card #0 does not re-render
 * historical Q&A cards below it in the scroll feed.
 */
export const QACardItem = React.memo(function QACardItem({
  item,
  fontSizePx,
  questionFontPx,
  isCopied,
  isSpeaking,
  onCopy,
  onSpeak,
}: QACardItemProps) {
  return (
    <article className="rounded-xl border border-slate-700/60 bg-[#0e1525]/92 px-5 py-4 shadow-lg">
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
          {typeof item.latencyMs === "number" && (
            <span
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold tabular-nums ${
                item.latencyMs < 1000
                  ? "border-[#b4f416]/45 bg-[#b4f416]/15 text-[#d9ff66]"
                  : "border-sky-500/40 bg-sky-500/15 text-sky-200"
              }`}
              title="Time to first streamed answer token"
            >
              <Zap className="h-2.5 w-2.5" />
              <span>{item.latencyMs}ms</span>
            </span>
          )}
          {item.id !== "system-init" && item.answer && (
            <button
              type="button"
              onClick={() => onSpeak(item)}
              title="Read aloud"
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                isSpeaking
                  ? "border-sky-500/50 bg-sky-500/20 text-sky-200"
                  : "border-slate-700/80 bg-[#172136] text-slate-300 hover:text-white"
              }`}
            >
              <Volume2 className="h-3 w-3" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onCopy(item)}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-700/80 bg-[#172136] px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-700/80 transition-colors cursor-pointer"
          >
            {isCopied ? (
              <Check className="h-3 w-3 text-emerald-400" />
            ) : (
              <Copy className="h-3 w-3 text-slate-400" />
            )}
            <span>{isCopied ? "Copied" : "Copy"}</span>
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
          ) : item.dsaData ? (
            <DsaTeleprompterView data={item.dsaData} fontSizePx={fontSizePx} />
          ) : item.answer ? (
            <AnswerView
              markdown={item.answer}
              isStreaming={item.isStreaming}
              fontSizePx={fontSizePx}
            />
          ) : item.isStreaming ? (
            <span className="inline-block h-4 w-1.5 animate-pulse rounded-sm bg-sky-400/80 align-middle" />
          ) : (
            <span className="text-xs text-slate-500/80">...</span>
          )}
        </div>
      </div>
    </article>
  );
});

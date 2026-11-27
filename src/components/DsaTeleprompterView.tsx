import { useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  HelpCircle,
  LayoutList,
  Lightbulb,
  Play,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import type { DsaTeleprompterData, OaQuestionKind } from "../types";

interface DsaTeleprompterViewProps {
  data: DsaTeleprompterData;
  fontSizePx?: number;
}

const STEP_META = [
  { num: 1, short: "1. Breakdown", title: "Step 1 · Problem Breakdown & Pattern" },
  { num: 2, short: "2. Clarify", title: "Step 2 · Clarifying Questions & Fallbacks" },
  { num: 3, short: "3. Brute Force", title: "Step 3 · Brute Force Approach" },
  { num: 4, short: "4. Optimal", title: "Step 4 · Optimization & Optimal Code" },
  { num: 5, short: "5. Dry Run", title: "Step 5 · Spoken Dry Run & Edge Cases" },
] as const;

const OA_KIND_LABEL: Record<OaQuestionKind, string> = {
  full_coding: "OA · Full Coding",
  debugging: "OA · Bug Fix / Debugging",
  mcq: "OA · Multiple Choice (MCQ)",
  work_style: "OA · Work-Style / Behavioral",
};

function CopyableCodeBlock({
  code,
  language,
  label,
}: {
  code: string;
  language: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-[#07090d] overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.07] bg-[#0e1218] px-3 py-1.5">
        <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-300">
          <Terminal className="h-3.5 w-3.5 text-[#b4f416]" />
          <span className="font-semibold text-[#b4f416]">{language}</span>
          {label && <span className="text-zinc-500">· {label}</span>}
        </div>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-zinc-200 hover:border-[#b4f416]/50 hover:text-white transition-colors cursor-pointer"
        >
          {copied ? (
            <Check className="h-3 w-3 text-[#b4f416]" />
          ) : (
            <Copy className="h-3 w-3 text-zinc-400" />
          )}
          <span>{copied ? "Copied" : "Copy Code"}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 font-mono text-xs leading-relaxed text-zinc-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function DsaTeleprompterView({
  data,
  fontSizePx = 14,
}: DsaTeleprompterViewProps) {
  // Always start at Step 1 so optimal code is NEVER dumped prematurely in live coding interviews
  const [activeStep, setActiveStep] = useState<number>(1);
  const [showAllSteps, setShowAllSteps] = useState<boolean>(false);

  const textStyle = { fontSize: `${fontSizePx}px` };

  if (data.assessmentType === "online_assessment" && data.oa) {
    const oa = data.oa;
    const lang = oa.language || data.problemContext.preferredLanguage;
    return (
      <div className="space-y-3 rounded-xl border border-[#b4f416]/30 bg-[#0a0a0a] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-[#b4f416] px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase tracking-wide text-[#0a0a0a]">
              {OA_KIND_LABEL[oa.questionKind] || "Online Assessment"}
            </span>
            <span className="rounded-md border border-white/10 bg-[#111111] px-2 py-0.5 font-mono text-[10px] text-zinc-300">
              {data.problemContext.topicPattern}
            </span>
            {oa.code && (
              <span className="rounded-md border border-[#b4f416]/35 bg-[#b4f416]/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#b4f416]">
                {lang}
              </span>
            )}
          </div>
          <span className="font-mono text-[11px] font-semibold text-white">
            {data.problemContext.title}
          </span>
        </div>

        {/* Direct Answer Highlight */}
        <div className="rounded-xl border border-[#b4f416]/40 bg-[#141a0b] p-3.5 space-y-1.5">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#b4f416]">
            Direct Answer
          </p>
          <p
            style={textStyle}
            className="font-semibold text-white leading-relaxed whitespace-pre-wrap"
          >
            {oa.directAnswer}
          </p>
        </div>

        {oa.explanation && (
          <div className="rounded-xl border border-white/[0.08] bg-[#111111] p-3.5">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-zinc-400">
              Concise Reasoning
            </p>
            <p
              style={textStyle}
              className="text-zinc-200 leading-relaxed whitespace-pre-wrap"
            >
              {oa.explanation}
            </p>
          </div>
        )}

        {oa.code && (
          <CopyableCodeBlock
            code={oa.code}
            language={lang}
            label={
              oa.questionKind === "debugging"
                ? "Corrected Fix"
                : "Optimal Passing Code"
            }
          />
        )}

        {(oa.timeComplexity || oa.spaceComplexity || (oa.edgeCases && oa.edgeCases.length > 0)) && (
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#111111] p-3 text-xs">
            {(oa.timeComplexity || oa.spaceComplexity) && (
              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                {oa.timeComplexity && (
                  <span className="rounded-md border border-[#b4f416]/30 bg-[#b4f416]/10 px-2 py-1 text-[#b4f416]">
                    Time: {oa.timeComplexity}
                  </span>
                )}
                {oa.spaceComplexity && (
                  <span className="rounded-md border border-sky-400/30 bg-sky-400/10 px-2 py-1 text-sky-300">
                    Space: {oa.spaceComplexity}
                  </span>
                )}
              </div>
            )}
            {oa.edgeCases && oa.edgeCases.length > 0 && (
              <div className="space-y-1 text-zinc-300">
                <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                  Edge Cases Handled:
                </span>
                <ul className="list-disc pl-4 space-y-0.5 text-xs">
                  {oa.edgeCases.map((ec, i) => (
                    <li key={i}>{ec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Live Coding Interview — Strict 5-Step Teleprompter (Never dumps optimal code prematurely)
  const shouldShowStep = (n: number) => showAllSteps || activeStep === n;

  return (
    <div className="space-y-3.5 rounded-xl border border-[#b4f416]/30 bg-[#0a0a0a] p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-[#b4f416] px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase tracking-wide text-[#0a0a0a]">
            <Code2 className="h-3 w-3" />
            Live Coding Teleprompter
          </span>
          <span className="rounded-md border border-[#b4f416]/35 bg-[#b4f416]/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#b4f416]">
            {data.problemContext.preferredLanguage}
          </span>
          <span className="font-semibold text-xs text-white">
            {data.problemContext.title}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowAllSteps((v) => !v)}
          className="rounded-md border border-white/10 bg-[#111111] px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:border-[#b4f416]/50 hover:text-white transition-colors cursor-pointer"
        >
          {showAllSteps ? "Step-by-Step View" : "Expand All 5 Steps"}
        </button>
      </div>

      {/* 5-Step Navigation Pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        {STEP_META.map((step) => {
          const isCurrent = !showAllSteps && activeStep === step.num;
          const isCompleted = !showAllSteps && step.num < activeStep;
          return (
            <button
              key={step.num}
              type="button"
              onClick={() => {
                setShowAllSteps(false);
                setActiveStep(step.num);
              }}
              className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                isCurrent
                  ? "border-[#b4f416] bg-[#b4f416]/15 text-[#b4f416]"
                  : isCompleted
                    ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
                    : "border-white/10 bg-[#111111] text-zinc-400 hover:border-white/25 hover:text-zinc-100"
              }`}
            >
              {step.short}
            </button>
          );
        })}
      </div>

      {/* STEP 1: Problem Breakdown & Pattern Identification */}
      {shouldShowStep(1) && data.step1 && (
        <div className="rounded-xl border border-white/[0.08] bg-[#111111] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-[#b4f416]">
              <LayoutList className="h-3.5 w-3.5" />
              {STEP_META[0].title}
            </span>
            <span className="rounded-md border border-[#b4f416]/40 bg-[#b4f416]/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#b4f416]">
              Pattern: {data.step1.topicPattern}
            </span>
          </div>
          <p style={textStyle} className="text-zinc-100 leading-relaxed">
            {data.step1.summary}
          </p>
          <div className="rounded-lg border border-white/[0.07] bg-[#0a0a0a] px-3 py-2 text-xs text-zinc-300">
            <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 block mb-0.5">
              I/O &amp; Constraints Summary
            </span>
            {data.step1.ioConstraints}
          </div>
        </div>
      )}

      {/* STEP 2: Clarifying Questions + Anticipated Responses + Standard Fallback Assumptions */}
      {shouldShowStep(2) && data.step2 && (
        <div className="rounded-xl border border-white/[0.08] bg-[#111111] p-4 space-y-3.5">
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-[#b4f416]">
            <HelpCircle className="h-3.5 w-3.5" />
            {STEP_META[1].title}
          </span>

          <div className="space-y-2.5">
            {data.step2.clarifyingQuestions.map((cq, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] p-3 space-y-2"
              >
                <p style={textStyle} className="font-semibold text-white">
                  {idx + 1}. {cq.question}
                </p>
                <div className="grid gap-2 sm:grid-cols-2 text-xs">
                  <div className="rounded-md border border-emerald-500/25 bg-emerald-500/[0.07] px-2.5 py-1.5 text-emerald-200">
                    <span className="font-mono text-[10px] font-bold uppercase text-emerald-400">
                      If Yes →{" "}
                    </span>
                    {cq.ifYes}
                  </div>
                  <div className="rounded-md border border-amber-500/25 bg-amber-500/[0.07] px-2.5 py-1.5 text-amber-200">
                    <span className="font-mono text-[10px] font-bold uppercase text-amber-400">
                      If No →{" "}
                    </span>
                    {cq.ifNo}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Highlighted Standard Fallback Assumptions Box */}
          <div className="rounded-xl border border-[#b4f416]/45 bg-[#151c0a] p-3.5 space-y-1.5">
            <p className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#b4f416]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Standard Fallback Assumptions (State aloud if interviewer says &ldquo;up to you&rdquo;)
            </p>
            <ul className="list-disc pl-4 space-y-1 text-xs text-zinc-100">
              {data.step2.fallbackAssumptions.map((assumption, idx) => (
                <li key={idx}>{assumption}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* STEP 3: Brute Force Approach */}
      {shouldShowStep(3) && data.step3 && (
        <div className="rounded-xl border border-white/[0.08] bg-[#111111] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-[#b4f416]">
              <Play className="h-3.5 w-3.5" />
              {STEP_META[2].title}
            </span>
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="rounded border border-amber-400/35 bg-amber-400/10 px-2 py-0.5 text-amber-300">
                Time: {data.step3.timeComplexity}
              </span>
              <span className="rounded border border-sky-400/35 bg-sky-400/10 px-2 py-0.5 text-sky-300">
                Space: {data.step3.spaceComplexity}
              </span>
            </div>
          </div>
          <p style={textStyle} className="text-zinc-200 leading-relaxed">
            {data.step3.explanation}
          </p>
          {data.step3.code && (
            <CopyableCodeBlock
              code={data.step3.code}
              language={data.step3.language}
              label="Brute Force Baseline"
            />
          )}
        </div>
      )}

      {/* STEP 4: Optimization & Final Optimal Code */}
      {shouldShowStep(4) && data.step4 && (
        <div className="rounded-xl border border-[#b4f416]/30 bg-[#111111] p-4 space-y-3">
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-[#b4f416]">
            <Lightbulb className="h-3.5 w-3.5" />
            {STEP_META[3].title}
          </span>
          <p style={textStyle} className="text-zinc-100 leading-relaxed">
            {data.step4.intuition}
          </p>
          {data.step4.code && (
            <CopyableCodeBlock
              code={data.step4.code}
              language={data.step4.language}
              label="Optimal Solution"
            />
          )}
        </div>
      )}

      {/* STEP 5: Spoken Dry Run, Edge Cases & Complexity */}
      {shouldShowStep(5) && data.step5 && (
        <div className="rounded-xl border border-white/[0.08] bg-[#111111] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-[#b4f416]">
              <AlertTriangle className="h-3.5 w-3.5" />
              {STEP_META[4].title}
            </span>
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="rounded border border-[#b4f416]/40 bg-[#b4f416]/10 px-2 py-0.5 text-[#b4f416]">
                Time: {data.step5.timeComplexity}
              </span>
              <span className="rounded border border-sky-400/35 bg-sky-400/10 px-2 py-0.5 text-sky-300">
                Space: {data.step5.spaceComplexity}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-white/[0.07] bg-[#0a0a0a] p-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
              Spoken Walkthrough (Sample Input)
            </p>
            <p
              style={textStyle}
              className="text-zinc-100 leading-relaxed whitespace-pre-wrap"
            >
              {data.step5.spokenDryRun}
            </p>
          </div>

          {data.step5.edgeCases.length > 0 && (
            <div className="space-y-1.5">
              <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                Edge Cases to Call Out
              </p>
              <div className="flex flex-wrap gap-1.5">
                {data.step5.edgeCases.map((ec, i) => (
                  <span
                    key={i}
                    className="rounded-md border border-white/10 bg-[#0a0a0a] px-2.5 py-1 text-xs text-zinc-200"
                  >
                    {ec}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stepper Footer Navigation */}
      {!showAllSteps && (
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            disabled={activeStep <= 1}
            onClick={() => setActiveStep((s) => Math.max(1, s - 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-[#111111] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-white/25 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Previous Step</span>
          </button>

          <span className="font-mono text-[11px] text-zinc-400">
            Step {activeStep} of 5 · Voice follow-ups auto-bound to this problem
          </span>

          <button
            type="button"
            disabled={activeStep >= 5}
            onClick={() => setActiveStep((s) => Math.min(5, s + 1))}
            className="inline-flex items-center gap-1 rounded-lg bg-[#b4f416] px-3 py-1.5 text-xs font-bold text-[#0a0a0a] hover:bg-[#a3df12] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            <span>Next Step</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

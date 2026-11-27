import { useState } from "react";
import {
  Code2,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { AnswerView } from "./AnswerView";
import { DsaTeleprompterView } from "./DsaTeleprompterView";
import {
  ANSWER_STYLES,
  PROGRAMMING_LANGUAGES,
  normalizeProgrammingLanguage,
} from "../data/roleSkills";
import { apiUrl } from "../lib/api";
import {
  analyzeDsaProblemClient,
  clearActiveProblemContextClient,
} from "../lib/clientStore";
import type {
  ActiveProblemContext,
  AnswerStyle,
  DsaAssessmentType,
  DsaTeleprompterData,
  OaQuestionKind,
  ProgrammingLanguage,
  TargetProfile,
} from "../types";

interface DsaPracticeLabProps {
  profile: TargetProfile;
}

const SAMPLE_PROBLEMS: Array<{
  label: string;
  assessmentType?: DsaAssessmentType;
  oaKind?: OaQuestionKind;
  text: string;
}> = [
  {
    label: "Live Coding · Two Sum",
    assessmentType: "live_coding_interview",
    text: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume that each input would have exactly one solution, and you may not use the same element twice. Constraints: 2 <= nums.length <= 10^4, -10^9 <= nums[i] <= 10^9. Example: nums = [2,7,11,15], target = 9 -> Output: [0,1].",
  },
  {
    label: "OA · Full Coding",
    assessmentType: "online_assessment",
    oaKind: "full_coding",
    text: "Online Assessment Coding Problem: Given a string s, find the length of the longest substring without repeating characters. Constraints: 0 <= s.length <= 5 * 10^4. Example: s = 'abcabcbb' -> Output: 3.",
  },
  {
    label: "OA · Bug Fix",
    assessmentType: "online_assessment",
    oaKind: "debugging",
    text: "Fix the bug in this binary search function so it does not infinite-loop or miss the last element:\ndef binary_search(arr, target):\n  left, right = 0, len(arr)\n  while left < right:\n    mid = (left + right) // 2\n    if arr[mid] == target: return mid\n    elif arr[mid] < target: left = mid\n    else: right = mid\n  return -1",
  },
  {
    label: "OA · MCQ",
    assessmentType: "online_assessment",
    oaKind: "mcq",
    text: "Multiple Choice Question: What is the worst-case time complexity of inserting an element into a balanced Red-Black Tree with N nodes?\nA) O(1)\nB) O(log N)\nC) O(N)\nD) O(N log N)",
  },
  {
    label: "OA · Work-Style",
    assessmentType: "online_assessment",
    oaKind: "work_style",
    text: "Work-Style Assessment: You discover a subtle data race in a payment service 3 hours before a major launch. Fixing it properly takes 4 hours, while a quick patch hides the symptom for now. What should you do?\nA) Ship without mentioning it so the launch stays on schedule.\nB) Apply the quick patch silently and open a low-priority ticket.\nC) Immediately flag the risk to stakeholders with clear data, recommend delaying or feature-flagging the affected path, and fix the root cause properly.\nD) Ask QA to decide whether to ship.",
  },
];

export function DsaPracticeLab({ profile }: DsaPracticeLabProps) {
  // 1. Natural Human-Spoken Style Sandbox
  const [styleQuestion, setStyleQuestion] = useState(
    "How do you handle performance bottlenecks or slow workflows in production?"
  );
  const [selectedStyle, setSelectedStyle] = useState<AnswerStyle>(
    profile.answerStyle
  );
  const [styleAnswer, setStyleAnswer] = useState("");
  const [styleLoading, setStyleLoading] = useState(false);
  const [styleError, setStyleError] = useState<string | null>(null);

  // 2. DSA Coding & Assessment Teleprompter + Context-Aware Follow-Up Sandbox
  const [dsaLang, setDsaLang] = useState<ProgrammingLanguage>(
    normalizeProgrammingLanguage(profile.preferredLanguage)
  );
  const [problemInput, setProblemInput] = useState(SAMPLE_PROBLEMS[0].text);
  const [selectedPresetIdx, setSelectedPresetIdx] = useState<number>(0);
  const [analyzingDsa, setAnalyzingDsa] = useState(false);
  const [dsaError, setDsaError] = useState<string | null>(null);
  const [dsaResult, setDsaResult] = useState<DsaTeleprompterData | null>(null);
  const [activeContext, setActiveContext] =
    useState<ActiveProblemContext | null>(null);

  // Follow-up bound to ActiveProblemContext (no re-capture!)
  const [followUpInput, setFollowUpInput] = useState(
    "What if the array is already sorted—can you solve this with O(1) extra space?"
  );
  const [followUpAnswer, setFollowUpAnswer] = useState("");
  const [followUpLoading, setFollowUpLoading] = useState(false);

  const runSseAnswer = async (
    body: Record<string, unknown>,
    onChunk: (full: string) => void
  ) => {
    const resp = await fetch(apiUrl("/api/answer"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok || !resp.body) {
      throw new Error(`Request failed (${resp.status}).`);
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let accumulated = "";
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
            error?: string;
          };
          if (payload.error) throw new Error(payload.error);
          if (payload.chunk) {
            accumulated += payload.chunk;
            onChunk(accumulated);
          }
        } catch (err) {
          if (err instanceof Error && !err.message.includes("JSON")) {
            throw err;
          }
        }
      }
    }
  };

  const handleTestHumanStyle = async () => {
    if (!styleQuestion.trim()) return;
    setStyleLoading(true);
    setStyleError(null);
    setStyleAnswer("");
    try {
      await runSseAnswer(
        {
          question: styleQuestion.trim(),
          role: profile.role,
          experience: profile.experience,
          skills: profile.skills,
          resumeText: profile.resumeText,
          jdText: profile.jdText,
          answerLanguage: profile.answerLanguage,
          answerStyle: selectedStyle,
          dsaModeEnabled: false,
        },
        setStyleAnswer
      );
    } catch (err) {
      setStyleError(
        err instanceof Error ? err.message : "Could not generate answer."
      );
    } finally {
      setStyleLoading(false);
    }
  };

  const handleAnalyzeDsa = async () => {
    if (!problemInput.trim()) return;
    setAnalyzingDsa(true);
    setDsaError(null);
    setFollowUpAnswer("");
    try {
      const preset = SAMPLE_PROBLEMS[selectedPresetIdx];
      const matchesPreset = preset && preset.text.trim() === problemInput.trim();
      const res = await analyzeDsaProblemClient({
        problemText: problemInput.trim(),
        preferredLanguage: dsaLang,
        answerLanguage: profile.answerLanguage,
        role: profile.role,
        experience: profile.experience,
        source: "text_simulator",
        assessmentTypeOverride: matchesPreset ? preset.assessmentType : undefined,
        oaQuestionKindOverride: matchesPreset ? preset.oaKind : undefined,
      });
      setDsaResult(res.dsaData);
      setActiveContext(res.activeProblemContext);
    } catch (err) {
      setDsaError(
        err instanceof Error ? err.message : "DSA analysis failed."
      );
    } finally {
      setAnalyzingDsa(false);
    }
  };

  const handleAskFollowUp = async () => {
    if (!followUpInput.trim() || !activeContext) return;
    setFollowUpLoading(true);
    setFollowUpAnswer("");
    setDsaError(null);
    try {
      await runSseAnswer(
        {
          question: followUpInput.trim(),
          role: profile.role,
          experience: profile.experience,
          answerLanguage: profile.answerLanguage,
          dsaModeEnabled: true,
          preferredLanguage: dsaLang,
          activeProblemContext: activeContext,
        },
        setFollowUpAnswer
      );
    } catch (err) {
      setDsaError(
        err instanceof Error ? err.message : "Follow-up failed."
      );
    } finally {
      setFollowUpLoading(false);
    }
  };

  const handleClearProblem = async () => {
    await clearActiveProblemContextClient();
    setActiveContext(null);
    setDsaResult(null);
    setFollowUpAnswer("");
  };

  return (
    <div className="space-y-6">
      {/* A. Natural Human-Spoken Answer Style Tester */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#111111] p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-[#b4f416] mt-0.5 shrink-0" />
            <div>
              <h2 className="text-base font-bold text-white">
                Natural Human-Spoken Answer Style Sandbox
              </h2>
              <p className="mt-0.5 text-xs text-zinc-400">
                Compare <strong className="text-zinc-200">Point-to-Point (2–4 sentences)</strong> vs{" "}
                <strong className="text-zinc-200">Detailed Explanation (5–8 sentences)</strong> tailored to{" "}
                <span className="text-[#b4f416]">{profile.role}</span> ({profile.experience}).
              </p>
            </div>
          </div>
          <select
            value={selectedStyle}
            onChange={(e) => setSelectedStyle(e.target.value as AnswerStyle)}
            className="rounded-lg border border-white/10 bg-[#0a0a0a] px-3 py-2 text-xs text-white focus:border-[#b4f416] focus:outline-none"
          >
            {ANSWER_STYLES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={styleQuestion}
            onChange={(e) => setStyleQuestion(e.target.value)}
            placeholder="Ask any role-specific or general interview question..."
            className="flex-1 rounded-lg border border-white/10 bg-[#0a0a0a] px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-[#b4f416] focus:outline-none"
          />
          <button
            type="button"
            disabled={styleLoading || !styleQuestion.trim()}
            onClick={() => void handleTestHumanStyle()}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#b4f416] px-4 py-2.5 text-xs font-bold text-[#0a0a0a] hover:bg-[#a3df12] disabled:opacity-50 cursor-pointer"
          >
            {styleLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            <span>Test Human Answer</span>
          </button>
        </div>

        {styleError && (
          <p className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {styleError}
          </p>
        )}

        {styleAnswer && (
          <div className="rounded-xl border border-white/[0.08] bg-[#0a0a0a] p-4">
            <AnswerView markdown={styleAnswer} isStreaming={styleLoading} fontSizePx={14} />
          </div>
        )}
      </div>

      {/* B. DSA Coding & Assessment Mode Practice Simulator */}
      <div className="rounded-2xl border border-[#b4f416]/25 bg-[#111111] p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Code2 className="h-5 w-5 text-[#b4f416] mt-0.5 shrink-0" />
            <div>
              <h2 className="text-base font-bold text-white">
                DSA Coding &amp; Assessment Teleprompter Simulator
              </h2>
              <p className="mt-0.5 text-xs text-zinc-400">
                Test the 5-step Live Coding teleprompter (no premature code dump), OA Modes (Full Coding / Bug-Fix / MCQ / Work-Style), and zero-recapture follow-ups.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={dsaLang}
              onChange={(e) => setDsaLang(e.target.value as ProgrammingLanguage)}
              className="rounded-lg border border-[#b4f416]/40 bg-[#0a0a0a] px-3 py-1.5 text-xs font-semibold text-[#b4f416] focus:outline-none"
            >
              {PROGRAMMING_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
            {activeContext && (
              <button
                type="button"
                onClick={() => void handleClearProblem()}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-[#0a0a0a] px-2.5 py-1.5 text-xs text-zinc-300 hover:border-rose-500/40 hover:text-rose-300 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear Context</span>
              </button>
            )}
          </div>
        </div>

        {/* Preset Scenario Chips */}
        <div className="flex flex-wrap gap-1.5">
          {SAMPLE_PROBLEMS.map((sample, idx) => (
            <button
              key={sample.label}
              type="button"
              onClick={() => {
                setSelectedPresetIdx(idx);
                setProblemInput(sample.text);
              }}
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                selectedPresetIdx === idx
                  ? "border-[#b4f416] bg-[#b4f416]/15 text-[#b4f416]"
                  : "border-white/10 bg-[#0a0a0a] text-zinc-300 hover:border-white/25 hover:text-white"
              }`}
            >
              {sample.label}
            </button>
          ))}
        </div>

        <textarea
          rows={4}
          value={problemInput}
          onChange={(e) => setProblemInput(e.target.value)}
          placeholder="Paste a LeetCode / HackerRank problem, bug-fix snippet, MCQ, or work-style scenario..."
          className="w-full rounded-xl border border-white/10 bg-[#0a0a0a] p-3 font-mono text-xs text-zinc-100 placeholder-zinc-500 focus:border-[#b4f416] focus:outline-none"
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-zinc-400">
            Active Problem Context:{" "}
            <strong className={activeContext ? "text-[#b4f416]" : "text-zinc-500"}>
              {activeContext
                ? `${activeContext.title} (${activeContext.preferredLanguage})`
                : "None captured yet"}
            </strong>
          </span>
          <button
            type="button"
            disabled={analyzingDsa || !problemInput.trim()}
            onClick={() => void handleAnalyzeDsa()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#b4f416] px-4 py-2 text-xs font-bold text-[#0a0a0a] hover:bg-[#a3df12] disabled:opacity-50 cursor-pointer"
          >
            {analyzingDsa ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Code2 className="h-3.5 w-3.5" />
            )}
            <span>{analyzingDsa ? "Parsing Problem..." : "Analyze & Lock Problem Context"}</span>
          </button>
        </div>

        {dsaError && (
          <p className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {dsaError}
          </p>
        )}

        {dsaResult && <DsaTeleprompterView data={dsaResult} fontSizePx={14} />}

        {/* Context-Aware Follow-Up Box (No Re-Capture Required) */}
        {activeContext && (
          <div className="rounded-xl border border-[#b4f416]/30 bg-[#0a0a0a] p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#b4f416]">
              <MessageSquare className="h-4 w-4" />
              <span>
                Live Voice / Follow-Up Bound to &ldquo;{activeContext.title}&rdquo; (No Re-Capture Needed)
              </span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={followUpInput}
                onChange={(e) => setFollowUpInput(e.target.value)}
                placeholder="e.g. Can you solve this in-place without extra space? / What if input is streaming?"
                className="flex-1 rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-[#b4f416] focus:outline-none"
              />
              <button
                type="button"
                disabled={followUpLoading || !followUpInput.trim()}
                onClick={() => void handleAskFollowUp()}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#b4f416] px-4 py-2 text-xs font-bold text-[#0a0a0a] hover:bg-[#a3df12] disabled:opacity-50 cursor-pointer"
              >
                {followUpLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                <span>Ask Follow-Up</span>
              </button>
            </div>
            {followUpAnswer && (
              <div className="rounded-lg border border-white/[0.07] bg-[#111111] p-3.5">
                <AnswerView
                  markdown={followUpAnswer}
                  isStreaming={followUpLoading}
                  fontSizePx={14}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

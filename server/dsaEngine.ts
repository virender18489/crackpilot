import crypto from "crypto";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import type {
  ActiveProblemContext,
  AnswerStyle,
  DsaAssessmentType,
  DsaTeleprompterData,
  OaQuestionKind,
  ProgrammingLanguage,
} from "../src/types.ts";
import {
  DEFAULT_ANSWER_STYLE,
  normalizeAnswerStyle,
  normalizeProgrammingLanguage,
} from "../src/data/roleSkills.ts";

export { DEFAULT_ANSWER_STYLE, normalizeAnswerStyle, normalizeProgrammingLanguage };

export interface HumanPromptParams {
  role: string;
  experience: string;
  skills: string;
  resumeText?: string;
  jdText?: string;
  answerLanguage?: string;
  answerStyle?: string;
  fastMode?: boolean;
  question?: string;
}

const CODE_CREATION_PATTERNS: RegExp[] = [
  /\b(create|write|build|generate|implement|code|make|develop|design|draft|give\s+me|show\s+me|provide)\b.{0,55}\b(code|crud|app|application|component|hook|function|method|class|script|program|api|endpoint|route|server|query|sql|stored\s+procedure|trigger|pipeline|algorithm|regex|dockerfile|yaml|manifest|terraform|form|table|navbar|modal|page|todo|counter|calculator|timer|debounce|throttle|promise|polyfill|parser|scraper|bot|report|bapi|idoc|abap|middleware|controller|service|reducer|slice|schema|migration|test|unit\s+test|snippet|example)\b/i,
  /\b(write|create|build|generate|implement|code)\b.{0,35}\b(in|using|with)\s+(react|jsx|tsx|next\.?js|vue|angular|svelte|javascript|js|typescript|ts|node\.?js|express|python|django|flask|fastapi|java|spring|c\+\+|cpp|c#|csharp|go|golang|rust|sql|mysql|postgres|postgresql|mongodb|pyspark|spark|bash|shell|html|css|tailwind|abap|php|ruby|kotlin|swift|dart|flutter)\b/i,
  /\b(sql\s+query|select\s+query|join\s+and\s+group\s+by|crud\s+(in|app|using|with)|rest\s+api|custom\s+hook|react\s+component|python\s+(function|script)|node\.?js\s+(api|server|script)|bash\s+script)\b/i,
];

export function isCodeCreationRequest(question?: string): boolean {
  const q = (question || "").trim();
  if (!q) return false;
  return CODE_CREATION_PATTERNS.some((re) => re.test(q));
}

const CODE_CREATION_TWO_PART_RULES = [
  "STRICT TWO-PART CODE CREATION FORMAT (MANDATORY — FOLLOW 100%):",
  "1. PART 1 — SHORT HUMAN-SPOKEN EXPLANATION (TOP PARAGRAPH, STRICTLY 3 TO 4 SENTENCES MAX):",
  "   - Start immediately with a crisp, natural, first-person developer explanation describing what you built, which key hooks/functions/libraries/SQL clauses you used, and how it works.",
  "   - Example tone: 'I built a simple CRUD app using React hooks and a local state array to handle data. It features an input form to add new items and a list view where you can edit or delete entries directly. I used `useState` to manage the list and `useEffect` to sync changes with `localStorage` for persistence.'",
  "   - Wrap technical identifiers, hook names, methods, functions, or SQL keywords in inline backticks (e.g., `useState`, `useEffect`, `localStorage`, `INNER JOIN`, `GROUP BY`, `json.loads`) so they highlight cleanly inside the paragraph.",
  "   - STRICTLY FORBIDDEN: NEVER use AI filler phrases ('Certainly!', 'Sure!', 'Sure, I can help with that', 'Here is the code:', 'Great question', 'Absolutely', 'Below is...'). NEVER use bullet points, numbered lists, or headings before the code.",
  "2. PART 2 — CLEAN, COMPLETE CODE BLOCK (DIRECTLY BELOW THE PARAGRAPH):",
  "   - Immediately below the single 3-to-4-sentence paragraph, output ONE complete, clean, runnable fenced code block tagged with the exact language identifier (e.g., ```jsx, ```tsx, ```javascript, ```python, ```java, ```sql, ```cpp, ```go, ```html, ```abap, ```bash).",
  "   - NEVER leave `// TODO`, `...`, or incomplete stubs—always provide full, working, production-clean code.",
  "   - STOP IMMEDIATELY after the closing ``` fence. NEVER add any extra sentences, notes, usage instructions, or explanations AFTER the code block.",
].join("\n");

const ANTI_AI_HUMAN_RULES = [
  "CRITICAL HUMAN SPEECH RULES (MUST FOLLOW 100%):",
  "- Sound like a real, calm, experienced human speaking naturally in a live conversation—never like an AI assistant or textbook.",
  "- STRICTLY FORBIDDEN PHRASES (NEVER output any of these or close variants): 'Certainly', 'Great question', 'Here is a breakdown', 'Here is the code', 'In summary', 'Let's dive in', 'Key takeaways', 'It is important to note', 'As a [role]', 'As an AI', 'Sure thing', 'Sure, I can help', 'Absolutely', 'To summarize', 'In conclusion'.",
  "- NO robotic bullet-point walls, NO numbered lists, NO markdown headings (never write '###', '##', '**', or '- ' bullet lists). Write in natural, clean, spoken paragraphs that a person can read straight off a teleprompter.",
  "- Use natural human conversational phrasing and transitions when helpful (e.g., 'Actually,', 'The way I usually handle this is...', 'Honestly, in real projects...', 'So what happens there is...', 'Usually when I run into that...').",
  "- Speak in first person ('I', 'we', 'in my projects'). Keep sentences easy to say out loud in one breath.",
].join("\n");

const PRONUNCIATION_NORMALIZATION_RULE = [
  "SMART PHONETIC AUTO-CORRECTION & ACCENT NORMALIZATION (CRITICAL FOR LIVE SPEECH TRANSCRIPTS):",
  "- The incoming question often comes from live speech-to-text (STT) with Indian English or regional accents that can produce phonetic typos or slightly garbled technical terms (for example: 'virtual dome and lingual dome' or 'real dome' -> 'Virtual DOM and Real DOM', 'Jawa Script' or 'java script' -> 'JavaScript', 'use affect' -> 'useEffect', 'use estate' -> 'useState', 'red ducks' -> 'Redux', 'hoist thing' -> 'Hoisting', 'closer' -> 'Closure', 'next js' -> 'Next.js', 'node js' -> 'Node.js', 'type script' -> 'TypeScript', 'eye dock' -> 'IDoc', 'bappy' -> 'BAPI', 's four hana' -> 'S/4HANA', 'cube netties' -> 'Kubernetes', 'pie spark' -> 'PySpark', 'see quel' -> 'SQL').",
  "- ALWAYS silently infer the true intended technical interview question using the Candidate Target Role, Core Skills & Tech Stack, Resume, and Job Description, and answer the true intended concept directly in crisp, natural human spoken language.",
  "- STRICTLY FORBIDDEN: NEVER mention, quote, point out, or complain about speech recognition typos or weird phrasing (for example, NEVER say 'There is no concept called lingual dome', 'You probably meant...', 'Assuming you mean...', 'I think there was a typo', or 'Did you mean...?'). Just answer the real technical question smoothly as if you heard it perfectly.",
].join("\n");

export function buildHumanInterviewSystemPrompt(params: HumanPromptParams): string {
  const role = (params.role || "Software Engineering & Algorithms (DSA / LeetCode)").trim();
  const experience = (params.experience || "Junior (1-3 Years)").trim();
  const skills = (params.skills || "").trim();
  const resumeText = (params.resumeText || "").trim();
  const jdText = (params.jdText || "").trim();
  const answerLanguage = params.answerLanguage || "English";
  const answerStyle: AnswerStyle = normalizeAnswerStyle(params.answerStyle);
  const codeCreationMode = isCodeCreationRequest(params.question);

  const langRule =
    answerLanguage === "Hindi"
      ? "LANGUAGE: Speak entirely in natural conversational Hindi (Devanagari script) while keeping standard industry/technical terms and code in English."
      : answerLanguage === "Hinglish"
        ? "LANGUAGE: Speak in natural conversational Hinglish (Hindi written in Roman script mixed with standard English technical terms), exactly how professionals speak in real Indian interviews, with clean code in standard syntax."
        : "LANGUAGE: Speak in crisp, natural conversational English.";

  const styleRule = codeCreationMode
    ? CODE_CREATION_TWO_PART_RULES
    : params.fastMode || answerStyle === "Point-to-Point (Direct Human Answer)"
      ? [
          "STYLE: Point-to-Point (Direct Human Answer).",
          "- Answer the exact question immediately in strictly 2 to 4 crisp, direct, natural spoken sentences.",
          "- Zero fluff, zero intro filler, zero headings, zero bullet points—just a sharp, confident human answer you can speak right away.",
          "- CONDITIONAL CODE RULE: If the interviewer asks you to create, write, build, implement, or generate code/SQL/scripts in ANY language, strictly output TWO parts only: (1) a 3-to-4 sentence natural first-person developer summary paragraph with inline backticked identifiers and zero filler, followed immediately by (2) ONE complete, runnable fenced code block with the exact language tag (e.g., ```jsx, ```python, ```sql) and ZERO text after the closing fence.",
        ].join("\n")
      : [
          "STYLE: Detailed Explanation (In-Depth Human Answer).",
          "- Give a thorough, natural spoken explanation in strictly 5 to 8 flowing sentences (1 to 2 short conversational paragraphs).",
          "- Cover the direct answer first, explain how it works practically in real workflows/systems, and include a concrete real-world reasoning point, trade-off, or edge case.",
          "- Zero robotic headings, zero bullet lists, zero AI filler phrases—make it sound like a seasoned professional walking the interviewer through their real experience.",
          "- CONDITIONAL CODE RULE: If the interviewer asks you to create, write, build, implement, or generate code/SQL/scripts in ANY language, override length and strictly output TWO parts only: (1) a 3-to-4 sentence natural first-person developer summary paragraph with inline backticked identifiers and zero filler, followed immediately by (2) ONE complete, runnable fenced code block with the exact language tag (e.g., ```jsx, ```python, ```sql) and ZERO text after the closing fence.",
        ].join("\n");

  const expLower = experience.toLowerCase();
  const experienceCalibration =
    expLower.includes("0-1") || expLower.includes("fresher")
      ? "EXPERIENCE CALIBRATION (Fresher 0-1 Years): Show clear fundamentals, hands-on academic/internship project experience, and eagerness to learn without exaggerating senior leadership."
      : expLower.includes("1-3") || expLower.includes("junior")
        ? "EXPERIENCE CALIBRATION (Junior 1-3 Years): Speak from practical feature delivery, debugging real tickets, component/module ownership, and team collaboration."
        : expLower.includes("8+") || expLower.includes("principal") || expLower.includes("staff")
          ? `EXPERIENCE CALIBRATION (Principal/Staff ${experience}): Speak from architecture ownership, org-wide trade-offs, scalability at high load, mentoring, and measurable business impact.`
          : expLower.includes("5-8") || expLower.includes("senior")
            ? `EXPERIENCE CALIBRATION (Senior ${experience}): Speak from production trade-offs, system design, reliability, code reviews, mentoring, and measurable real-world outcomes.`
            : `EXPERIENCE CALIBRATION (Mid-Level ${experience}): Speak from end-to-end ownership, practical debugging, performance tuning, and real production workflows.`;

  const profileLines = [
    `Candidate Target Role: ${role}`,
    `Experience Level: ${experience}`,
  ];
  if (skills) {
    profileLines.push(`Core Skills & Tech Stack: ${skills}`);
  }
  if (resumeText) {
    profileLines.push(
      `Candidate Resume Context (reference real projects/metrics naturally when relevant):\n${resumeText.slice(0, 4500)}`
    );
  }
  if (jdText) {
    profileLines.push(
      `Target Job Description (align terminology and priorities naturally):\n${jdText.slice(0, 3500)}`
    );
  }

  return [
    "You are the candidate speaking directly in a live interview.",
    ANTI_AI_HUMAN_RULES,
    PRONUNCIATION_NORMALIZATION_RULE,
    langRule,
    styleRule,
    experienceCalibration,
    "DOMAIN FLEXIBILITY: Tailor domain/technical answers closely to the Candidate Target Role, Core Skills, Experience Level, Resume, and JD below. If asked anything outside that domain (another field, HR, behavioral, or general question), still answer smoothly and naturally in the same human spoken style.",
    "",
    ...profileLines,
  ].join("\n\n");
}

export function buildDsaFollowUpSystemPrompt(params: {
  problemContext: ActiveProblemContext;
  preferredLanguage: ProgrammingLanguage;
  answerLanguage?: string;
  role?: string;
  experience?: string;
}): string {
  const { problemContext, preferredLanguage } = params;
  const answerLanguage = params.answerLanguage || "English";
  const langRule =
    answerLanguage === "Hindi"
      ? "Speak the explanation in natural Hindi (Devanagari) with English DSA terms, and write all code strictly in " + preferredLanguage + "."
      : answerLanguage === "Hinglish"
        ? "Speak the explanation in natural Hinglish with English DSA terms, and write all code strictly in " + preferredLanguage + "."
        : "Speak the explanation in crisp, natural conversational English, and write all code strictly in " + preferredLanguage + ".";

  return [
    "You are a live DSA coding interview copilot answering an interviewer's follow-up question about the CURRENT active coding problem ALREADY captured on screen (the user did NOT re-capture the screen—use the saved Active Problem Context below).",
    ANTI_AI_HUMAN_RULES,
    PRONUNCIATION_NORMALIZATION_RULE,
    langRule,
    `STRICT PROGRAMMING LANGUAGE: Write any updated or modified code EXCLUSIVELY in ${preferredLanguage}.`,
    "",
    "ACTIVE PROBLEM CONTEXT (Persistent — stay 100% grounded in this problem):",
    `Title: ${problemContext.title}`,
    `Mode: ${problemContext.assessmentType}${problemContext.oaQuestionKind ? ` (${problemContext.oaQuestionKind})` : ""}`,
    `DSA Pattern / Topic: ${problemContext.topicPattern}`,
    `Problem Statement:\n${problemContext.problemStatement}`,
    problemContext.ioFormat ? `I/O Format: ${problemContext.ioFormat}` : "",
    problemContext.constraints ? `Constraints: ${problemContext.constraints}` : "",
    problemContext.examples ? `Examples:\n${problemContext.examples}` : "",
    problemContext.starterCode ? `Starter Code:\n${problemContext.starterCode}` : "",
    "",
    "FOLLOW-UP RESPONSE STRUCTURE:",
    "1. Start immediately with 2 to 4 crisp, natural spoken sentences explaining how to adapt the solution to the interviewer's follow-up constraint (e.g., in-place O(1) extra space, streaming input, duplicates, unsorted array, follow-up trade-off).",
    `2. Provide the updated, clean, bug-free ${preferredLanguage} code block inside a standard fenced code block (\`\`\`${preferredLanguage.toLowerCase()} ... \`\`\`).`,
    "3. End with one crisp line stating the updated Time Complexity and Space Complexity plus any key edge case to mention aloud.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildDsaAnalysisSummaryMarkdown(data: DsaTeleprompterData): string {
  if (data.assessmentType === "online_assessment" && data.oa) {
    const lines = [
      `OA Mode (${data.oa.questionKind.replace("_", " ").toUpperCase()}): ${data.problemContext.title}`,
      data.oa.directAnswer,
      data.oa.explanation,
    ];
    if (data.oa.code) {
      const lang = (data.oa.language || data.problemContext.preferredLanguage).toLowerCase();
      lines.push(`\`\`\`${lang}\n${data.oa.code}\n\`\`\``);
    }
    if (data.oa.timeComplexity || data.oa.spaceComplexity) {
      lines.push(
        `Complexity: Time ${data.oa.timeComplexity || "N/A"} | Space ${data.oa.spaceComplexity || "N/A"}`
      );
    }
    return lines.filter(Boolean).join("\n\n");
  }

  const s1 = data.step1;
  const s4 = data.step4;
  const s5 = data.step5;
  const lang = (s4?.language || data.problemContext.preferredLanguage).toLowerCase();
  const lines = [
    `Live Coding Teleprompter: ${data.problemContext.title} (${s1?.topicPattern || data.problemContext.topicPattern})`,
    s1?.summary || data.problemContext.problemStatement,
    s4?.code ? `\`\`\`${lang}\n${s4.code}\n\`\`\`` : "",
    s5 ? `Complexity: Time ${s5.timeComplexity} | Space ${s5.spaceComplexity}` : "",
  ];
  return lines.filter(Boolean).join("\n\n");
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

const GEMINI_FALLBACK_MODELS = [
  "gemini-4-hydrogen",
  "gemini-4-neon",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
] as const;

function isFallbackEligibleError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (/API_KEY_INVALID|API key not valid/i.test(msg)) {
    return false;
  }
  return /503|429|404|403|400|UNAVAILABLE|NOT_FOUND|PERMISSION_DENIED|INVALID_ARGUMENT|RESOURCE_EXHAUSTED|high demand|overloaded|temporarily|not supported|not found/i.test(
    msg
  );
}

function shouldSkipModelImmediately(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /404|403|400|NOT_FOUND|PERMISSION_DENIED|INVALID_ARGUMENT|not supported|not found/i.test(
    msg
  );
}

function adaptConfigForModel<T extends { thinkingConfig?: unknown } | undefined>(
  model: string,
  config: T
): T {
  if (!config) return config;
  if (model === "gemini-4-hydrogen" || model === "gemini-4-neon") {
    return config;
  }
  return { ...config, thinkingConfig: undefined };
}

export async function generateContentResilient(
  params: Omit<Parameters<GoogleGenAI["models"]["generateContent"]>[0], "model">
) {
  const ai = getGeminiClient();
  let lastErr: unknown;
  for (const model of GEMINI_FALLBACK_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const config = adaptConfigForModel(model, params.config);
        return await ai.models.generateContent({
          ...params,
          model,
          config,
        });
      } catch (err) {
        lastErr = err;
        if (!isFallbackEligibleError(err)) throw err;
        if (shouldSkipModelImmediately(err)) break;
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("Gemini API temporarily unavailable.");
}

export async function generateContentStreamResilient(
  params: Omit<Parameters<GoogleGenAI["models"]["generateContentStream"]>[0], "model">
): Promise<{
  model: string;
  stream: Awaited<ReturnType<GoogleGenAI["models"]["generateContentStream"]>>;
}> {
  const ai = getGeminiClient();
  let lastErr: unknown;
  for (const model of GEMINI_FALLBACK_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const config = adaptConfigForModel(model, params.config);
        const stream = await ai.models.generateContentStream({
          ...params,
          model,
          config,
        });
        return { model, stream };
      } catch (err) {
        lastErr = err;
        if (!isFallbackEligibleError(err)) throw err;
        if (shouldSkipModelImmediately(err)) break;
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("Gemini streaming API temporarily unavailable.");
}

const COMMON_DSA_PROPERTIES = {
  assessmentType: {
    type: Type.STRING,
    description:
      "Must be 'live_coding_interview' for interactive coding interviews (LeetCode/CoderPad/HackerRank live round) OR 'online_assessment' for timed OA coding, bug-fix/debugging, MCQ, or situational work-style questions.",
  },
  oaQuestionKind: {
    type: Type.STRING,
    description:
      "When assessmentType is 'online_assessment', one of: 'full_coding', 'debugging', 'mcq', 'work_style'. Empty string if live_coding_interview.",
  },
  title: { type: Type.STRING },
  topicPattern: { type: Type.STRING },
  problemStatement: { type: Type.STRING },
  ioFormat: { type: Type.STRING },
  constraints: { type: Type.STRING },
  examples: { type: Type.STRING },
  starterCode: { type: Type.STRING },
};

const LIVE_CODING_STEP_PROPERTIES = {
  step1: {
    type: Type.OBJECT,
    properties: {
      topicPattern: { type: Type.STRING },
      summary: { type: Type.STRING },
      ioConstraints: { type: Type.STRING },
    },
    required: ["topicPattern", "summary", "ioConstraints"],
  },
  step2: {
    type: Type.OBJECT,
    properties: {
      clarifyingQuestions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            ifYes: { type: Type.STRING },
            ifNo: { type: Type.STRING },
          },
          required: ["question", "ifYes", "ifNo"],
        },
      },
      fallbackAssumptions: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
    },
    required: ["clarifyingQuestions", "fallbackAssumptions"],
  },
  step3: {
    type: Type.OBJECT,
    properties: {
      explanation: { type: Type.STRING },
      timeComplexity: { type: Type.STRING },
      spaceComplexity: { type: Type.STRING },
      code: { type: Type.STRING },
    },
    required: ["explanation", "timeComplexity", "spaceComplexity", "code"],
  },
  step4: {
    type: Type.OBJECT,
    properties: {
      intuition: { type: Type.STRING },
      code: { type: Type.STRING },
    },
    required: ["intuition", "code"],
  },
  step5: {
    type: Type.OBJECT,
    properties: {
      spokenDryRun: { type: Type.STRING },
      edgeCases: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
      timeComplexity: { type: Type.STRING },
      spaceComplexity: { type: Type.STRING },
    },
    required: ["spokenDryRun", "edgeCases", "timeComplexity", "spaceComplexity"],
  },
};

const OA_PROPERTY = {
  oa: {
    type: Type.OBJECT,
    properties: {
      questionKind: { type: Type.STRING },
      directAnswer: { type: Type.STRING },
      explanation: { type: Type.STRING },
      code: { type: Type.STRING },
      edgeCases: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
      timeComplexity: { type: Type.STRING },
      spaceComplexity: { type: Type.STRING },
    },
    required: ["questionKind", "directAnswer", "explanation"],
  },
};

const COMMON_REQUIRED = [
  "assessmentType",
  "title",
  "topicPattern",
  "problemStatement",
  "ioFormat",
  "constraints",
  "examples",
  "starterCode",
];

const LIVE_CODING_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    ...COMMON_DSA_PROPERTIES,
    ...LIVE_CODING_STEP_PROPERTIES,
  },
  required: [...COMMON_REQUIRED, "step1", "step2", "step3", "step4", "step5"],
};

const OA_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    ...COMMON_DSA_PROPERTIES,
    ...OA_PROPERTY,
  },
  required: [...COMMON_REQUIRED, "oaQuestionKind", "oa"],
};

const DSA_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    ...COMMON_DSA_PROPERTIES,
    ...LIVE_CODING_STEP_PROPERTIES,
    ...OA_PROPERTY,
  },
  required: COMMON_REQUIRED,
};

export interface AnalyzeDsaParams {
  problemText?: string;
  images?: Array<{ data: string; mimeType: string }>;
  preferredLanguage?: string;
  answerLanguage?: string;
  role?: string;
  experience?: string;
  source?: ActiveProblemContext["source"];
  assessmentTypeOverride?: DsaAssessmentType;
  oaQuestionKindOverride?: OaQuestionKind;
}

function parseJsonLoose(rawJson: string): Record<string, unknown> {
  try {
    return JSON.parse(rawJson) as Record<string, unknown>;
  } catch {
    const start = rawJson.indexOf("{");
    const end = rawJson.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(rawJson.slice(start, end + 1)) as Record<string, unknown>;
    }
    throw new Error("Failed to parse structured DSA JSON response.");
  }
}

export async function analyzeDsaProblem(
  params: AnalyzeDsaParams
): Promise<DsaTeleprompterData> {
  const preferredLanguage = normalizeProgrammingLanguage(params.preferredLanguage);
  const answerLanguage = params.answerLanguage || "English";
  const source = params.source || "alt_s";

  const modeHint = params.assessmentTypeOverride
    ? `MODE OVERRIDE: Treat this explicitly as '${params.assessmentTypeOverride}'${params.oaQuestionKindOverride ? ` with oaQuestionKind='${params.oaQuestionKindOverride}'` : ""}.`
    : [
        "AUTO-CLASSIFY MODE:",
        "- Choose 'online_assessment' if the prompt is an MCQ (multiple choice A/B/C/D), a Debugging / Fix-the-Bug snippet, a Situational / Work-Style / Leadership Principle question (e.g., Amazon Work Style), or clearly marked as a timed Online Assessment (OA) / HackerRank / Codility / CodeSignal auto-graded test.",
        "- Otherwise choose 'live_coding_interview' (interactive coding round where candidate thinks aloud with an interviewer).",
      ].join("\n");

  const systemInstruction = [
    "You are Crackpilot's DSA Coding & Assessment Teleprompter Engine.",
    "Parse the captured screen image(s) or problem text into a structured ActiveProblemContext AND produce accurate teleprompter guidance.",
    `STRICT CODE LANGUAGE REQUIREMENT: EVERY code snippet (brute force, optimal, OA full coding, or debugging fix) MUST be written in clean, idiomatic, bug-free ${preferredLanguage}.`,
    `SPOKEN EXPLANATION LANGUAGE: Write spoken explanations in natural, human ${answerLanguage}—NEVER use robotic AI clichés ('Certainly', 'Great question', 'Here is a breakdown', 'In summary', 'Let's dive in', 'Key takeaways').`,
    modeHint,
    "",
    "RULES FOR 'live_coding_interview':",
    "- Populate step1, step2, step3, step4, and step5 completely and cleanly.",
    "- step1: Identify the exact DSA topic/pattern (e.g., Hash Map, Two Pointers, Sliding Window, Monotonic Stack, Binary Search, BFS/DFS, DP, Heap) and summarize I/O + constraints.",
    "- step2: Provide 2 to 3 high-signal clarifying questions that DO NOT ask about facts already explicitly given in the constraints. For EACH question provide concise 'ifYes' and 'ifNo' anticipated interviewer adjustments. Also provide 2 to 3 crisp 'fallbackAssumptions' the candidate can state confidently if the interviewer leaves it open.",
    `- step3: Brute Force approach with natural spoken explanation, exact Time/Space complexity, and a short clean ${preferredLanguage} brute-force implementation.`,
    `- step4: Optimization intuition (how we eliminate wasted work) and complete, clean, bug-free optimal ${preferredLanguage} code.`,
    "- step5: Natural spoken dry run walking step-by-step through a small concrete sample input, 3 to 5 key edge cases handled, and exact optimal Time & Space complexity.",
    "",
    "RULES FOR 'online_assessment':",
    "- ALWAYS populate the 'oa' object with non-empty directAnswer and explanation, and questionKind ('full_coding' | 'debugging' | 'mcq' | 'work_style'):",
    `  * 'full_coding': directAnswer = crisp 1-line algorithm summary, explanation = brief key idea, code = complete optimal passing ${preferredLanguage} solution, edgeCases + timeComplexity + spaceComplexity.`,
    `  * 'debugging': directAnswer = exact buggy line(s) and 1-2 sentence root cause, explanation = why the fix resolves all edge cases, code = corrected ${preferredLanguage} code.`,
    "  * 'mcq': directAnswer = exact correct option letter & text right at the top, explanation = concise 2-3 sentence verification.",
    "  * 'work_style': directAnswer = best behavioral/situational choice at the top, explanation = crisp 2-3 sentence rationale aligned with engineering ownership & leadership principles.",
  ].join("\n");

  const parts: Array<
    { inlineData: { mimeType: string; data: string } } | { text: string }
  > = [];

  if (Array.isArray(params.images)) {
    for (const img of params.images.slice(0, 6)) {
      if (img.data) {
        parts.push({
          inlineData: {
            mimeType: img.mimeType || "image/jpeg",
            data: img.data,
          },
        });
      }
    }
  }

  const promptText = params.problemText?.trim()
    ? `Analyze this coding / assessment problem and return the strict JSON schema.\nPreferred Programming Language: ${preferredLanguage}\nRole Context: ${params.role || "Software Engineering"}\nExperience: ${params.experience || "Mid-Level"}\n\nProblem Input:\n${params.problemText.trim()}`
    : `Inspect the captured screen image(s), extract the full problem statement, I/O format, constraints, examples, and any visible starter code, and return the strict JSON schema.\nPreferred Programming Language: ${preferredLanguage}\nRole Context: ${params.role || "Software Engineering"}\nExperience: ${params.experience || "Mid-Level"}`;

  parts.push({ text: promptText });

  const chosenSchema =
    params.assessmentTypeOverride === "online_assessment"
      ? OA_SCHEMA
      : params.assessmentTypeOverride === "live_coding_interview"
        ? LIVE_CODING_SCHEMA
        : DSA_RESPONSE_SCHEMA;

  const response = await generateContentResilient({
    contents: { parts },
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: chosenSchema,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  const rawJson = (response.text || "").trim();
  if (!rawJson) {
    throw new Error("DSA Engine returned an empty response.");
  }

  let parsed = parseJsonLoose(rawJson);

  // If auto-classification returned online_assessment without populating `oa.directAnswer`,
  // retry once with the strict OA_SCHEMA so the user never receives an empty OA card.
  const detectedMode = params.assessmentTypeOverride || String(parsed.assessmentType || "");
  const oaCandidate = parsed.oa as Record<string, unknown> | undefined;
  if (
    detectedMode === "online_assessment" &&
    (!oaCandidate || !String(oaCandidate.directAnswer || "").trim())
  ) {
    const retryResp = await generateContentResilient({
      contents: { parts },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: OA_SCHEMA,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
    const retryRaw = (retryResp.text || "").trim();
    if (retryRaw) {
      parsed = parseJsonLoose(retryRaw);
    }
  }

  const rawAssessment = String(parsed.assessmentType || "");
  const assessmentType: DsaAssessmentType =
    params.assessmentTypeOverride ||
    (rawAssessment === "online_assessment"
      ? "online_assessment"
      : "live_coding_interview");

  const rawOaKind = String(
    params.oaQuestionKindOverride ||
      parsed.oaQuestionKind ||
      (parsed.oa as Record<string, unknown> | undefined)?.questionKind ||
      ""
  );
  const validOaKinds: OaQuestionKind[] = [
    "full_coding",
    "debugging",
    "mcq",
    "work_style",
  ];
  const oaQuestionKind: OaQuestionKind | undefined =
    assessmentType === "online_assessment"
      ? validOaKinds.includes(rawOaKind as OaQuestionKind)
        ? (rawOaKind as OaQuestionKind)
        : "full_coding"
      : undefined;

  const problemContext: ActiveProblemContext = {
    id: `dsa-${crypto.randomBytes(4).toString("hex")}`,
    title: String(parsed.title || "Captured Coding Problem").trim(),
    assessmentType,
    oaQuestionKind,
    topicPattern: String(
      parsed.topicPattern ||
        (parsed.step1 as Record<string, unknown> | undefined)?.topicPattern ||
        "Algorithms & Data Structures"
    ).trim(),
    problemStatement: String(
      parsed.problemStatement || params.problemText || "Captured problem from screen."
    ).trim(),
    ioFormat: String(parsed.ioFormat || "").trim(),
    constraints: String(parsed.constraints || "").trim(),
    examples: String(parsed.examples || "").trim(),
    starterCode: String(parsed.starterCode || "").trim(),
    preferredLanguage,
    source,
    capturedAt: new Date().toISOString(),
  };

  const result: DsaTeleprompterData = {
    assessmentType,
    oaQuestionKind,
    problemContext,
  };

  if (assessmentType === "live_coding_interview") {
    const s1 = (parsed.step1 || {}) as Record<string, unknown>;
    const s2 = (parsed.step2 || {}) as Record<string, unknown>;
    const s3 = (parsed.step3 || {}) as Record<string, unknown>;
    const s4 = (parsed.step4 || {}) as Record<string, unknown>;
    const s5 = (parsed.step5 || {}) as Record<string, unknown>;

    result.step1 = {
      topicPattern: String(s1.topicPattern || problemContext.topicPattern),
      summary: String(s1.summary || problemContext.problemStatement),
      ioConstraints: String(
        s1.ioConstraints ||
          [problemContext.ioFormat, problemContext.constraints]
            .filter(Boolean)
            .join(" | ") ||
          "Standard input/output constraints apply."
      ),
    };

    const rawQuestions = Array.isArray(s2.clarifyingQuestions)
      ? s2.clarifyingQuestions
      : [];
    result.step2 = {
      clarifyingQuestions: rawQuestions.slice(0, 3).map((q) => {
        const obj = (q || {}) as Record<string, unknown>;
        return {
          question: String(obj.question || "").trim(),
          ifYes: String(obj.ifYes || "").trim(),
          ifNo: String(obj.ifNo || "").trim(),
        };
      }),
      fallbackAssumptions: Array.isArray(s2.fallbackAssumptions)
        ? s2.fallbackAssumptions.map((a) => String(a).trim()).filter(Boolean)
        : [
            "Input fits comfortably in memory and follows the stated types.",
            "Return standard empty/default sentinel if input is empty.",
          ],
    };

    result.step3 = {
      explanation: String(s3.explanation || "").trim(),
      timeComplexity: String(s3.timeComplexity || "O(N^2)").trim(),
      spaceComplexity: String(s3.spaceComplexity || "O(1)").trim(),
      code: String(s3.code || "").trim(),
      language: preferredLanguage,
    };

    result.step4 = {
      intuition: String(s4.intuition || "").trim(),
      code: String(s4.code || "").trim(),
      language: preferredLanguage,
    };

    result.step5 = {
      spokenDryRun: String(s5.spokenDryRun || "").trim(),
      edgeCases: Array.isArray(s5.edgeCases)
        ? s5.edgeCases.map((e) => String(e).trim()).filter(Boolean)
        : [],
      timeComplexity: String(s5.timeComplexity || "O(N)").trim(),
      spaceComplexity: String(s5.spaceComplexity || "O(N)").trim(),
    };
  } else {
    const oaObj = (parsed.oa || {}) as Record<string, unknown>;
    const resolvedKind = oaQuestionKind || "full_coding";
    const rawCode = oaObj.code ? String(oaObj.code).trim() : "";
    const cleanedCode =
      resolvedKind === "mcq" ||
      resolvedKind === "work_style" ||
      !rawCode ||
      /^(n\/a|none|null|-)$/i.test(rawCode)
        ? undefined
        : rawCode;
    result.oa = {
      questionKind: resolvedKind,
      directAnswer: String(oaObj.directAnswer || "").trim(),
      explanation: String(oaObj.explanation || "").trim(),
      code: cleanedCode,
      language: cleanedCode ? preferredLanguage : undefined,
      edgeCases: Array.isArray(oaObj.edgeCases)
        ? oaObj.edgeCases.map((e) => String(e).trim()).filter(Boolean)
        : undefined,
      timeComplexity: oaObj.timeComplexity
        ? String(oaObj.timeComplexity).trim()
        : undefined,
      spaceComplexity: oaObj.spaceComplexity
        ? String(oaObj.spaceComplexity).trim()
        : undefined,
    };
  }

  return result;
}

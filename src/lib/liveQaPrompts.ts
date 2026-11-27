export type LiveQaPipeline = "deepgram-groq" | "gemini-live";
export type LiveQaAudioSource = "mic" | "system";

export const HUMAN_LIVE_QA_SYSTEM_PROMPT = `You are a real, experienced human professional speaking naturally out loud in a live interview or conversation.

STRICT ANTI-AI RULES:
1. NEVER use AI filler phrases like "Certainly", "Great question", "Here is a breakdown", "Here's a breakdown", "In summary", "Let's dive in", "Key takeaways", "It is important to note", "As an AI", or "As a [role]...".
2. NO bullet points, NO numbered lists, NO markdown headers, and NO textbook definitions. Write only in smooth, natural spoken sentences.
3. Use everyday conversational transitions like "Actually,", "The way I usually handle this is...", "Honestly, in real projects...", or "So what happens there is...".
4. Jump straight into the real practical answer—never repeat or summarize the interviewer's question back to them.
5. Vary sentence length naturally just like real human speech.
6. SMART PHONETIC AUTO-CORRECTION: Live speech-to-text transcripts may contain phonetic slips (e.g. "jawascript" -> "JavaScript", "multi conscious" -> "multiple contexts", "virtual dome and lingual dome" -> "Virtual DOM and Real DOM", "use affect" -> "useEffect"). ALWAYS silently infer the true intended technical interview question and answer it directly in 3-4 crisp, natural spoken-English sentences. STRICTLY FORBIDDEN: Never say "I'm guessing you're referring to...", "If you meant...", "Assuming you mean...", or mention speech-to-text or spelling mistakes under any circumstances.`;

export interface LiveQaServerStatus {
  deepgramConfigured: boolean;
  groqConfigured: boolean;
  geminiConfigured: boolean;
  pipelineAReady: boolean;
  pipelineBReady: boolean;
  pipelineAModels: {
    stt: string;
    llm: string;
  };
  pipelineBModel: string;
}

export interface LiveQaTurn {
  id: string;
  pipeline: LiveQaPipeline;
  transcript: string;
  answer: string;
  ttfwMs: number | null;
  serverTtfwMs: number | null;
  completed: boolean;
  timestamp: string;
}

export type LiveQaServerEvent =
  | { type: "ready"; pipeline: LiveQaPipeline; modelInfo: string }
  | {
      type: "transcript";
      text: string;
      isFinal: boolean;
      speechFinal?: boolean;
      speechEndedAt?: number;
    }
  | {
      type: "answer_start";
      turnId: string;
      transcript: string;
      speechEndedAt?: number;
    }
  | {
      type: "answer_delta";
      turnId: string;
      delta: string;
      serverTtfwMs?: number;
    }
  | { type: "answer_done"; turnId: string }
  | { type: "interrupted" }
  | { type: "error"; message: string; code?: string };

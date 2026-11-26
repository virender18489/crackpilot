export type LiveQaPipeline = "deepgram-groq" | "gemini-live";
export type LiveQaAudioSource = "mic" | "system";

export const HUMAN_LIVE_QA_SYSTEM_PROMPT = `You are a real, experienced professional speaking directly in a live conversation. Answer any question from any domain naturally as a human talks out loud.

STRICT RULES:
1. NEVER use AI filler phrases like "Certainly", "Great question", "Here's a breakdown", "In summary", "As an AI", or "It's important to note".
2. NO bullet points, NO numbered lists, NO bold markdown headers, and NO textbook definitions. Write only in smooth, natural spoken sentences (3 to 5 sentences max).
3. Use natural first-person phrasing and conversational connectors like "Actually,", "The way I usually handle that is...", "Honestly, the main trick there is...", or "So what happens in that case is...".
4. For long scenarios, jump straight into the practical solution—never repeat or summarize the user's question back to them.
5. Vary sentence length naturally—mix short punchy thoughts with slightly detailed explanations, just like real human speech.`;

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

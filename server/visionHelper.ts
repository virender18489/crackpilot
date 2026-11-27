import { GoogleGenAI } from "@google/genai";

export const SCREEN_VISION_SYSTEM_PROMPT =
  "You are reading a screenshot of the user's screen (such as a code editor, Notepad, terminal, or coding assessment). Ignore any CrackPilot UI overlay. Read all visible code or questions carefully. If code is shown, state the **Exact Output** first on its own clear line (e.g., `Output: Amit, John`), followed by a brief, clear explanation of how it works or the exact fix if there is a bug. If a multiple-choice or written question is shown, state the exact correct answer first, then a short explanation.";

export const GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
export const GEMINI_VISION_MODEL = "gemini-2.5-flash";

function readCleanKey(name: string): string {
  const raw = (process.env[name] || "").trim().replace(/^['"]|['"]$/g, "");
  if (!raw || /your_|placeholder/i.test(raw)) return "";
  return raw;
}

export interface NormalizedImageInput {
  base64: string;
  mimeType: string;
  dataUrl: string;
}

/**
 * Accepts either a base64 data URL (`image: "data:image/jpeg;base64,..."`) or
 * raw `imageBase64` + `mimeType`. Returns null if missing or empty.
 */
export function normalizeImagePayload(payload: {
  image?: unknown;
  imageBase64?: unknown;
  mimeType?: unknown;
}): NormalizedImageInput | null {
  let rawImage = "";
  let mimeType =
    typeof payload.mimeType === "string" && payload.mimeType.trim()
      ? payload.mimeType.split(";")[0].trim()
      : "image/jpeg";

  if (typeof payload.image === "string" && payload.image.trim()) {
    rawImage = payload.image.trim();
  } else if (
    typeof payload.imageBase64 === "string" &&
    payload.imageBase64.trim()
  ) {
    rawImage = payload.imageBase64.trim();
  }

  if (!rawImage) return null;

  let base64 = rawImage;
  const dataUrlMatch = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(
    rawImage
  );
  if (dataUrlMatch) {
    mimeType = dataUrlMatch[1].toLowerCase();
    base64 = dataUrlMatch[2].replace(/\s+/g, "");
  } else {
    base64 = rawImage.replace(/\s+/g, "");
  }

  // Reject empty or clearly corrupt payloads (< 64 base64 chars)
  if (base64.length < 64) {
    return null;
  }

  return {
    base64,
    mimeType,
    dataUrl: `data:${mimeType};base64,${base64}`,
  };
}

export interface StreamVisionParams {
  image: NormalizedImageInput;
  question?: string;
  answerLanguage?: string;
  sendEvent: (payload: Record<string, unknown>) => void;
}

async function streamGeminiVision(params: {
  apiKey: string;
  image: NormalizedImageInput;
  systemPrompt: string;
  userPrompt: string;
  sendEvent: (payload: Record<string, unknown>) => void;
}): Promise<{ emittedChars: number; model: string }> {
  const ai = new GoogleGenAI({
    apiKey: params.apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  const stream = await ai.models.generateContentStream({
    model: GEMINI_VISION_MODEL,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: params.image.mimeType,
            data: params.image.base64,
          },
        },
        {
          text: params.userPrompt,
        },
      ],
    },
    config: {
      systemInstruction: params.systemPrompt,
      temperature: 0.15,
      maxOutputTokens: 700,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  let metaSent = false;
  let emittedChars = 0;

  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) {
      if (!metaSent) {
        metaSent = true;
        params.sendEvent({
          meta: { engine: "gemini", model: GEMINI_VISION_MODEL },
        });
      }
      emittedChars += text.length;
      params.sendEvent({ chunk: text, text });
    }
  }

  return { emittedChars, model: GEMINI_VISION_MODEL };
}

async function streamOpenAICompatibleVision(params: {
  url: string;
  apiKey: string;
  model: string;
  engine: "groq" | "openai";
  image: NormalizedImageInput;
  systemPrompt: string;
  userPrompt: string;
  sendEvent: (payload: Record<string, unknown>) => void;
}): Promise<{ emittedChars: number; model: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 14_000);

  let upstream: Response;
  try {
    upstream = await fetch(params.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: params.model,
        stream: true,
        temperature: 0.15,
        max_tokens: 700,
        messages: [
          { role: "system", content: params.systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: params.userPrompt },
              {
                type: "image_url",
                image_url: { url: params.image.dataUrl },
              },
            ],
          },
        ],
      }),
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => "");
    throw new Error(
      `${params.engine} vision (${params.model}) HTTP ${upstream.status}: ${errText.slice(0, 180)}`
    );
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let metaSent = false;
  let emittedChars = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const raw = trimmed.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;
      try {
        const parsed = JSON.parse(raw) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          if (!metaSent) {
            metaSent = true;
            params.sendEvent({
              meta: { engine: params.engine, model: params.model },
            });
          }
          emittedChars += delta.length;
          params.sendEvent({ chunk: delta, text: delta });
        }
      } catch {
        // Ignore partial JSON frames
      }
    }
  }

  return { emittedChars, model: params.model };
}

/**
 * Streams a real multimodal Vision AI analysis over SSE.
 * Priority 1: Gemini `gemini-2.5-flash` (GEMINI_API_KEY)
 * Priority 2: Groq Vision `meta-llama/llama-4-scout-17b-16e-instruct` (GROQ_API_KEY)
 * Priority 3: OpenAI `gpt-4o-mini` (OPENAI_API_KEY, if configured)
 * NEVER falls back to a text-only model (eliminates hallucinations).
 */
export async function streamScreenVisionSSE(
  params: StreamVisionParams
): Promise<void> {
  const geminiKey = readCleanKey("GEMINI_API_KEY");
  const groqKey = readCleanKey("GROQ_API_KEY");
  const openaiKey = readCleanKey("OPENAI_API_KEY");

  const langHint =
    params.answerLanguage && params.answerLanguage !== "English"
      ? `\n\nExplain in natural ${params.answerLanguage} while keeping all code, identifiers, and exact Output values verbatim.`
      : "";

  const systemPrompt = `${SCREEN_VISION_SYSTEM_PROMPT}${langHint}`;
  const customNote =
    params.question &&
    params.question.trim() &&
    !/^screen capture/i.test(params.question.trim())
      ? ` User note: "${params.question.trim()}".`
      : "";
  const userPrompt = `Inspect this screenshot carefully (ignoring any CrackPilot overlay). Read all visible code, terminal output, Notepad text, or interview/assessment questions and respond directly.${customNote}`;

  const errors: string[] = [];

  // Primary Vision Model: Gemini 2.5 Flash (inlineData, thinkingBudget: 0, fast SSE)
  if (geminiKey) {
    try {
      const { emittedChars } = await streamGeminiVision({
        apiKey: geminiKey,
        image: params.image,
        systemPrompt,
        userPrompt,
        sendEvent: params.sendEvent,
      });
      if (emittedChars > 0) {
        params.sendEvent({ done: true });
        return;
      }
      errors.push("Gemini Vision returned an empty response.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[Vision] Gemini 2.5 Flash failed, trying Groq Vision:", msg);
      errors.push(`Gemini (${GEMINI_VISION_MODEL}): ${msg.slice(0, 140)}`);
    }
  }

  // Secondary Vision Model: Groq Multimodal Llama 4 Scout
  if (groqKey) {
    try {
      const { emittedChars } = await streamOpenAICompatibleVision({
        url: "https://api.groq.com/openai/v1/chat/completions",
        apiKey: groqKey,
        model: GROQ_VISION_MODEL,
        engine: "groq",
        image: params.image,
        systemPrompt,
        userPrompt,
        sendEvent: params.sendEvent,
      });
      if (emittedChars > 0) {
        params.sendEvent({ done: true });
        return;
      }
      errors.push("Groq Vision returned an empty response.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[Vision] Groq Vision failed:", msg);
      errors.push(`Groq (${GROQ_VISION_MODEL}): ${msg.slice(0, 140)}`);
    }
  }

  // Optional Tertiary Vision Model: OpenAI gpt-4o-mini (only if key present)
  if (openaiKey && openaiKey.startsWith("sk-")) {
    try {
      const { emittedChars } = await streamOpenAICompatibleVision({
        url: "https://api.openai.com/v1/chat/completions",
        apiKey: openaiKey,
        model: "gpt-4o-mini",
        engine: "openai",
        image: params.image,
        systemPrompt,
        userPrompt,
        sendEvent: params.sendEvent,
      });
      if (emittedChars > 0) {
        params.sendEvent({ done: true });
        return;
      }
      errors.push("OpenAI Vision returned an empty response.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`OpenAI (gpt-4o-mini): ${msg.slice(0, 140)}`);
    }
  }

  const diagnostic =
    !geminiKey && !groqKey && !openaiKey
      ? "Vision capture failed: no vision API key (GEMINI_API_KEY or GROQ_API_KEY) is configured on the server."
      : `Vision analysis failed on all configured multimodal models (${errors.join(" | ") || "unknown error"}). Verify GEMINI_API_KEY (gemini-2.5-flash) or GROQ_API_KEY vision quota.`;

  params.sendEvent({ error: diagnostic });
}

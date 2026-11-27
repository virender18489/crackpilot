export const GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models";
export const GROQ_CHAT_COMPLETIONS_URL =
  "https://api.groq.com/openai/v1/chat/completions";

export const DEFAULT_GROQ_CHAT_MODEL = "llama-3.1-8b-instant";

export const PREFERRED_GROQ_MODELS = [
  "llama-3.1-8b-instant",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
] as const;

const NON_CHAT_MODEL_PATTERN =
  /whisper|guard|tts|playai|embed|rerank|moderation|safeguard|prompt-guard|orpheus|distil-whisper|allam|compound-beta|speech/i;

const CACHE_TTL_MS = 5 * 60 * 1000;

interface GroqModelCacheEntry {
  keyFingerprint: string;
  candidates: string[];
  fetchedAt: number;
}

let modelCache: GroqModelCacheEntry | null = null;

function fingerprintKey(apiKey: string): string {
  return apiKey.slice(0, 8) + ":" + apiKey.length;
}

export function invalidateGroqModelCache(): void {
  modelCache = null;
}

export async function getGroqCandidateModels(
  apiKey: string,
  forceRefresh = false
): Promise<string[]> {
  const keyFp = fingerprintKey(apiKey);
  if (
    !forceRefresh &&
    modelCache &&
    modelCache.keyFingerprint === keyFp &&
    Date.now() - modelCache.fetchedAt < CACHE_TTL_MS &&
    modelCache.candidates.length > 0
  ) {
    return modelCache.candidates;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const resp = await fetch(GROQ_MODELS_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (resp.ok) {
      const payload = (await resp.json()) as {
        data?: Array<{ id?: string; active?: boolean }>;
      };
      const activeIds = (payload.data || [])
        .filter((m) => typeof m.id === "string" && m.id.trim().length > 0)
        .filter((m) => m.active !== false)
        .map((m) => m.id!.trim())
        .filter((id) => !NON_CHAT_MODEL_PATTERN.test(id));

      if (activeIds.length > 0) {
        const activeSet = new Set(activeIds);
        const ordered: string[] = [];

        for (const preferred of PREFERRED_GROQ_MODELS) {
          if (activeSet.has(preferred)) {
            ordered.push(preferred);
          }
        }
        for (const id of activeIds) {
          if (!ordered.includes(id)) {
            ordered.push(id);
          }
        }

        const candidates = ordered.slice(0, 4);
        modelCache = {
          keyFingerprint: keyFp,
          candidates,
          fetchedAt: Date.now(),
        };
        return candidates;
      }
    }
  } catch {
    // Fall through to default preferred model list
  }

  const fallbackCandidates = [...PREFERRED_GROQ_MODELS];
  modelCache = {
    keyFingerprint: keyFp,
    candidates: fallbackCandidates,
    fetchedAt: Date.now() - CACHE_TTL_MS + 30_000, // Short 30s TTL when lookup failed
  };
  return fallbackCandidates;
}

export async function resolveActiveGroqChatModel(
  apiKey: string,
  forceRefresh = false
): Promise<string> {
  const candidates = await getGroqCandidateModels(apiKey, forceRefresh);
  return candidates[0] || DEFAULT_GROQ_CHAT_MODEL;
}

export interface StreamGroqChatParams {
  apiKey: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  onMeta?: (model: string) => void;
  onDelta: (text: string) => void;
}

export async function streamGroqChatCompletion(
  params: StreamGroqChatParams
): Promise<{ model: string; emittedChars: number }> {
  const candidates = await getGroqCandidateModels(params.apiKey);
  const modelsToTry = candidates.slice(0, 2);
  let lastError: Error = new Error("Groq chat completion unavailable.");

  for (let i = 0; i < modelsToTry.length; i++) {
    const model = modelsToTry[i];
    const upstream = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      signal: params.signal,
      body: JSON.stringify({
        model,
        stream: true,
        temperature: params.temperature ?? 0.35,
        max_tokens: params.maxTokens ?? 1400,
        messages: params.messages,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const errBody = await upstream.text().catch(() => "");
      lastError = new Error(
        `Groq upstream status ${upstream.status}${errBody ? `: ${errBody.slice(0, 140)}` : ""}`
      );
      if (upstream.status === 404 || /model_not_found|decommissioned/i.test(errBody)) {
        invalidateGroqModelCache();
        continue;
      }
      // For 400/401/403/429/5xx, immediately abort Groq so caller falls back to Gemini
      throw lastError;
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let metaSent = false;
    let emittedChars = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const dataStr = trimmed.slice(5).trim();
        if (!dataStr || dataStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(dataStr) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            if (!metaSent) {
              metaSent = true;
              params.onMeta?.(model);
            }
            emittedChars += delta.length;
            params.onDelta(delta);
          }
        } catch {
          // Ignore incomplete SSE fragments
        }
      }
    }

    if (emittedChars > 0) {
      return { model, emittedChars };
    }

    lastError = new Error(`Groq model ${model} returned an empty stream.`);
  }

  throw lastError;
}

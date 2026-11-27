import type { IncomingMessage, ServerResponse } from "http";
import { GoogleGenAI } from "@google/genai";
import {
  GROQ_WHISPER_TECH_PROMPT,
  transcribeWithDeepgramEnglish,
  transcribeWithGroqWhisperEnglish,
} from "../server/sttConfig.ts";

interface TranscribeMeta {
  language?: string;
  role?: string;
  experience?: string;
  skills?: string;
  jdText?: string;
}

interface TranscribeJsonBody extends TranscribeMeta {
  audioBase64?: string;
  mimeType?: string;
}

const MAX_AUDIO_BYTES = 12 * 1024 * 1024; // 12 MB safety cap
const MIN_WAV_BYTES = 44 + 12800; // 44-byte header + >=0.4s @ 16kHz 16-bit mono

function readCleanKey(name: string): string {
  const raw = (process.env[name] || "").trim().replace(/^['"]|['"]$/g, "");
  if (!raw || /your_|placeholder/i.test(raw)) return "";
  return raw;
}

async function readRawBuffer(req: IncomingMessage): Promise<Buffer> {
  const existing = (req as IncomingMessage & { body?: unknown }).body;
  if (Buffer.isBuffer(existing)) {
    return existing;
  }
  if (existing instanceof Uint8Array) {
    return Buffer.from(existing);
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === "string" ? Buffer.from(chunk, "binary") : chunk;
    total += buf.length;
    if (total > MAX_AUDIO_BYTES * 1.5) {
      throw new Error("Audio payload exceeds size limit.");
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

function getFileExtension(mimeType: string): string {
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "mp4";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

function isValidWavHeader(buf: Buffer): boolean {
  return (
    buf.length >= 44 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WAVE"
  );
}

async function transcribeWithOpenAIWhisper(
  audioBuffer: Buffer,
  mimeType: string,
  apiKey: string
): Promise<string> {
  const ext = getFileExtension(mimeType);
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(audioBuffer)], { type: mimeType }),
    `utterance.${ext}`
  );
  form.append("model", "whisper-1");
  form.append("language", "en");
  form.append("prompt", GROQ_WHISPER_TECH_PROMPT);

  const whisperRes = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    }
  );

  if (!whisperRes.ok) {
    const errText = await whisperRes.text().catch(() => "");
    throw new Error(
      `OpenAI Whisper error (${whisperRes.status}): ${errText.slice(0, 180)}`
    );
  }
  const whisperJson = (await whisperRes.json()) as { text?: string };
  return (whisperJson.text || "").trim();
}

async function transcribeWithGeminiFallback(
  audioBuffer: Buffer,
  mimeType: string,
  meta: TranscribeMeta,
  apiKey: string
): Promise<string> {
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } },
  });
  const profileHint = [
    meta.role ? `Target Role: ${meta.role}` : "",
    meta.skills ? `Domain Core Skills & Tech Terms: ${meta.skills}` : "",
    meta.jdText ? `JD Context: ${meta.jdText.slice(0, 600)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const promptText = [
    "Transcribe the interviewer's spoken technical question STRICTLY in English (Indian English accent aware). NEVER output Russian or any non-English script.",
    `KEY TECHNICAL TERMS: ${GROQ_WHISPER_TECH_PROMPT}`,
    profileHint ? `TARGET PROFILE CONTEXT:\n${profileHint}` : "",
    "Output ONLY the clean English spoken question. If silent or noise only, return empty string.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const models = ["gemini-3.5-transcribe", "gemini-2.5-flash"] as const;
  let lastErr: unknown;
  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBuffer.toString("base64"),
              },
            },
            { text: promptText },
          ],
        },
      });
      return (response.text || "").trim();
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Gemini transcription unavailable.");
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method not allowed." }));
    return;
  }

  let audioBuffer: Buffer;
  let cleanMime = "audio/wav";
  let meta: TranscribeMeta = {};

  try {
    const reqContentType = String(req.headers["content-type"] || "").toLowerCase();
    const parsedUrl = new URL(req.url || "/api/transcribe", "https://crackpilot.vercel.app");

    if (
      reqContentType.startsWith("audio/") ||
      reqContentType.includes("application/octet-stream")
    ) {
      // Direct raw binary audio upload (lossless, zero base64 overhead)
      audioBuffer = await readRawBuffer(req);
      cleanMime = reqContentType.split(";")[0].trim() || "audio/wav";
      meta = {
        language: parsedUrl.searchParams.get("language") || undefined,
        role: parsedUrl.searchParams.get("role") || undefined,
      };
    } else {
      // JSON body containing base64 audio payload
      const existing = (req as IncomingMessage & { body?: unknown }).body;
      let body: TranscribeJsonBody;
      if (existing && typeof existing === "object" && !Buffer.isBuffer(existing)) {
        body = existing as TranscribeJsonBody;
      } else {
        const rawBuf = await readRawBuffer(req);
        const rawText = rawBuf.toString("utf8").trim();
        body = rawText ? (JSON.parse(rawText) as TranscribeJsonBody) : {};
      }
      if (typeof body.audioBase64 !== "string" || !body.audioBase64.trim()) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "audioBase64 is required." }));
        return;
      }
      audioBuffer = Buffer.from(body.audioBase64, "base64");
      cleanMime =
        (body.mimeType || "audio/wav").split(";")[0].trim() || "audio/wav";
      meta = {
        language: body.language,
        role: body.role,
        experience: body.experience,
        skills: body.skills,
        jdText: body.jdText,
      };
    }
  } catch (err) {
    res.statusCode = 400;
    res.end(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Invalid audio payload.",
      })
    );
    return;
  }

  if (audioBuffer.length > MAX_AUDIO_BYTES) {
    res.statusCode = 413;
    res.end(JSON.stringify({ error: "Audio payload exceeds 12MB limit." }));
    return;
  }

  // Silently skip tiny/empty buffers (< 0.4s) so background clicks never fail or waste API calls
  if (
    audioBuffer.length < 3200 ||
    (cleanMime === "audio/wav" &&
      (!isValidWavHeader(audioBuffer) || audioBuffer.length < MIN_WAV_BYTES))
  ) {
    res.statusCode = 200;
    res.end(JSON.stringify({ text: "", skipped: true }));
    return;
  }

  const deepgramKey = readCleanKey("DEEPGRAM_API_KEY");
  const groqKey = readCleanKey("GROQ_API_KEY");
  const openaiKey = readCleanKey("OPENAI_API_KEY");
  const geminiKey = readCleanKey("GEMINI_API_KEY");

  if (!deepgramKey && !groqKey && !openaiKey && !geminiKey) {
    res.statusCode = 503;
    res.end(
      JSON.stringify({
        error:
          "Missing DEEPGRAM_API_KEY / GROQ_API_KEY on server. Add keys in Vercel Environment Variables and redeploy.",
      })
    );
    return;
  }

  const errors: string[] = [];

  // Tier 1: Deepgram Nova-3 (strictly English en-IN -> en + technical keyterms)
  if (deepgramKey) {
    try {
      const { text, language: matchedLang } = await transcribeWithDeepgramEnglish(
        audioBuffer,
        cleanMime,
        deepgramKey
      );
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          text,
          engine: "deepgram",
          model: "nova-3",
          language: matchedLang,
        })
      );
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[/api/transcribe] Deepgram failed, falling back:", msg);
      errors.push(msg);
    }
  }

  // Tier 2: Automatic fallback to Groq Whisper (whisper-large-v3-turbo, locked English + tech prompt)
  if (groqKey) {
    try {
      const text = await transcribeWithGroqWhisperEnglish(
        audioBuffer,
        cleanMime,
        groqKey
      );
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          text,
          engine: "groq-whisper",
          model: "whisper-large-v3-turbo",
          language: "en",
        })
      );
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[/api/transcribe] Groq Whisper failed, falling back:", msg);
      errors.push(msg);
    }
  }

  // Tier 3: OpenAI Whisper fallback (locked English)
  if (openaiKey && openaiKey.startsWith("sk-")) {
    try {
      const text = await transcribeWithOpenAIWhisper(
        audioBuffer,
        cleanMime,
        openaiKey
      );
      res.statusCode = 200;
      res.end(
        JSON.stringify({ text, engine: "openai", model: "whisper-1", language: "en" })
      );
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[/api/transcribe] OpenAI Whisper failed, falling back:", msg);
      errors.push(msg);
    }
  }

  // Tier 4: Gemini transcription fallback (strictly English)
  if (geminiKey) {
    try {
      const text = await transcribeWithGeminiFallback(
        audioBuffer,
        cleanMime,
        meta,
        geminiKey
      );
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          text,
          engine: "gemini",
          model: "gemini-2.5-flash",
          language: "en",
        })
      );
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[/api/transcribe] Gemini transcribe failed:", msg);
      errors.push(msg);
    }
  }

  res.statusCode = 502;
  res.end(
    JSON.stringify({
      error: "Audio transcription temporarily unavailable. Please try again.",
    })
  );
}

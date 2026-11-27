import type { IncomingMessage, ServerResponse } from "http";
import { GoogleGenAI } from "@google/genai";

interface TranscribeBody {
  audioBase64?: string;
  mimeType?: string;
  language?: string;
  role?: string;
  experience?: string;
  skills?: string;
  jdText?: string;
}

function readCleanKey(name: string): string {
  const raw = (process.env[name] || "").trim().replace(/^['"]|['"]$/g, "");
  if (!raw || /your_|placeholder/i.test(raw)) return "";
  return raw;
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const existing = (req as IncomingMessage & { body?: unknown }).body;
  if (existing && typeof existing === "object") {
    return existing as T;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? (JSON.parse(raw) as T) : ({} as T);
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

  let body: TranscribeBody;
  try {
    body = await readJsonBody<TranscribeBody>(req);
  } catch {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "Invalid JSON payload." }));
    return;
  }

  if (typeof body.audioBase64 !== "string" || !body.audioBase64.trim()) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "audioBase64 is required." }));
    return;
  }

  if (body.audioBase64.length > 15_000_000) {
    res.statusCode = 413;
    res.end(JSON.stringify({ error: "Audio payload exceeds size limit." }));
    return;
  }

  const cleanMime = (body.mimeType || "audio/webm").split(";")[0].trim() || "audio/webm";
  const deepgramKey = readCleanKey("DEEPGRAM_API_KEY");
  const openaiKey = readCleanKey("OPENAI_API_KEY");
  const geminiKey = readCleanKey("GEMINI_API_KEY");

  try {
    // Priority 1: Deepgram Nova-3 pre-recorded API (ultra-fast, works on serverless & Electron)
    if (deepgramKey) {
      const audioBuffer = Buffer.from(body.audioBase64, "base64");
      const langParam =
        body.language === "hi"
          ? "language=hi"
          : "detect_language=true";
      const dgUrl = `https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true&${langParam}`;

      const dgRes = await fetch(dgUrl, {
        method: "POST",
        headers: {
          Authorization: `Token ${deepgramKey}`,
          "Content-Type": cleanMime,
        },
        body: audioBuffer,
      });

      if (!dgRes.ok) {
        const errBody = await dgRes.text().catch(() => "");
        throw new Error(
          `Deepgram Nova-3 error (${dgRes.status}): ${errBody.slice(0, 180) || "Verify DEEPGRAM_API_KEY"}`
        );
      }

      const dgJson = (await dgRes.json()) as {
        results?: {
          channels?: Array<{
            alternatives?: Array<{ transcript?: string }>;
          }>;
        };
      };
      const transcript = (
        dgJson.results?.channels?.[0]?.alternatives?.[0]?.transcript || ""
      ).trim();

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          text: transcript,
          engine: "deepgram",
          model: "nova-3",
        })
      );
      return;
    }

    // Priority 2: OpenAI Whisper
    if (openaiKey && openaiKey.startsWith("sk-")) {
      const audioBuffer = Buffer.from(body.audioBase64, "base64");
      const form = new FormData();
      const ext = cleanMime.includes("mp4") ? "mp4" : cleanMime.includes("wav") ? "wav" : "webm";
      form.append(
        "file",
        new Blob([audioBuffer], { type: cleanMime }),
        `audio.${ext}`
      );
      form.append("model", "whisper-1");
      if (body.language === "hi") {
        form.append("language", "hi");
      }

      const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
        },
        body: form,
      });

      if (!whisperRes.ok) {
        const errText = await whisperRes.text().catch(() => "");
        throw new Error(`OpenAI Whisper error (${whisperRes.status}): ${errText.slice(0, 180)}`);
      }
      const whisperJson = (await whisperRes.json()) as { text?: string };
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          text: (whisperJson.text || "").trim(),
          engine: "openai",
          model: "whisper-1",
        })
      );
      return;
    }

    // Priority 3: Gemini transcription fallback
    if (geminiKey) {
      const ai = new GoogleGenAI({
        apiKey: geminiKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });
      const profileHint = [
        body.role ? `Target Role: ${body.role}` : "",
        body.skills ? `Domain Core Skills & Tech Terms: ${body.skills}` : "",
        body.jdText ? `JD Context: ${body.jdText.slice(0, 600)}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const promptText = [
        body.language === "hi"
          ? "Transcribe the remote interviewer's spoken question accurately in Hindi/Hinglish (keep technical terms in English)."
          : "Transcribe the remote interviewer's spoken question accurately.",
        "PRONUNCIATION AUTO-ADJUSTMENT: Correct domain/technical terms using the Target Profile below.",
        profileHint ? `TARGET PROFILE CONTEXT:\n${profileHint}` : "",
        "Output ONLY the clean corrected spoken question. If silent, return empty string.",
      ]
        .filter(Boolean)
        .join("\n\n");

      const response = await ai.models.generateContent({
        model: "gemini-3.5-transcribe",
        contents: {
          parts: [
            { inlineData: { mimeType: cleanMime, data: body.audioBase64 } },
            { text: promptText },
          ],
        },
      });
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          text: (response.text || "").trim(),
          engine: "gemini",
          model: "gemini-3.5-transcribe",
        })
      );
      return;
    }

    res.statusCode = 503;
    res.end(
      JSON.stringify({
        error:
          "Missing DEEPGRAM_API_KEY on server. Add DEEPGRAM_API_KEY in Vercel Environment Variables and redeploy.",
      })
    );
  } catch (err) {
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Transcription failed.",
      })
    );
  }
}

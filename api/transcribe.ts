import type { IncomingMessage, ServerResponse } from "http";
import { GoogleGenAI } from "@google/genai";

interface TranscribeBody {
  audioBase64?: string;
  mimeType?: string;
  language?: string;
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

  const body = await readJsonBody<TranscribeBody>(req);
  if (!body.audioBase64) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "audioBase64 is required." }));
    return;
  }

  try {
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    if (!geminiKey) {
      res.statusCode = 200;
      res.end(JSON.stringify({ text: "" }));
      return;
    }
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const cleanMime = (body.mimeType || "audio/webm").split(";")[0].trim();
    const response = await ai.models.generateContent({
      model: "gemini-3.5-transcribe",
      contents: {
        parts: [
          { inlineData: { mimeType: cleanMime, data: body.audioBase64 } },
          {
            text:
              body.language === "hi"
                ? "Transcribe spoken interviewer audio accurately in Hindi/Hinglish. Output only the spoken transcript. If silent, return empty string."
                : "Transcribe spoken interviewer audio accurately. Output only the spoken transcript. If silent, return empty string.",
          },
        ],
      },
    });
    res.statusCode = 200;
    res.end(JSON.stringify({ text: (response.text || "").trim() }));
  } catch (err) {
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Transcription failed.",
      })
    );
  }
}

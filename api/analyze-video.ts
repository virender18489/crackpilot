import type { IncomingMessage, ServerResponse } from "http";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

interface VideoBody {
  frames?: string[];
  durationSec?: number;
  role?: string;
  experience?: string;
  answerLanguage?: string;
  answerStyle?: string;
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

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const body = await readJsonBody<VideoBody>(req);
  const frames = Array.isArray(body.frames) ? body.frames.slice(0, 8) : [];
  if (frames.length === 0) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "No video frames provided." }));
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendEvent = (payload: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    if (!geminiKey) {
      throw new Error(
        "Configure GEMINI_API_KEY in Vercel Environment Variables to use Video Scan."
      );
    }

    sendEvent({ meta: { engine: "gemini", model: "gemini-4-hydrogen" } });
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const parts: Array<
      | { inlineData: { mimeType: string; data: string } }
      | { text: string }
    > = frames.map((data) => ({
      inlineData: { mimeType: "image/jpeg", data },
    }));
    parts.push({
      text: `These ${frames.length} sequential screenshots were recorded while scrolling a page over ${body.durationSec || 4}s. Identify EVERY distinct question, MCQ, or coding prompt visible across all frames and answer each in order. Language: ${body.answerLanguage || "English"}. Style: ${body.answerStyle || "Concise Bullets"}.`,
    });

    const stream = await ai.models.generateContentStream({
      model: "gemini-4-hydrogen",
      contents: { parts },
      config: {
        temperature: 0.25,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
    for await (const chunk of stream) {
      if (chunk.text) sendEvent({ text: chunk.text });
    }
    sendEvent({ done: true });
    res.end();
  } catch (err) {
    sendEvent({
      error: err instanceof Error ? err.message : "Video scan failed.",
    });
    res.end();
  }
}

import type { IncomingMessage, ServerResponse } from "http";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

interface ScreenBody {
  imageBase64?: string;
  mimeType?: string;
  role?: string;
  experience?: string;
  skills?: string;
  resumeText?: string;
  jdText?: string;
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

  const body = await readJsonBody<ScreenBody>(req);
  if (!body.imageBase64) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "No screen image provided." }));
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
        "Configure GEMINI_API_KEY in Vercel Environment Variables to use Screen Capture."
      );
    }

    sendEvent({ meta: { engine: "gemini", model: "gemini-4-hydrogen" } });
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const prompt = `Read the visible interview question, chat message, MCQ, or coding problem in this screenshot and provide a crisp, complete answer tailored for ${body.role || "Software Engineer"} (${body.experience || "3 years"}). Language: ${body.answerLanguage || "English"}. Style: ${body.answerStyle || "Concise Bullets"}.`;

    const stream = await ai.models.generateContentStream({
      model: "gemini-4-hydrogen",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: body.mimeType || "image/jpeg",
              data: body.imageBase64,
            },
          },
          { text: prompt },
        ],
      },
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
      error:
        err instanceof Error ? err.message : "Screen analysis failed.",
    });
    res.end();
  }
}

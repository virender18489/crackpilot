import type { IncomingMessage, ServerResponse } from "http";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

interface AnswerBody {
  question?: string;
  role?: string;
  experience?: string;
  skills?: string;
  resumeText?: string;
  jdText?: string;
  answerLanguage?: string;
  answerStyle?: string;
  fastMode?: boolean;
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

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed." }));
    return;
  }

  const body = await readJsonBody<AnswerBody>(req);
  const cleanQuestion = (body.question || "").trim();
  if (!cleanQuestion) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Question is required." }));
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendEvent = (payload: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const lang = body.answerLanguage || "English";
  const style = body.answerStyle || "Concise Bullets";
  const systemPrompt = [
    "You are Crackpilot, a real-time AI interview copilot.",
    `Target Role: ${body.role || "Software Engineer"}`,
    `Experience: ${body.experience || "3 years"}`,
    body.skills ? `Skills: ${body.skills}` : "",
    body.resumeText ? `Resume Context:\n${body.resumeText.slice(0, 4000)}` : "",
    body.jdText ? `Job Description:\n${body.jdText.slice(0, 3000)}` : "",
    `Language: ${lang}. Style: ${style}.`,
    body.fastMode
      ? "FAST MODE: Reply in 3 crisp, immediately speakable bullet points."
      : "Give a clear, confident, interview-ready answer in scannable markdown.",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    if (openaiKey && openaiKey.startsWith("sk-")) {
      sendEvent({ meta: { engine: "openai", model: "gpt-4o-mini" } });
      const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          stream: true,
          temperature: 0.35,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: cleanQuestion },
          ],
        }),
      });
      if (!upstream.ok || !upstream.body) {
        throw new Error(`OpenAI API error (${upstream.status})`);
      }
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
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
          if (raw === "[DONE]") continue;
          try {
            const parsed = JSON.parse(raw) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const text = parsed.choices?.[0]?.delta?.content;
            if (text) sendEvent({ text });
          } catch {
            // Ignore partial chunk
          }
        }
      }
      sendEvent({ done: true });
      res.end();
      return;
    }

    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    if (!geminiKey) {
      throw new Error(
        "Configure GEMINI_API_KEY or OPENAI_API_KEY in your Vercel Environment Variables for live AI answers."
      );
    }

    sendEvent({ meta: { engine: "gemini", model: "gemini-4-hydrogen" } });
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const stream = await ai.models.generateContentStream({
      model: "gemini-4-hydrogen",
      contents: cleanQuestion,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.35,
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
      error: err instanceof Error ? err.message : "Failed to generate answer.",
    });
    res.end();
  }
}

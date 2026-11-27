import type { IncomingMessage, ServerResponse } from "http";
import { ThinkingLevel } from "@google/genai";
import {
  analyzeDsaProblem,
  buildDsaAnalysisSummaryMarkdown,
  buildHumanInterviewSystemPrompt,
  generateContentStreamResilient,
  normalizeProgrammingLanguage,
} from "../server/dsaEngine.ts";

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
  dsaModeEnabled?: boolean;
  preferredLanguage?: string;
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
    if (body.dsaModeEnabled) {
      const preferredLanguage = normalizeProgrammingLanguage(body.preferredLanguage);
      const dsaData = await analyzeDsaProblem({
        images: [
          {
            data: body.imageBase64,
            mimeType: body.mimeType || "image/jpeg",
          },
        ],
        preferredLanguage,
        answerLanguage: body.answerLanguage || "English",
        role: body.role,
        experience: body.experience,
        source: "alt_s",
      });
      const summary = buildDsaAnalysisSummaryMarkdown(dsaData);
      sendEvent({ dsaData, activeProblemContext: dsaData.problemContext });
      sendEvent({ chunk: summary, text: summary });
      sendEvent({ done: true });
      res.end();
      return;
    }

    const systemPrompt = buildHumanInterviewSystemPrompt({
      role: body.role || "Software Engineer",
      experience: body.experience || "Junior (1-3 Years)",
      skills: body.skills || "",
      resumeText: body.resumeText || "",
      jdText: body.jdText || "",
      answerLanguage: body.answerLanguage || "English",
      answerStyle: body.answerStyle,
    });

    const cleanEnv = (k: string) => {
      const v = (process.env[k] || "").trim().replace(/^['"]|['"]$/g, "");
      return v && !/your_|placeholder/i.test(v) ? v : "";
    };
    const groqKey = cleanEnv("GROQ_API_KEY");
    const geminiKey = cleanEnv("GEMINI_API_KEY");

    if (!geminiKey && groqKey) {
      const cleanMime = (body.mimeType || "image/jpeg").split(";")[0].trim();
      const groqRes = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "meta-llama/llama-4-scout-17b-16e-instruct",
            stream: true,
            temperature: 0.3,
            max_tokens: 1400,
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Read the visible interview question, chat message, MCQ, or coding problem in this screenshot and answer it directly in natural human speech following the system rules.",
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:${cleanMime};base64,${body.imageBase64}`,
                    },
                  },
                ],
              },
            ],
          }),
        }
      );

      if (!groqRes.ok || !groqRes.body) {
        const errText = await groqRes.text().catch(() => "");
        throw new Error(
          `Groq Vision error (${groqRes.status}): ${errText.slice(0, 180)}`
        );
      }

      sendEvent({
        meta: {
          engine: "groq",
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
        },
      });
      const reader = groqRes.body.getReader();
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
          if (!raw || raw === "[DONE]") continue;
          try {
            const parsed = JSON.parse(raw) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const text = parsed.choices?.[0]?.delta?.content;
            if (text) sendEvent({ chunk: text, text });
          } catch {
            // Ignore partial chunk
          }
        }
      }
      sendEvent({ done: true });
      res.end();
      return;
    }

    const { model, stream } = await generateContentStreamResilient({
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: body.mimeType || "image/jpeg",
              data: body.imageBase64,
            },
          },
          {
            text: "Read the visible interview question, chat message, MCQ, or problem in this screenshot and answer it directly in natural human speech following the system rules.",
          },
        ],
      },
      config: {
        systemInstruction: systemPrompt,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
    sendEvent({ meta: { engine: "gemini", model } });
    for await (const chunk of stream) {
      if (chunk.text) sendEvent({ chunk: chunk.text, text: chunk.text });
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

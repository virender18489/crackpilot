import type { IncomingMessage, ServerResponse } from "http";
import { ThinkingLevel } from "@google/genai";
import {
  analyzeDsaProblem,
  buildDsaAnalysisSummaryMarkdown,
  buildHumanInterviewSystemPrompt,
  generateContentStreamResilient,
  normalizeProgrammingLanguage,
} from "../server/dsaEngine.ts";

interface VideoBody {
  frames?: string[];
  durationSec?: number;
  role?: string;
  experience?: string;
  skills?: string;
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
    if (body.dsaModeEnabled) {
      const preferredLanguage = normalizeProgrammingLanguage(body.preferredLanguage);
      const dsaData = await analyzeDsaProblem({
        images: frames.slice(0, 4).map((data) => ({
          data,
          mimeType: "image/jpeg",
        })),
        preferredLanguage,
        answerLanguage: body.answerLanguage || "English",
        role: body.role,
        experience: body.experience,
        source: "alt_v",
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
      answerLanguage: body.answerLanguage || "English",
      answerStyle: body.answerStyle,
    });

    const parts: Array<
      | { inlineData: { mimeType: string; data: string } }
      | { text: string }
    > = frames.map((data) => ({
      inlineData: { mimeType: "image/jpeg", data },
    }));
    parts.push({
      text: `These ${frames.length} sequential screenshots were recorded while scrolling a page over ${body.durationSec || 4}s. Identify EVERY distinct question, MCQ, or prompt visible across all frames and answer each in order in natural human spoken phrasing.`,
    });

    const { model, stream } = await generateContentStreamResilient({
      contents: { parts },
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
      error: err instanceof Error ? err.message : "Video scan failed.",
    });
    res.end();
  }
}

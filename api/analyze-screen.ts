import type { IncomingMessage, ServerResponse } from "http";
import {
  analyzeDsaProblem,
  buildDsaAnalysisSummaryMarkdown,
  normalizeProgrammingLanguage,
} from "../server/dsaEngine.ts";
import {
  normalizeImagePayload,
  streamScreenVisionSSE,
} from "../server/visionHelper.ts";

interface ScreenBody {
  image?: string;
  imageBase64?: string;
  mimeType?: string;
  question?: string;
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

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed." }));
    return;
  }

  let body: ScreenBody;
  try {
    body = await readJsonBody<ScreenBody>(req);
  } catch {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Invalid JSON payload." }));
    return;
  }

  const normalizedImage = normalizeImagePayload(body);
  if (!normalizedImage) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "No valid screenshot image provided." }));
    return;
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Content-Encoding", "none");
  if (
    typeof (res as ServerResponse & { flushHeaders?: () => void })
      .flushHeaders === "function"
  ) {
    (res as ServerResponse & { flushHeaders?: () => void }).flushHeaders?.();
  }

  const sendEvent = (payload: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    if (body.dsaModeEnabled) {
      const preferredLanguage = normalizeProgrammingLanguage(
        body.preferredLanguage
      );
      const dsaData = await analyzeDsaProblem({
        images: [
          {
            data: normalizedImage.base64,
            mimeType: normalizedImage.mimeType,
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

    await streamScreenVisionSSE({
      image: normalizedImage,
      question: body.question,
      answerLanguage: body.answerLanguage || "English",
      sendEvent,
    });
    res.end();
  } catch (err) {
    sendEvent({
      error:
        err instanceof Error ? err.message : "Screen vision analysis failed.",
    });
    res.end();
  }
}

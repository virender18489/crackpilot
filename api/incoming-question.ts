import type { IncomingMessage, ServerResponse } from "http";

interface IncomingQuestionBody {
  question?: string;
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
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === "GET") {
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        ok: true,
        endpoint: "/api/incoming-question",
        ready: true,
      })
    );
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method not allowed." }));
    return;
  }

  try {
    const body = await readJsonBody<IncomingQuestionBody>(req);
    const question = (body.question || "").trim();
    if (!question) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "question is required." }));
      return;
    }

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        ok: true,
        received: true,
        question,
      })
    );
  } catch (err) {
    res.statusCode = 400;
    res.end(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Invalid JSON payload.",
      })
    );
  }
}

import type { IncomingMessage, ServerResponse } from "http";
import crypto from "crypto";

interface LoginBody {
  email?: string;
  name?: string;
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

  const body = await readJsonBody<LoginBody>(req);
  const cleanEmail = (body.email || "candidate@crackpilot.app").trim();
  const cleanName = (body.name || cleanEmail.split("@")[0] || "Candidate").trim();

  const user = {
    id: "usr-" + crypto.randomBytes(4).toString("hex"),
    name: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
    email: cleanEmail,
  };

  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true, user }));
}

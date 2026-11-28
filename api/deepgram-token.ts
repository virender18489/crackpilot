import type { IncomingMessage, ServerResponse } from "http";
import {
  buildDeepgramLiveWsUrl,
  requestDeepgramShortLivedToken,
} from "../server/sttConfig.ts";

function readCleanKey(name: string): string {
  const raw = (process.env[name] || "").trim().replace(/^['"]|['"]$/g, "");
  if (!raw || /your_|placeholder/i.test(raw)) return "";
  return raw;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "GET" && req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ ok: false, error: "Method not allowed." }));
    return;
  }

  const deepgramKey = readCleanKey("DEEPGRAM_API_KEY");
  if (!deepgramKey) {
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        ok: false,
        mode: "fallback",
        reason: "DEEPGRAM_API_KEY not configured",
      })
    );
    return;
  }

  const grant = await requestDeepgramShortLivedToken(deepgramKey, 60);
  if (grant) {
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        ok: true,
        mode: "bearer",
        token: grant.accessToken,
        expiresIn: grant.expiresIn,
        wsUrl: buildDeepgramLiveWsUrl("en-IN", true),
        fallbackWsUrl: buildDeepgramLiveWsUrl("en", true),
      })
    );
    return;
  }

  res.statusCode = 200;
  res.end(
    JSON.stringify({
      ok: false,
      mode: "fallback",
      reason: "Temporary token grant unavailable for this Deepgram key scope",
    })
  );
}

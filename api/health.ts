import type { IncomingMessage, ServerResponse } from "http";

function hasCleanKey(name: string): boolean {
  const val = (process.env[name] || "").trim().replace(/^['"]|['"]$/g, "");
  return Boolean(val && !/your_|placeholder/i.test(val));
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const groq = hasCleanKey("GROQ_API_KEY");
  const deepgram = hasCleanKey("DEEPGRAM_API_KEY");
  const openai = hasCleanKey("OPENAI_API_KEY");
  const gemini = hasCleanKey("GEMINI_API_KEY");

  res.statusCode = 200;
  res.end(
    JSON.stringify({
      ok: true,
      sseSupported: false,
      ts: Date.now(),
      engines: {
        groq,
        deepgram,
        openai,
        gemini,
        sttReady: deepgram || openai || gemini,
        llmReady: groq || openai || gemini,
      },
    })
  );
}

import type { IncomingMessage, ServerResponse } from "http";
import answerHandler from "./answer.ts";

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === "GET") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ok: true,
        endpoint: "/api/incoming-question",
        streaming: true,
        ready: true,
      })
    );
    return;
  }

  // Stream real-time SSE tokens directly for both voice and typed questions
  await answerHandler(req, res);
}

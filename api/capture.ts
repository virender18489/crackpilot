import type { IncomingMessage, ServerResponse } from "http";
import analyzeScreenHandler from "./analyze-screen.ts";

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
) {
  await analyzeScreenHandler(req, res);
}

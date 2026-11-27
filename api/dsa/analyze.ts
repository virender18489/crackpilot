import type { IncomingMessage, ServerResponse } from "http";
import {
  analyzeDsaProblem,
  buildDsaAnalysisSummaryMarkdown,
  normalizeProgrammingLanguage,
} from "../../server/dsaEngine.ts";
import type { DsaAssessmentType, OaQuestionKind } from "../../src/types.ts";

interface AnalyzeDsaBody {
  problemText?: string;
  image?: string;
  images?: string[];
  preferredLanguage?: string;
  answerLanguage?: string;
  role?: string;
  experience?: string;
  assessmentTypeOverride?: DsaAssessmentType;
  oaQuestionKindOverride?: OaQuestionKind;
  source?: "alt_s" | "alt_v" | "mobile_companion" | "text_simulator";
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

function parseDataUrl(dataUrl: string): { data: string; mimeType: string } | null {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
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

  try {
    const body = await readJsonBody<AnalyzeDsaBody>(req);
    const parsedImages: Array<{ data: string; mimeType: string }> = [];
    if (typeof body.image === "string") {
      const parsed = parseDataUrl(body.image);
      if (parsed) parsedImages.push(parsed);
    }
    if (Array.isArray(body.images)) {
      for (const raw of body.images.slice(0, 4)) {
        if (typeof raw === "string") {
          const parsed = parseDataUrl(raw);
          if (parsed) parsedImages.push(parsed);
        }
      }
    }

    const problemText = (body.problemText || "").trim();
    if (!problemText && parsedImages.length === 0) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Provide problemText or a captured screen image." }));
      return;
    }

    const preferredLanguage = normalizeProgrammingLanguage(body.preferredLanguage);
    const dsaData = await analyzeDsaProblem({
      problemText,
      images: parsedImages,
      preferredLanguage,
      answerLanguage: body.answerLanguage || "English",
      role: body.role,
      experience: body.experience,
      assessmentTypeOverride: body.assessmentTypeOverride,
      oaQuestionKindOverride: body.oaQuestionKindOverride,
      source: body.source || (parsedImages.length > 0 ? "alt_s" : "text_simulator"),
    });

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        dsaData,
        activeProblemContext: dsaData.problemContext,
        summaryMarkdown: buildDsaAnalysisSummaryMarkdown(dsaData),
      })
    );
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Failed to analyze DSA problem.",
      })
    );
  }
}

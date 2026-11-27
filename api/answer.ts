import type { IncomingMessage, ServerResponse } from "http";
import { ThinkingLevel } from "@google/genai";
import {
  buildDsaFollowUpSystemPrompt,
  buildHumanInterviewSystemPrompt,
  generateContentStreamResilient,
  isCodeCreationRequest,
  normalizeProgrammingLanguage,
} from "../server/dsaEngine.ts";
import { streamGroqChatCompletion } from "../server/groqHelper.ts";
import type { ActiveProblemContext } from "../src/types.ts";

interface AnswerBody {
  question?: string;
  role?: string;
  experience?: string;
  skills?: string;
  resumeText?: string;
  jdText?: string;
  answerLanguage?: string;
  answerStyle?: string;
  fastMode?: boolean;
  dsaModeEnabled?: boolean;
  preferredLanguage?: string;
  activeProblemContext?: ActiveProblemContext | null;
  history?: Array<{ question: string; answer: string }>;
}

function readCleanKey(name: string): string {
  const raw = (process.env[name] || "").trim().replace(/^['"]|['"]$/g, "");
  if (!raw || /your_|placeholder/i.test(raw)) return "";
  return raw;
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

async function streamOpenAICompatible(params: {
  url: string;
  apiKey: string;
  model: string;
  engineLabel: string;
  systemPrompt: string;
  userPrompt: string;
  sendEvent: (payload: Record<string, unknown>) => void;
}): Promise<number> {
  const upstream = await fetch(params.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      stream: true,
      temperature: 0.35,
      max_tokens: 1400,
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userPrompt },
      ],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => "");
    throw new Error(
      `${params.engineLabel} upstream status ${upstream.status}: ${errText.slice(0, 140)}`
    );
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let metaSent = false;
  let emittedChars = 0;

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
        if (text) {
          if (!metaSent) {
            metaSent = true;
            params.sendEvent({
              meta: { engine: params.engineLabel.toLowerCase(), model: params.model },
            });
          }
          emittedChars += text.length;
          params.sendEvent({ chunk: text, text });
        }
      } catch {
        // Ignore partial SSE JSON chunk
      }
    }
  }

  return emittedChars;
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

  let body: AnswerBody;
  try {
    body = await readJsonBody<AnswerBody>(req);
  } catch {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Invalid JSON payload." }));
    return;
  }

  const cleanQuestion = typeof body.question === "string" ? body.question.trim() : "";
  if (!cleanQuestion) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Question is required." }));
    return;
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  const sendEvent = (payload: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const role = body.role || "Frontend Development (React, Next.js, Vue, Web)";
  const experience = body.experience || "Junior (1-3 Years)";
  const lang = body.answerLanguage || "English";
  const preferredLanguage = normalizeProgrammingLanguage(body.preferredLanguage);
  const useDsaFollowUp = Boolean(body.dsaModeEnabled && body.activeProblemContext);
  const isCodeReq = !useDsaFollowUp && isCodeCreationRequest(cleanQuestion);

  const systemPrompt =
    useDsaFollowUp && body.activeProblemContext
      ? buildDsaFollowUpSystemPrompt({
          problemContext: body.activeProblemContext,
          preferredLanguage,
          answerLanguage: lang,
          role,
          experience,
        })
      : buildHumanInterviewSystemPrompt({
          role,
          experience,
          skills: body.skills || "",
          resumeText: body.resumeText || "",
          jdText: body.jdText || "",
          answerLanguage: lang,
          answerStyle: body.answerStyle,
          fastMode: body.fastMode,
          question: cleanQuestion,
        });

  const recentContext =
    Array.isArray(body.history) && body.history.length > 0
      ? body.history
          .slice(-3)
          .map(
            (item, idx) =>
              `Previous Q${idx + 1}: ${item.question}\nPrevious A${idx + 1}: ${String(item.answer || "").slice(0, 350)}`
          )
          .join("\n\n")
      : "";

  const userPrompt = isCodeReq
    ? recentContext
      ? `Recent interview context:\n${recentContext}\n\nInterviewer just asked:\n"${cleanQuestion}"\n\nRespond strictly in two parts: (1) one crisp 3-4 sentence first-person developer summary paragraph with backticked identifiers and zero AI filler, immediately followed by (2) one complete runnable fenced code block with the exact language tag. Output zero text after the code block.`
      : `Interviewer just asked:\n"${cleanQuestion}"\n\nRespond strictly in two parts: (1) one crisp 3-4 sentence first-person developer summary paragraph with backticked identifiers and zero AI filler, immediately followed by (2) one complete runnable fenced code block with the exact language tag. Output zero text after the code block.`
    : recentContext
      ? `Recent interview context:\n${recentContext}\n\nInterviewer just asked:\n"${cleanQuestion}"\n\nAnswer directly in natural human spoken language.`
      : cleanQuestion;

  const groqKey = readCleanKey("GROQ_API_KEY");
  const openaiKey = readCleanKey("OPENAI_API_KEY");
  const geminiKey = readCleanKey("GEMINI_API_KEY");

  let streamedAnyChunk = false;

  // Pipeline A (Priority 1): Groq with dynamic active chat model lookup
  if (groqKey) {
    try {
      const { emittedChars } = await streamGroqChatCompletion({
        apiKey: groqKey,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.35,
        maxTokens: 1400,
        onMeta: (model) => {
          sendEvent({ meta: { engine: "groq", model } });
        },
        onDelta: (delta) => {
          streamedAnyChunk = true;
          sendEvent({ chunk: delta, text: delta });
        },
      });

      if (emittedChars > 0) {
        sendEvent({ done: true });
        res.end();
        return;
      }
    } catch (groqErr) {
      console.warn(
        "[/api/answer] Groq failed, silently falling back to next provider:",
        groqErr instanceof Error ? groqErr.message : String(groqErr)
      );
      if (streamedAnyChunk) {
        sendEvent({ done: true });
        res.end();
        return;
      }
    }
  }

  // Priority 2: OpenAI (if configured)
  if (openaiKey && openaiKey.startsWith("sk-")) {
    try {
      const emittedChars = await streamOpenAICompatible({
        url: "https://api.openai.com/v1/chat/completions",
        apiKey: openaiKey,
        model: "gpt-4o-mini",
        engineLabel: "OpenAI",
        systemPrompt,
        userPrompt,
        sendEvent: (payload) => {
          if (payload.chunk) streamedAnyChunk = true;
          sendEvent(payload);
        },
      });
      if (emittedChars > 0) {
        sendEvent({ done: true });
        res.end();
        return;
      }
    } catch (openaiErr) {
      console.warn(
        "[/api/answer] OpenAI failed, silently falling back to Gemini:",
        openaiErr instanceof Error ? openaiErr.message : String(openaiErr)
      );
      if (streamedAnyChunk) {
        sendEvent({ done: true });
        res.end();
        return;
      }
    }
  }

  // Pipeline B (Mandatory Silent Fallback): Gemini
  if (geminiKey) {
    try {
      const { model, stream } = await generateContentStreamResilient({
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
      sendEvent({ meta: { engine: "gemini", model } });
      for await (const chunk of stream) {
        if (chunk.text) {
          streamedAnyChunk = true;
          sendEvent({ chunk: chunk.text, text: chunk.text });
        }
      }
      sendEvent({ done: true });
      res.end();
      return;
    } catch (geminiErr) {
      console.error(
        "[/api/answer] Gemini fallback failed:",
        geminiErr instanceof Error ? geminiErr.message : String(geminiErr)
      );
    }
  }

  if (streamedAnyChunk) {
    sendEvent({ done: true });
    res.end();
    return;
  }

  sendEvent({
    error: !groqKey && !openaiKey && !geminiKey
      ? "No AI provider key is configured on the server. Add GROQ_API_KEY or GEMINI_API_KEY and try again."
      : "AI answer service is temporarily busy. Please resend your question.",
  });
  res.end();
}

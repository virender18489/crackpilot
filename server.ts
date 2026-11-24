import "dotenv/config";
import crypto from "crypto";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const isProd = process.env.NODE_ENV === "production";

interface StoredProfile {
  role: string;
  experience: string;
  skills: string;
  resumeFileName: string;
  resumeText: string;
  jdFileName: string;
  jdText: string;
  answerLanguage: "English" | "Hinglish" | "Hindi";
  answerStyle: "Concise Bullets" | "STAR Method" | "Technical + Code";
  updatedAt: string;
}

interface StoredToken {
  token: string;
  createdAt: string;
  authenticated: boolean;
  sessionActive: boolean;
}

interface StoredUser {
  id: string;
  name: string;
  email: string;
}

let currentUser: StoredUser | null = null;

let activeToken: StoredToken | null = null;

let activeProfile: StoredProfile = {
  role: "Frontend Developer (React & TypeScript)",
  experience: "3 years",
  skills: "React, TypeScript, Next.js, Tailwind CSS, Node.js, REST APIs, System Design",
  resumeFileName: "",
  resumeText: "",
  jdFileName: "",
  jdText: "",
  answerLanguage: "English",
  answerStyle: "Concise Bullets",
  updatedAt: new Date().toISOString(),
};

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function hasOpenAIKey(): boolean {
  const key = process.env.OPENAI_API_KEY?.trim();
  return Boolean(key && key !== "MY_OPENAI_API_KEY" && key.startsWith("sk-"));
}

function buildInterviewSystemPrompt(params: {
  role?: string;
  experience?: string;
  skills?: string;
  resumeText?: string;
  jdText?: string;
  answerLanguage?: string;
  answerStyle?: string;
}): string {
  const role = params.role || activeProfile.role;
  const experience = params.experience || activeProfile.experience;
  const skills = params.skills || activeProfile.skills;
  const resumeText = (params.resumeText ?? activeProfile.resumeText).trim();
  const jdText = (params.jdText ?? activeProfile.jdText).trim();
  const answerLanguage = params.answerLanguage || activeProfile.answerLanguage;
  const answerStyle = params.answerStyle || activeProfile.answerStyle;

  const langRule =
    answerLanguage === "Hindi"
      ? "Write the entire answer in clear, natural conversational Hindi (Devanagari script) with standard English technical terms."
      : answerLanguage === "Hinglish"
        ? "Write the answer in natural Hinglish (Hindi written in Roman script mixed with standard English technical terms), suitable for speaking aloud in an Indian tech interview."
        : "Write the answer in crisp, natural spoken English.";

  const styleRule =
    answerStyle === "STAR Method"
      ? "Structure behavioral or scenario answers briefly using Situation, Task, Action, and Result."
      : answerStyle === "Technical + Code"
        ? "Provide sharp technical depth and include a short, clean code snippet or architecture flow whenever the question is technical."
        : "Keep it ultra-concise and scannable so the candidate can glance at the screen and speak smoothly without reading essays.";

  const profileSections: string[] = [
    `Candidate Target Role: ${role}`,
    `Experience Level: ${experience}`,
  ];
  if (skills) {
    profileSections.push(`Core Skills: ${skills}`);
  }
  if (resumeText) {
    profileSections.push(
      `Candidate Resume Context (anchor examples, projects, and metrics directly in this resume whenever relevant):\n${resumeText.slice(0, 4500)}`
    );
  }
  if (jdText) {
    profileSections.push(
      `Target Job Description (align terminology, requirements, and priorities with this JD):\n${jdText.slice(0, 3500)}`
    );
  }

  return [
    "You are Crackpilot, a real-time interview assistant generating personalized, first-person spoken answers for the candidate.",
    langRule,
    styleRule,
    "",
    ...profileSections,
    "",
    "Output format rules (use clean markdown headings, zero filler intros):",
    "### Quick Opener",
    "One short natural first-person sentence the candidate can say immediately.",
    "",
    "### Key Talking Points",
    "3 to 4 crisp, high-impact first-person bullet points tailored to the candidate's target profile, resume, and JD.",
    "",
    "### Example or Code (Only if relevant)",
    "Include a concrete project example from the resume or a short code snippet when helpful.",
  ].join("\n");
}

async function transcribeWithOpenAI(
  audioBase64: string,
  mimeType: string,
  language?: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY!;
  const buffer = Buffer.from(audioBase64, "base64");
  const ext = mimeType.includes("wav")
    ? "wav"
    : mimeType.includes("mp4") || mimeType.includes("m4a")
      ? "m4a"
      : mimeType.includes("ogg")
        ? "ogg"
        : "webm";

  const formData = new FormData();
  const blob = new Blob([buffer], { type: mimeType || "audio/webm" });
  formData.append("file", blob, `chunk.${ext}`);
  formData.append("model", "whisper-1");
  if (language && language !== "auto") {
    formData.append("language", language);
  }

  const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`OpenAI Whisper error (${resp.status}): ${errText}`);
  }

  const data = (await resp.json()) as { text?: string };
  return (data.text || "").trim();
}

async function transcribeWithGemini(
  audioBase64: string,
  mimeType: string,
  language?: string
): Promise<string> {
  const ai = getGeminiClient();
  const cleanMime = (mimeType || "audio/webm").split(";")[0].trim();
  const hint =
    language === "hi"
      ? "Transcribe the spoken interviewer audio accurately in Hindi/Hinglish. Output only the spoken transcript with no timestamps or commentary. If silent, return an empty string."
      : "Transcribe the spoken interviewer audio accurately. Output only the spoken transcript with no timestamps or commentary. If silent, return an empty string.";

  const response = await ai.models.generateContent({
    model: "gemini-3.5-transcribe",
    contents: {
      parts: [
        { inlineData: { mimeType: cleanMime, data: audioBase64 } },
        { text: hint },
      ],
    },
  });

  return (response.text || "").trim();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "20mb" }));

  const sseClients = new Set<express.Response>();

  const broadcastEvent = (payload: Record<string, unknown>) => {
    const data = `data: ${JSON.stringify(payload)}\n\n`;
    for (const client of sseClients) {
      client.write(data);
    }
  };

  // Health & Config
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, ts: Date.now() });
  });

  app.get("/api/config", (_req, res) => {
    const openaiReady = hasOpenAIKey();
    const geminiReady = Boolean(process.env.GEMINI_API_KEY);
    res.json({
      activeEngine: openaiReady ? "openai" : "gemini",
      hasOpenAI: openaiReady,
      hasGemini: geminiReady,
    });
  });

  // Auth routes
  app.get("/api/auth/me", (_req, res) => {
    res.json({ user: currentUser, token: activeToken, profile: activeProfile });
  });

  app.post("/api/auth/login", (req, res) => {
    const { email, name } = req.body as { email?: string; name?: string };
    const cleanEmail = (email || "candidate@crackpilot.app").trim();
    const cleanName =
      (name || cleanEmail.split("@")[0] || "Candidate").trim();
    currentUser = {
      id: "usr-" + crypto.randomBytes(4).toString("hex"),
      name: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
      email: cleanEmail,
    };
    res.json({ ok: true, user: currentUser });
  });

  app.post("/api/auth/logout", (_req, res) => {
    currentUser = null;
    res.json({ ok: true });
  });

  // Token Generation & Software Authentication Flow
  app.get("/api/token/current", (_req, res) => {
    res.json({ token: activeToken });
  });

  app.post("/api/token/generate", (_req, res) => {
    const raw = `CP-${crypto.randomBytes(3).toString("hex").toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
    activeToken = {
      token: raw,
      createdAt: new Date().toISOString(),
      authenticated: false,
      sessionActive: false,
    };
    broadcastEvent({ type: "token_generated", token: activeToken });
    res.json({ ok: true, token: activeToken });
  });

  app.post("/api/token/verify", (req, res) => {
    const { token } = req.body as { token?: string };
    const submitted = (token || "").trim();
    if (!submitted) {
      res.status(400).json({ error: "Please paste your generated token." });
      return;
    }
    if (!activeToken) {
      res.status(404).json({
        error: "No active token found. Generate a token in Dashboard → Overview first.",
      });
      return;
    }
    if (submitted !== activeToken.token) {
      res.status(401).json({
        error: "Invalid token. Copy the exact token from Dashboard → Overview.",
      });
      return;
    }
    activeToken = { ...activeToken, authenticated: true };
    broadcastEvent({ type: "token_authenticated", token: activeToken });
    res.json({ ok: true, token: activeToken, profile: activeProfile });
  });

  app.post("/api/session/start", (_req, res) => {
    if (!activeToken || !activeToken.authenticated) {
      res.status(401).json({
        error: "Authenticate your Crackpilot software token first.",
      });
      return;
    }
    activeToken = { ...activeToken, sessionActive: true };
    broadcastEvent({
      type: "session_started",
      token: activeToken,
      profile: activeProfile,
    });
    res.json({ ok: true, token: activeToken, profile: activeProfile });
  });

  app.post("/api/session/stop", (_req, res) => {
    if (activeToken) {
      activeToken = { ...activeToken, sessionActive: false };
    }
    broadcastEvent({ type: "session_stopped" });
    res.json({ ok: true });
  });

  // Target Profile, Resume & JD Routes
  app.get("/api/profile", (_req, res) => {
    res.json({ profile: activeProfile });
  });

  app.post("/api/profile", (req, res) => {
    const patch = req.body as Partial<StoredProfile>;
    activeProfile = {
      ...activeProfile,
      role: patch.role ?? activeProfile.role,
      experience: patch.experience ?? activeProfile.experience,
      skills: patch.skills ?? activeProfile.skills,
      resumeFileName: patch.resumeFileName ?? activeProfile.resumeFileName,
      resumeText: patch.resumeText ?? activeProfile.resumeText,
      jdFileName: patch.jdFileName ?? activeProfile.jdFileName,
      jdText: patch.jdText ?? activeProfile.jdText,
      answerLanguage: patch.answerLanguage ?? activeProfile.answerLanguage,
      answerStyle: patch.answerStyle ?? activeProfile.answerStyle,
      updatedAt: new Date().toISOString(),
    };
    broadcastEvent({ type: "profile_updated", profile: activeProfile });
    res.json({ ok: true, profile: activeProfile });
  });

  app.post("/api/profile/extract", async (req, res) => {
    try {
      const { fileBase64, mimeType, fileName, kind } = req.body as {
        fileBase64?: string;
        mimeType?: string;
        fileName?: string;
        kind?: "resume" | "jd";
      };

      if (!fileBase64) {
        res.status(400).json({ error: "Missing file content." });
        return;
      }

      const lower = (fileName || "").toLowerCase();
      if (
        mimeType?.startsWith("text/") ||
        lower.endsWith(".txt") ||
        lower.endsWith(".md") ||
        lower.endsWith(".json")
      ) {
        const text = Buffer.from(fileBase64, "base64").toString("utf-8").trim();
        res.json({ ok: true, text });
        return;
      }

      // Extract clean text from PDF / image resumes or JDs via Gemini multimodal
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType || "application/pdf",
                data: fileBase64,
              },
            },
            {
              text:
                kind === "jd"
                  ? "Extract all text from this Job Description cleanly as plain structured text (role, responsibilities, required skills, qualifications). Return only the extracted text."
                  : "Extract all text from this candidate Resume cleanly as plain structured text (summary, skills, work experience, projects, achievements, education). Return only the extracted text.",
            },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      res.json({ ok: true, text: (response.text || "").trim() });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not extract file text.";
      res.status(500).json({ error: message });
    }
  });

  // Live SSE Event Stream (syncs Dashboard Start Session, Profile updates, and Python loopback audio)
  app.get("/api/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.write(
      `data: ${JSON.stringify({
        type: "connected",
        token: activeToken,
        profile: activeProfile,
      })}\n\n`
    );
    sseClients.add(res);
    req.on("close", () => {
      sseClients.delete(res);
    });
  });

  app.post("/api/incoming-question", (req, res) => {
    const { question, source = "system-audio" } = req.body as {
      question?: string;
      source?: string;
    };
    if (!question || !question.trim()) {
      res.status(400).json({ error: "Missing question text." });
      return;
    }
    broadcastEvent({
      type: "incoming_question",
      question: question.trim(),
      source,
      timestamp: new Date().toISOString(),
    });
    res.json({ ok: true, deliveredTo: sseClients.size });
  });

  // Audio Transcription
  app.post("/api/transcribe", async (req, res) => {
    try {
      const { audioBase64, mimeType, language } = req.body as {
        audioBase64?: string;
        mimeType?: string;
        language?: string;
      };

      if (!audioBase64) {
        res.status(400).json({ error: "Missing audioBase64 payload." });
        return;
      }

      const text = hasOpenAIKey()
        ? await transcribeWithOpenAI(audioBase64, mimeType || "audio/webm", language)
        : await transcribeWithGemini(audioBase64, mimeType || "audio/webm", language);

      res.json({
        text,
        engine: hasOpenAIKey() ? "openai" : "gemini",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Audio transcription failed.";
      console.error("[/api/transcribe]", message);
      res.status(500).json({ error: message });
    }
  });

  // Live Streaming Interview Answer (tailored to Target Profile + Resume + JD)
  app.post("/api/answer", async (req, res) => {
    const {
      question,
      role,
      experience,
      skills,
      resumeText,
      jdText,
      answerLanguage,
      answerStyle,
      history = [],
    } = req.body as {
      question?: string;
      role?: string;
      experience?: string;
      skills?: string;
      resumeText?: string;
      jdText?: string;
      answerLanguage?: string;
      answerStyle?: string;
      history?: Array<{ question: string; answer: string }>;
    };

    if (!question || !question.trim()) {
      res.status(400).json({ error: "Question text is required." });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    const sendEvent = (payload: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const systemPrompt = buildInterviewSystemPrompt({
      role,
      experience,
      skills,
      resumeText,
      jdText,
      answerLanguage,
      answerStyle,
    });

    const recentContext =
      Array.isArray(history) && history.length > 0
        ? history
            .slice(-3)
            .map(
              (item, idx) =>
                `Previous Q${idx + 1}: ${item.question}\nPrevious A${idx + 1}: ${item.answer.slice(0, 300)}`
            )
            .join("\n\n")
        : "";

    const userPrompt = recentContext
      ? `Recent interview context:\n${recentContext}\n\nInterviewer just asked:\n"${question.trim()}"\n\nGenerate the personalized live interview answer now.`
      : `Interviewer just asked:\n"${question.trim()}"\n\nGenerate the personalized live interview answer now.`;

    try {
      if (hasOpenAIKey()) {
        sendEvent({ meta: { engine: "openai", model: "gpt-4o-mini" } });
        const openaiRes = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              stream: true,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
            }),
          }
        );

        if (!openaiRes.ok || !openaiRes.body) {
          const errText = await openaiRes.text();
          throw new Error(`OpenAI Chat error (${openaiRes.status}): ${errText}`);
        }

        const reader = openaiRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(dataStr) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) sendEvent({ chunk: delta });
            } catch {
              // Ignore incomplete fragments
            }
          }
        }
        sendEvent({ done: true });
        res.end();
        return;
      }

      sendEvent({ meta: { engine: "gemini", model: "gemini-4-hydrogen" } });
      const ai = getGeminiClient();
      const stream = await ai.models.generateContentStream({
        model: "gemini-4-hydrogen",
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      for await (const chunk of stream) {
        if (chunk.text) sendEvent({ chunk: chunk.text });
      }
      sendEvent({ done: true });
      res.end();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to generate answer.";
      console.error("[/api/answer]", message);
      sendEvent({ error: message });
      res.end();
    }
  });

  // Screen & Chat Box Capture Solver
  app.post("/api/analyze-screen", async (req, res) => {
    const {
      imageBase64,
      mimeType = "image/jpeg",
      role,
      answerLanguage,
      answerStyle,
    } = req.body as {
      imageBase64?: string;
      mimeType?: string;
      role?: string;
      answerLanguage?: string;
      answerStyle?: string;
    };

    if (!imageBase64) {
      res.status(400).json({ error: "Missing imageBase64 payload." });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    const sendEvent = (payload: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const systemPrompt = buildInterviewSystemPrompt({
      role,
      answerLanguage,
      answerStyle,
    });

    const userInstruction =
      "Inspect this captured screen image carefully. Find any question visible in a chat box, meeting chat, coding editor, assessment page, slide, or browser window. First state the detected question briefly, then give a direct, accurate, personalized answer (with optimal code & complexity if it is a coding problem).";

    try {
      if (hasOpenAIKey()) {
        sendEvent({ meta: { engine: "openai", model: "gpt-4o-mini" } });
        const openaiRes = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              stream: true,
              messages: [
                { role: "system", content: systemPrompt },
                {
                  role: "user",
                  content: [
                    { type: "text", text: userInstruction },
                    {
                      type: "image_url",
                      image_url: { url: `data:${mimeType};base64,${imageBase64}` },
                    },
                  ],
                },
              ],
            }),
          }
        );

        if (!openaiRes.ok || !openaiRes.body) {
          const errText = await openaiRes.text();
          throw new Error(`OpenAI Vision error (${openaiRes.status}): ${errText}`);
        }

        const reader = openaiRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(dataStr) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) sendEvent({ chunk: delta });
            } catch {
              // Ignore partial chunks
            }
          }
        }
        sendEvent({ done: true });
        res.end();
        return;
      }

      sendEvent({ meta: { engine: "gemini", model: "gemini-4-hydrogen" } });
      const ai = getGeminiClient();
      const stream = await ai.models.generateContentStream({
        model: "gemini-4-hydrogen",
        contents: {
          parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            { text: userInstruction },
          ],
        },
        config: {
          systemInstruction: systemPrompt,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      for await (const chunk of stream) {
        if (chunk.text) sendEvent({ chunk: chunk.text });
      }
      sendEvent({ done: true });
      res.end();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Screen analysis failed.";
      console.error("[/api/analyze-screen]", message);
      sendEvent({ error: message });
      res.end();
    }
  });

  // Multi-frame 4s–10s Video Page Scanner
  app.post("/api/analyze-video", async (req, res) => {
    const {
      frames = [],
      mimeType = "image/jpeg",
      durationSec = 4,
      role,
      answerLanguage,
      answerStyle,
    } = req.body as {
      frames?: string[];
      mimeType?: string;
      durationSec?: number;
      role?: string;
      answerLanguage?: string;
      answerStyle?: string;
    };

    if (!Array.isArray(frames) || frames.length === 0) {
      res.status(400).json({ error: "No video frames captured." });
      return;
    }

    const boundedFrames = frames.slice(0, 8);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    const sendEvent = (payload: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const systemPrompt = buildInterviewSystemPrompt({
      role,
      answerLanguage,
      answerStyle,
    });

    const userInstruction = `These ${boundedFrames.length} sequential frames were recorded over a ${durationSec}-second screen video scan of a webpage/chat. Inspect ALL frames, deduplicate overlapping content, list EVERY distinct question visible across the entire page, and provide a clear, accurate answer for each question numbered sequentially (### Question 1, ### Question 2, etc.).`;

    try {
      if (hasOpenAIKey()) {
        sendEvent({ meta: { engine: "openai", model: "gpt-4o-mini" } });
        const contentParts = [
          { type: "text", text: userInstruction },
          ...boundedFrames.map((b64) => ({
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${b64}` },
          })),
        ];
        const openaiRes = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              stream: true,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: contentParts },
              ],
            }),
          }
        );
        if (!openaiRes.ok || !openaiRes.body) {
          const errText = await openaiRes.text();
          throw new Error(`OpenAI Video Scan error (${openaiRes.status}): ${errText}`);
        }
        const reader = openaiRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(dataStr) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) sendEvent({ chunk: delta });
            } catch {
              // Ignore partial chunks
            }
          }
        }
        sendEvent({ done: true });
        res.end();
        return;
      }

      sendEvent({ meta: { engine: "gemini", model: "gemini-4-hydrogen" } });
      const ai = getGeminiClient();
      const stream = await ai.models.generateContentStream({
        model: "gemini-4-hydrogen",
        contents: {
          parts: [
            ...boundedFrames.map((b64) => ({
              inlineData: { mimeType, data: b64 },
            })),
            { text: userInstruction },
          ],
        },
        config: {
          systemInstruction: systemPrompt,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      for await (const chunk of stream) {
        if (chunk.text) sendEvent({ chunk: chunk.text });
      }
      sendEvent({ done: true });
      res.end();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Video page scan failed.";
      console.error("[/api/analyze-video]", message);
      sendEvent({ error: message });
      res.end();
    }
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Crackpilot server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

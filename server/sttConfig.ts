export const TECH_KEYTERMS = [
  "JavaScript",
  "Virtual DOM",
  "Real DOM",
  "React",
  "TypeScript",
  "Next.js",
  "Redux",
  "Node.js",
  "HTML",
  "CSS",
  "API",
  "Closure",
  "Hoisting",
  "Promise",
  "Async",
  "Hooks",
  "useState",
  "useEffect",
] as const;

export const GROQ_WHISPER_TECH_PROMPT =
  "Technical software engineering interview in English. Vocabulary: JavaScript, Virtual DOM, Real DOM, React, TypeScript, Next.js, Redux, Node.js, HTML, CSS, API, Closure, Hoisting, Promise, Async, Hooks, useState, useEffect.";

function getFileExtension(mimeType: string): string {
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "mp4";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

export function buildDeepgramListenUrl(
  langCode: "en-IN" | "en" = "en-IN",
  includeKeyterms = true
): string {
  const params = new URLSearchParams();
  params.set("model", "nova-3");
  params.set("language", langCode);
  params.set("smart_format", "true");
  params.set("punctuate", "true");
  if (includeKeyterms) {
    for (const term of TECH_KEYTERMS) {
      params.append("keyterm", term);
    }
  }
  return `https://api.deepgram.com/v1/listen?${params.toString()}`;
}

export function buildDeepgramLiveWsUrl(langCode: "en-IN" | "en" = "en-IN"): string {
  const params = new URLSearchParams();
  params.set("model", "nova-3");
  params.set("language", langCode);
  params.set("encoding", "linear16");
  params.set("sample_rate", "16000");
  params.set("channels", "1");
  params.set("smart_format", "true");
  params.set("interim_results", "true");
  params.set("endpointing", "900");
  params.set("utterance_end_ms", "1200");
  for (const term of TECH_KEYTERMS) {
    params.append("keyterm", term);
  }
  return `wss://api.deepgram.com/v1/listen?${params.toString()}`;
}

/**
 * Strictly English-locked Deepgram Nova-3 transcription with technical keyterm boosting.
 * Tries en-IN + keyterms first, automatically falling back to en + keyterms (never auto-detect).
 */
export async function transcribeWithDeepgramEnglish(
  audioBuffer: Buffer,
  mimeType: string,
  apiKey: string
): Promise<{ text: string; language: string }> {
  const attempts: Array<{ lang: "en-IN" | "en"; keyterms: boolean }> = [
    { lang: "en-IN", keyterms: true },
    { lang: "en", keyterms: true },
    { lang: "en", keyterms: false },
  ];

  let lastErr: Error = new Error("Deepgram Nova-3 transcription failed.");

  for (const attempt of attempts) {
    const dgUrl = buildDeepgramListenUrl(attempt.lang, attempt.keyterms);
    const dgRes = await fetch(dgUrl, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": mimeType,
      },
      body: new Uint8Array(audioBuffer),
    });

    if (dgRes.ok) {
      const dgJson = (await dgRes.json()) as {
        results?: {
          channels?: Array<{
            alternatives?: Array<{ transcript?: string }>;
          }>;
        };
      };
      const text = (
        dgJson.results?.channels?.[0]?.alternatives?.[0]?.transcript || ""
      ).trim();
      return { text, language: attempt.lang };
    }

    const errBody = await dgRes.text().catch(() => "");
    lastErr = new Error(
      `Deepgram Nova-3 error (${dgRes.status}): ${errBody.slice(0, 180)}`
    );

    // Retry with fallback language=en if en-IN or keyterms triggered a 400 parameter rejection
    if (dgRes.status !== 400) {
      throw lastErr;
    }
  }

  throw lastErr;
}

/**
 * Strictly English-locked Groq Whisper transcription with technical vocabulary prompt.
 */
export async function transcribeWithGroqWhisperEnglish(
  audioBuffer: Buffer,
  mimeType: string,
  apiKey: string
): Promise<string> {
  const ext = getFileExtension(mimeType);
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(audioBuffer)], { type: mimeType }),
    `utterance.${ext}`
  );
  form.append("model", "whisper-large-v3-turbo");
  form.append("language", "en");
  form.append("prompt", GROQ_WHISPER_TECH_PROMPT);
  form.append("response_format", "json");
  form.append("temperature", "0");

  const groqRes = await fetch(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    }
  );

  if (!groqRes.ok) {
    const errBody = await groqRes.text().catch(() => "");
    throw new Error(
      `Groq Whisper error (${groqRes.status}): ${errBody.slice(0, 180)}`
    );
  }

  const groqJson = (await groqRes.json()) as { text?: string };
  return (groqJson.text || "").trim();
}

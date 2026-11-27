import type http from "http";
import crypto from "crypto";
import { WebSocket, WebSocketServer } from "ws";
import { GoogleGenAI, Modality, type LiveServerMessage } from "@google/genai";
import {
  HUMAN_LIVE_QA_SYSTEM_PROMPT,
  type LiveQaPipeline,
  type LiveQaServerEvent,
  type LiveQaServerStatus,
} from "../src/lib/liveQaPrompts.ts";
import type {
  ActiveProblemContext,
  TargetProfile,
} from "../src/types.ts";
import {
  buildDsaFollowUpSystemPrompt,
  buildHumanInterviewSystemPrompt,
  normalizeProgrammingLanguage,
} from "./dsaEngine.ts";

export interface LiveQaContextProvider {
  getProfile: () => TargetProfile;
  getActiveProblem: () => ActiveProblemContext | null;
}

const DEEPGRAM_WS_URL =
  "wss://api.deepgram.com/v1/listen?model=nova-3&encoding=linear16&sample_rate=16000&channels=1&smart_format=true&interim_results=true&endpointing=900&utterance_end_ms=1200";
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const GEMINI_LIVE_MODEL = "gemini-3.8-live";

function readCleanKey(name: string, placeholder?: string): string {
  const val = process.env[name]?.trim() || "";
  if (!val || (placeholder && val === placeholder)) return "";
  return val;
}

export function getLiveQaServerStatus(): LiveQaServerStatus {
  const deepgramConfigured = Boolean(readCleanKey("DEEPGRAM_API_KEY"));
  const groqConfigured = Boolean(readCleanKey("GROQ_API_KEY"));
  const geminiConfigured = Boolean(
    readCleanKey("GEMINI_API_KEY", "MY_GEMINI_API_KEY")
  );
  return {
    deepgramConfigured,
    groqConfigured,
    geminiConfigured,
    pipelineAReady: deepgramConfigured && groqConfigured,
    pipelineBReady: geminiConfigured,
    pipelineAModels: {
      stt: "deepgram/nova-3",
      llm: `groq/${GROQ_MODEL}`,
    },
    pipelineBModel: GEMINI_LIVE_MODEL,
  };
}

function sendJson(ws: WebSocket, event: LiveQaServerEvent): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event));
  }
}

interface ClientStartMessage {
  type: "start";
  pipeline: LiveQaPipeline;
}

interface ClientAudioMessage {
  type: "audio";
  data: string; // base64 signed 16-bit LE PCM @ 16kHz
}

interface ClientTextQuestionMessage {
  type: "text_question";
  text: string;
}

interface ClientStopMessage {
  type: "stop";
}

type ClientInboundMessage =
  | ClientStartMessage
  | ClientAudioMessage
  | ClientTextQuestionMessage
  | ClientStopMessage;

export function attachLiveQaWebSocketServer(
  httpServer: http.Server,
  contextProvider?: LiveQaContextProvider
): void {
  const buildDynamicLiveSystemPrompt = (): string => {
    if (!contextProvider) return HUMAN_LIVE_QA_SYSTEM_PROMPT;
    const profile = contextProvider.getProfile();
    const activeProblem = contextProvider.getActiveProblem();
    if (profile.dsaModeEnabled && activeProblem) {
      return buildDsaFollowUpSystemPrompt({
        problemContext: activeProblem,
        preferredLanguage: normalizeProgrammingLanguage(
          profile.preferredLanguage || activeProblem.preferredLanguage
        ),
        answerLanguage: profile.answerLanguage,
        role: profile.role,
        experience: profile.experience,
      });
    }
    return buildHumanInterviewSystemPrompt({
      role: profile.role,
      experience: profile.experience,
      skills: profile.skills,
      resumeText: profile.resumeText,
      jdText: profile.jdText,
      answerLanguage: profile.answerLanguage,
      answerStyle: profile.answerStyle,
    });
  };

  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    const pathname = (req.url || "").split("?")[0];
    if (pathname !== "/ws/live-qa") {
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (clientWs) => {
    let activeCleanup: (() => void) | null = null;
    let activeAudioSender: ((pcmBase64: string) => void) | null = null;
    let activeTextSender: ((text: string) => void) | null = null;

    const cleanupCurrentPipeline = () => {
      if (activeCleanup) {
        try {
          activeCleanup();
        } catch (err) {
          console.error("[LiveQA] Pipeline cleanup error:", err);
        }
        activeCleanup = null;
      }
      activeAudioSender = null;
      activeTextSender = null;
    };

    const startDeepgramGroqPipeline = () => {
      cleanupCurrentPipeline();

      const dgKey = readCleanKey("DEEPGRAM_API_KEY");
      const groqKey = readCleanKey("GROQ_API_KEY");

      if (!dgKey || !groqKey) {
        const missing = [!dgKey && "DEEPGRAM_API_KEY", !groqKey && "GROQ_API_KEY"]
          .filter(Boolean)
          .join(" and ");
        sendJson(clientWs, {
          type: "error",
          code: "MISSING_ENV_KEYS",
          message: `Pipeline A requires ${missing} configured on the server (.env or Settings → Secrets). Switch to Pipeline B (Gemini Live API) to test immediately.`,
        });
        return;
      }

      let closed = false;
      let utteranceBuffer = "";
      let currentGroqAbort: AbortController | null = null;
      const conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [];

      const streamGroqAnswer = async (questionText: string, speechEndedAt: number) => {
        const trimmed = questionText.trim();
        if (!trimmed || closed) return;

        if (currentGroqAbort) {
          currentGroqAbort.abort();
        }
        const abortController = new AbortController();
        currentGroqAbort = abortController;

        const turnId = `dg-${crypto.randomBytes(4).toString("hex")}`;
        sendJson(clientWs, {
          type: "answer_start",
          turnId,
          transcript: trimmed,
          speechEndedAt,
        });

        let firstTokenSent = false;
        let fullAnswer = "";

        try {
          const resp = await fetch(GROQ_CHAT_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${groqKey}`,
            },
            signal: abortController.signal,
            body: JSON.stringify({
              model: GROQ_MODEL,
              stream: true,
              temperature: 0.72,
              max_tokens: 340,
              messages: [
                { role: "system", content: buildDynamicLiveSystemPrompt() },
                ...conversationHistory.slice(-4),
                { role: "user", content: trimmed },
              ],
            }),
          });

          if (!resp.ok || !resp.body) {
            const errBody = await resp.text();
            throw new Error(`Groq API error (${resp.status}): ${errBody.slice(0, 180)}`);
          }

          const reader = resp.body.getReader();
          const decoder = new TextDecoder();
          let sseBuffer = "";

          while (!closed) {
            const { done, value } = await reader.read();
            if (done) break;
            sseBuffer += decoder.decode(value, { stream: true });
            const lines = sseBuffer.split("\n");
            sseBuffer = lines.pop() || "";

            for (const line of lines) {
              const cleaned = line.trim();
              if (!cleaned.startsWith("data:")) continue;
              const payloadStr = cleaned.slice(5).trim();
              if (payloadStr === "[DONE]") continue;
              try {
                const parsed = JSON.parse(payloadStr) as {
                  choices?: Array<{ delta?: { content?: string } }>;
                };
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  fullAnswer += delta;
                  const serverTtfwMs = !firstTokenSent
                    ? Math.max(1, Date.now() - speechEndedAt)
                    : undefined;
                  firstTokenSent = true;
                  sendJson(clientWs, {
                    type: "answer_delta",
                    turnId,
                    delta,
                    serverTtfwMs,
                  });
                }
              } catch {
                // Ignore partial SSE JSON chunks
              }
            }
          }

          if (fullAnswer.trim()) {
            conversationHistory.push(
              { role: "user", content: trimmed },
              { role: "assistant", content: fullAnswer.trim() }
            );
            if (conversationHistory.length > 8) {
              conversationHistory.splice(0, conversationHistory.length - 8);
            }
          }

          sendJson(clientWs, { type: "answer_done", turnId });
        } catch (err) {
          if ((err as Error).name === "AbortError") {
            return;
          }
          const msg = err instanceof Error ? err.message : "Groq streaming error.";
          console.error("[LiveQA Pipeline A - Groq]", msg);
          sendJson(clientWs, { type: "error", message: msg });
        }
      };

      const dgWs = new WebSocket(DEEPGRAM_WS_URL, {
        headers: {
          Authorization: `Token ${dgKey}`,
        },
      });

      // KeepAlive ping every 8 seconds so Deepgram stays open during quiet pauses
      const keepAliveTimer = setInterval(() => {
        if (dgWs.readyState === WebSocket.OPEN) {
          dgWs.send(JSON.stringify({ type: "KeepAlive" }));
        }
      }, 8000);

      dgWs.on("open", () => {
        if (closed) {
          dgWs.close();
          return;
        }
        sendJson(clientWs, {
          type: "ready",
          pipeline: "deepgram-groq",
          modelInfo: `Deepgram Nova-3 (endpointing=900ms, utterance_end=1200ms) → Groq ${GROQ_MODEL}`,
        });
      });

      dgWs.on("message", (raw) => {
        if (closed) return;
        try {
          const msg = JSON.parse(raw.toString()) as {
            type?: string;
            is_final?: boolean;
            speech_final?: boolean;
            channel?: { alternatives?: Array<{ transcript?: string }> };
          };

          if (msg.type === "Results") {
            const transcript = msg.channel?.alternatives?.[0]?.transcript?.trim() || "";
            const isFinal = Boolean(msg.is_final);
            const speechFinal = Boolean(msg.speech_final);

            if (transcript) {
              if (isFinal) {
                utteranceBuffer = utteranceBuffer
                  ? `${utteranceBuffer} ${transcript}`
                  : transcript;
              }
              const displayText = isFinal
                ? utteranceBuffer
                : utteranceBuffer
                  ? `${utteranceBuffer} ${transcript}`
                  : transcript;

              sendJson(clientWs, {
                type: "transcript",
                text: displayText,
                isFinal,
                speechFinal,
                speechEndedAt: speechFinal ? Date.now() : undefined,
              });
            }

            if (speechFinal && utteranceBuffer.trim()) {
              const completeQuestion = utteranceBuffer.trim();
              utteranceBuffer = "";
              void streamGroqAnswer(completeQuestion, Date.now());
            }
          } else if (msg.type === "UtteranceEnd" && utteranceBuffer.trim()) {
            const completeQuestion = utteranceBuffer.trim();
            utteranceBuffer = "";
            sendJson(clientWs, {
              type: "transcript",
              text: completeQuestion,
              isFinal: true,
              speechFinal: true,
              speechEndedAt: Date.now(),
            });
            void streamGroqAnswer(completeQuestion, Date.now());
          }
        } catch (err) {
          console.error("[LiveQA Pipeline A - Deepgram parse]", err);
        }
      });

      dgWs.on("error", (err) => {
        console.error("[LiveQA Pipeline A - Deepgram WS error]:", err.message);
        sendJson(clientWs, {
          type: "error",
          message: `Deepgram connection failed: ${err.message}. Verify your DEEPGRAM_API_KEY.`,
        });
      });

      dgWs.on("close", (code, reason) => {
        if (!closed && code !== 1000) {
          const reasonStr = reason?.toString() || `code ${code}`;
          sendJson(clientWs, {
            type: "error",
            message: `Deepgram stream closed (${reasonStr}).`,
          });
        }
      });

      activeAudioSender = (pcmBase64: string) => {
        if (dgWs.readyState === WebSocket.OPEN) {
          dgWs.send(Buffer.from(pcmBase64, "base64"));
        }
      };

      activeTextSender = (text: string) => {
        utteranceBuffer = "";
        sendJson(clientWs, {
          type: "transcript",
          text,
          isFinal: true,
          speechFinal: true,
          speechEndedAt: Date.now(),
        });
        void streamGroqAnswer(text, Date.now());
      };

      activeCleanup = () => {
        closed = true;
        clearInterval(keepAliveTimer);
        if (currentGroqAbort) {
          currentGroqAbort.abort();
          currentGroqAbort = null;
        }
        try {
          if (dgWs.readyState === WebSocket.OPEN) {
            dgWs.send(JSON.stringify({ type: "CloseStream" }));
          }
          dgWs.close();
        } catch {
          // Ignore close errors
        }
      };
    };

    const startGeminiLivePipeline = async () => {
      cleanupCurrentPipeline();

      const geminiKey = readCleanKey("GEMINI_API_KEY", "MY_GEMINI_API_KEY");
      if (!geminiKey) {
        sendJson(clientWs, {
          type: "error",
          code: "MISSING_GEMINI_KEY",
          message:
            "GEMINI_API_KEY is not configured on the server. Add it in Settings → Secrets or .env.",
        });
        return;
      }

      let closed = false;
      let currentTurnId: string | null = null;
      let currentInputTranscript = "";
      let lastInputTranscriptAt = Date.now();
      let firstOutputDeltaSent = false;
      let generationCompleteTimer: ReturnType<typeof setTimeout> | null = null;
      let generationDoneFlag = false;

      const clearGenTimer = () => {
        if (generationCompleteTimer) {
          clearTimeout(generationCompleteTimer);
          generationCompleteTimer = null;
        }
      };

      const finishCurrentTurn = () => {
        clearGenTimer();
        if (currentTurnId) {
          sendJson(clientWs, { type: "answer_done", turnId: currentTurnId });
        }
        currentTurnId = null;
        currentInputTranscript = "";
        firstOutputDeltaSent = false;
        generationDoneFlag = false;
      };

      const ai = new GoogleGenAI({
        apiKey: geminiKey,
        apiVersion: "v1beta",
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      try {
        const session = await ai.live.connect({
          model: GEMINI_LIVE_MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction: buildDynamicLiveSystemPrompt(),
          },
          callbacks: {
            onopen: () => {
              // Wait until ai.live.connect resolves (setupComplete) and senders are bound before emitting ready
            },
            onmessage: (message: LiveServerMessage) => {
              if (closed) return;
              const content = message.serverContent;
              if (!content) return;

              // Live incoming speech transcription from Gemini built-in VAD
              if (content.inputTranscription?.text) {
                const chunk = content.inputTranscription.text;
                currentInputTranscript = currentInputTranscript
                  ? `${currentInputTranscript}${chunk}`
                  : chunk;
                lastInputTranscriptAt = Date.now();
                sendJson(clientWs, {
                  type: "transcript",
                  text: currentInputTranscript.trim(),
                  isFinal: false,
                });
              }

              // Extract streaming text response (from outputTranscription or non-thought text parts)
              let deltaText = "";
              if (content.outputTranscription?.text) {
                deltaText += content.outputTranscription.text;
              }
              for (const part of content.modelTurn?.parts ?? []) {
                const isThought = Boolean((part as { thought?: boolean }).thought);
                if (part.text && !isThought) {
                  deltaText += part.text;
                }
                // Consume/drain audio part cleanly per Live API multimodal contract
                // (Silent text overlay by default so interview audio doesn't play back out loud)
                if (part.inlineData?.data) {
                  void part.inlineData.data.length;
                }
              }

              if (deltaText) {
                if (!currentTurnId) {
                  currentTurnId = `gem-${crypto.randomBytes(4).toString("hex")}`;
                  firstOutputDeltaSent = false;
                  generationDoneFlag = false;
                  const finalQuestion =
                    currentInputTranscript.trim() || "Live spoken question";
                  sendJson(clientWs, {
                    type: "answer_start",
                    turnId: currentTurnId,
                    transcript: finalQuestion,
                    speechEndedAt: lastInputTranscriptAt,
                  });
                }

                const serverTtfwMs = !firstOutputDeltaSent
                  ? Math.max(1, Date.now() - lastInputTranscriptAt)
                  : undefined;
                firstOutputDeltaSent = true;
                sendJson(clientWs, {
                  type: "answer_delta",
                  turnId: currentTurnId,
                  delta: deltaText,
                  serverTtfwMs,
                });

                // If generationComplete already arrived, extend debounce window so trailing transcription words never drop
                if (generationDoneFlag) {
                  clearGenTimer();
                  generationCompleteTimer = setTimeout(finishCurrentTurn, 650);
                }
              }

              if (content.interrupted) {
                clearGenTimer();
                sendJson(clientWs, { type: "interrupted" });
                currentTurnId = null;
                firstOutputDeltaSent = false;
                generationDoneFlag = false;
              }

              if (content.generationComplete && currentTurnId) {
                generationDoneFlag = true;
                clearGenTimer();
                generationCompleteTimer = setTimeout(finishCurrentTurn, 650);
              }

              if (content.turnComplete) {
                finishCurrentTurn();
              }
            },
            onerror: (err) => {
              console.error("[LiveQA Pipeline B - Gemini Live error]:", err);
              if (!closed) {
                sendJson(clientWs, {
                  type: "error",
                  message:
                    err instanceof Error
                      ? err.message
                      : "Gemini Live API WebSocket error.",
                });
              }
            },
            onclose: () => {
              if (!closed) {
                console.log("[LiveQA Pipeline B - Gemini Live session closed]");
              }
            },
          },
        });

        if (closed) {
          session.close();
          return;
        }

        activeAudioSender = (pcmBase64: string) => {
          if (closed) return;
          try {
            session.sendRealtimeInput({
              audio: {
                data: pcmBase64,
                mimeType: "audio/pcm;rate=16000",
              },
            });
          } catch (err) {
            console.error("[LiveQA Pipeline B - sendRealtimeInput error]:", err);
          }
        };

        activeTextSender = (text: string) => {
          if (closed) return;
          clearGenTimer();
          currentTurnId = null;
          firstOutputDeltaSent = false;
          generationDoneFlag = false;
          currentInputTranscript = text;
          lastInputTranscriptAt = Date.now();
          sendJson(clientWs, {
            type: "transcript",
            text,
            isFinal: true,
            speechFinal: true,
            speechEndedAt: lastInputTranscriptAt,
          });
          try {
            session.sendClientContent({
              turns: [{ role: "user", parts: [{ text }] }],
              turnComplete: true,
            });
          } catch (err) {
            console.error("[LiveQA Pipeline B - sendClientContent error]:", err);
            sendJson(clientWs, {
              type: "error",
              message:
                err instanceof Error ? err.message : "Failed to send prompt to Gemini Live.",
            });
          }
        };

        activeCleanup = () => {
          closed = true;
          clearGenTimer();
          try {
            session.close();
          } catch {
            // Ignore close errors
          }
        };

        // Emit ready only after Live setup is complete and both audio & text senders are bound
        sendJson(clientWs, {
          type: "ready",
          pipeline: "gemini-live",
          modelInfo: `Google Gemini Live API (${GEMINI_LIVE_MODEL}, built-in VAD, 16kHz PCM)`,
        });
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to connect to Gemini Live API.";
        console.error("[LiveQA Pipeline B - connect failed]:", msg);
        sendJson(clientWs, { type: "error", message: msg });
      }
    };

    clientWs.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as ClientInboundMessage;
        if (msg.type === "start") {
          if (msg.pipeline === "deepgram-groq") {
            startDeepgramGroqPipeline();
          } else {
            void startGeminiLivePipeline();
          }
        } else if (msg.type === "audio" && msg.data) {
          activeAudioSender?.(msg.data);
        } else if (msg.type === "text_question" && msg.text?.trim()) {
          activeTextSender?.(msg.text.trim());
        } else if (msg.type === "stop") {
          cleanupCurrentPipeline();
        }
      } catch (err) {
        console.error("[LiveQA] Invalid client WS message:", err);
      }
    });

    clientWs.on("close", () => {
      cleanupCurrentPipeline();
    });

    clientWs.on("error", (err) => {
      console.error("[LiveQA] Client WS error:", err.message);
      cleanupCurrentPipeline();
    });
  });
}

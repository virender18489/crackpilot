import type { LiveQaAudioSource } from "./liveQaPrompts";

export interface PcmCaptureCallbacks {
  onPcmChunk: (pcm16Buffer: ArrayBuffer, base64Pcm: string, rms: number) => void;
  onSpeechStateChange?: (speaking: boolean, rms: number) => void;
  onTrackEnded?: () => void;
}

export interface PcmCaptureSession {
  source: LiveQaAudioSource;
  actualSampleRate: number;
  stop: () => void;
}

const TARGET_SAMPLE_RATE = 16000;
const SPEECH_RMS_THRESHOLD = 0.014;
const SILENCE_HOLD_MS = 380;

/**
 * Downsamples Float32 PCM from any hardware rate (e.g. 48kHz / 44.1kHz) to exact 16kHz
 * signed 16-bit Little-Endian PCM required by Deepgram Nova-3 and Gemini Live API.
 */
function downsampleToInt16Pcm(
  input: Float32Array,
  inputSampleRate: number,
  targetSampleRate: number
): Int16Array {
  if (inputSampleRate === targetSampleRate) {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }

  const ratio = inputSampleRate / targetSampleRate;
  const outputLength = Math.max(1, Math.round(input.length / ratio));
  const result = new Int16Array(outputLength);

  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.min(
      input.length,
      Math.round((offsetResult + 1) * ratio)
    );
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer; i++) {
      accum += input[i];
      count++;
    }
    const sample = count > 0 ? accum / count : 0;
    const clamped = Math.max(-1, Math.min(1, sample));
    result[offsetResult] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

function int16ToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return window.btoa(binary);
}

/**
 * Starts real-time 16kHz 16-bit mono PCM audio capture from either the laptop Microphone
 * or System / Tab Audio (via getDisplayMedia with audio enabled).
 */
export async function startPcm16Capture(
  sourceType: LiveQaAudioSource,
  callbacks: PcmCaptureCallbacks
): Promise<PcmCaptureSession> {
  let mediaStream: MediaStream;

  if (sourceType === "system") {
    mediaStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      } as MediaTrackConstraints,
    });
    if (mediaStream.getAudioTracks().length === 0) {
      mediaStream.getTracks().forEach((t) => t.stop());
      throw new Error(
        'No system/tab audio track shared. Select a tab or screen and check "Share tab audio" or "Share system audio".'
      );
    }
  } else {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: TARGET_SAMPLE_RATE,
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: true,
      },
    });
  }

  const audioOnlyStream = new MediaStream(mediaStream.getAudioTracks());
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;

  let audioCtx: AudioContext;
  try {
    audioCtx = new AudioCtx({ sampleRate: TARGET_SAMPLE_RATE });
  } catch {
    audioCtx = new AudioCtx();
  }

  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }

  const sourceNode = audioCtx.createMediaStreamSource(audioOnlyStream);
  // 2048 frames @ 16kHz = ~128ms chunks (or ~42ms @ 48kHz) — ultra-low latency without flooding WS
  const bufferSize = audioCtx.sampleRate >= 44100 ? 4096 : 2048;
  const processorNode = audioCtx.createScriptProcessor(bufferSize, 1, 1);

  // Silent gain node so ScriptProcessorNode stays active without playing feedback echo
  const silentGain = audioCtx.createGain();
  silentGain.gain.value = 0;

  let stopped = false;
  let currentlySpeaking = false;
  let lastSpeechMs = 0;

  processorNode.onaudioprocess = (event) => {
    if (stopped) return;
    const channelData = event.inputBuffer.getChannelData(0);

    let sumSq = 0;
    for (let i = 0; i < channelData.length; i++) {
      sumSq += channelData[i] * channelData[i];
    }
    const rms = Math.sqrt(sumSq / channelData.length);
    const now = performance.now();

    if (rms >= SPEECH_RMS_THRESHOLD) {
      lastSpeechMs = now;
      if (!currentlySpeaking) {
        currentlySpeaking = true;
        callbacks.onSpeechStateChange?.(true, rms);
      }
    } else if (currentlySpeaking && now - lastSpeechMs > SILENCE_HOLD_MS) {
      currentlySpeaking = false;
      callbacks.onSpeechStateChange?.(false, rms);
    }

    const pcm16 = downsampleToInt16Pcm(
      channelData,
      audioCtx.sampleRate,
      TARGET_SAMPLE_RATE
    );
    const base64Pcm = int16ToBase64(pcm16);
    callbacks.onPcmChunk(pcm16.buffer as ArrayBuffer, base64Pcm, rms);
  };

  sourceNode.connect(processorNode);
  processorNode.connect(silentGain);
  silentGain.connect(audioCtx.destination);

  const stop = () => {
    if (stopped) return;
    stopped = true;
    try {
      processorNode.onaudioprocess = null;
      processorNode.disconnect();
      sourceNode.disconnect();
      silentGain.disconnect();
    } catch {
      // Ignore disconnect errors during teardown
    }
    mediaStream.getTracks().forEach((track) => {
      try {
        track.onended = null;
        track.stop();
      } catch {
        // Ignore
      }
    });
    void audioCtx.close().catch(() => {
      // Ignore
    });
  };

  for (const track of mediaStream.getTracks()) {
    track.onended = () => {
      stop();
      callbacks.onTrackEnded?.();
    };
  }

  return {
    source: sourceType,
    actualSampleRate: audioCtx.sampleRate,
    stop,
  };
}

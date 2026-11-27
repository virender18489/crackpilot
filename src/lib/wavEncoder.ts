/**
 * Pure Web Audio PCM -> 16kHz Mono 16-bit RIFF/WAV Encoder
 * Produces a complete, self-contained `.wav` Blob with a valid 44-byte RIFF header
 * for every spoken utterance, eliminating headerless MediaRecorder WebM chunk corruption.
 */

export const TARGET_WAV_SAMPLE_RATE = 16000;
export const MIN_UTTERANCE_DURATION_SEC = 0.4;

/**
 * Downsamples mono Float32 PCM audio from any hardware AudioContext sample rate
 * (e.g., 48000 Hz or 44100 Hz on Windows WASAPI) to 16000 Hz mono using box averaging.
 */
export function downsampleToMono16k(
  input: Float32Array,
  inputSampleRate: number,
  targetSampleRate = TARGET_WAV_SAMPLE_RATE
): Float32Array {
  if (!input.length) return new Float32Array(0);
  if (inputSampleRate <= targetSampleRate) {
    return input;
  }

  const ratio = inputSampleRate / targetSampleRate;
  const outputLength = Math.floor(input.length / ratio);
  if (outputLength <= 0) return new Float32Array(0);

  const result = new Float32Array(outputLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < outputLength) {
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
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

/**
 * Concatenates multiple Float32Array PCM frames into a single contiguous buffer.
 */
export function mergeFloat32Chunks(chunks: Float32Array[]): Float32Array {
  let totalLength = 0;
  for (const chunk of chunks) {
    totalLength += chunk.length;
  }
  const merged = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

function writeAscii(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Encodes Float32 PCM frames into a complete, valid 16-bit PCM WAV Blob (44-byte RIFF header)
 * at 16kHz mono. Returns `null` if the utterance is shorter than `minDurationSec` (default 0.4s)
 * or completely silent so background clicks never trigger empty transcription calls.
 */
export function encodePcm16WavBlob(
  chunks: Float32Array[],
  inputSampleRate: number,
  options?: {
    targetSampleRate?: number;
    minDurationSec?: number;
  }
): { blob: Blob; durationSec: number; byteLength: number } | null {
  if (!chunks.length || !inputSampleRate || inputSampleRate <= 0) {
    return null;
  }

  const targetSampleRate = options?.targetSampleRate ?? TARGET_WAV_SAMPLE_RATE;
  const minDurationSec = options?.minDurationSec ?? MIN_UTTERANCE_DURATION_SEC;

  const merged = mergeFloat32Chunks(chunks);
  const pcm16k = downsampleToMono16k(merged, inputSampleRate, targetSampleRate);
  const durationSec = pcm16k.length / targetSampleRate;

  if (durationSec < minDurationSec) {
    return null;
  }

  // Verify the utterance actually has audible signal (skip pure digital silence)
  let peak = 0;
  for (let i = 0; i < pcm16k.length; i++) {
    const abs = Math.abs(pcm16k[i]);
    if (abs > peak) peak = abs;
  }
  if (peak < 0.005) {
    return null;
  }

  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = targetSampleRate * blockAlign;
  const dataByteLength = pcm16k.length * bytesPerSample;
  const totalByteLength = 44 + dataByteLength;

  const buffer = new ArrayBuffer(totalByteLength);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataByteLength, true);
  writeAscii(view, 8, "WAVE");

  // fmt sub-chunk (PCM = 1)
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, targetSampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  writeAscii(view, 36, "data");
  view.setUint32(40, dataByteLength, true);

  // 16-bit signed little-endian PCM samples
  let offset = 44;
  for (let i = 0; i < pcm16k.length; i++) {
    const clamped = Math.max(-1, Math.min(1, pcm16k[i]));
    const sample = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(offset, Math.round(sample), true);
    offset += 2;
  }

  return {
    blob: new Blob([buffer], { type: "audio/wav" }),
    durationSec,
    byteLength: totalByteLength,
  };
}

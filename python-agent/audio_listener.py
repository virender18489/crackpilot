"""
VoiceBrief Python System-Audio Listener (Windows WASAPI / macOS Loopback)
-------------------------------------------------------------------------
Captures the interviewer's voice directly from system speakers/headphones
so you still hear them clearly while Python detects speech, sends audio to
OpenAI Whisper for transcription, and forwards the question to your Node.js
server for real-time OpenAI answers.
"""

import io
import os
import time
import wave
import numpy as np
import requests
import soundcard as sc
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
NODE_SERVER_URL = os.getenv("NODE_SERVER_URL", "http://localhost:3000/api/incoming-question")
SAMPLE_RATE = 16000
BLOCK_SECONDS = 0.5
SILENCE_THRESHOLD = 0.012
SILENCE_LIMIT_SECONDS = 1.6
MIN_SPEECH_SECONDS = 1.0

if not OPENAI_API_KEY:
    raise RuntimeError("Set OPENAI_API_KEY in your .env file before running.")

client = OpenAI(api_key=OPENAI_API_KEY)


def numpy_to_wav_bytes(audio_float32: np.ndarray, sample_rate: int) -> io.BytesIO:
    """Convert mono float32 audio array (-1.0..1.0) into an in-memory WAV buffer."""
    clipped = np.clip(audio_float32, -1.0, 1.0)
    pcm16 = (clipped * 32767).astype(np.int16)
    wav_buffer = io.BytesIO()
    with wave.open(wav_buffer, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm16.tobytes())
    wav_buffer.seek(0)
    wav_buffer.name = "interviewer.wav"
    return wav_buffer


def transcribe_buffer(audio_chunk: np.ndarray) -> str:
    """Send captured speech buffer to OpenAI Whisper API."""
    wav_file = numpy_to_wav_bytes(audio_chunk, SAMPLE_RATE)
    result = client.audio.transcriptions.create(
        model="whisper-1",
        file=wav_file,
    )
    return result.text.strip()


def send_to_node_server(question_text: str) -> None:
    """Forward transcribed interviewer question to the local Node.js backend."""
    try:
        resp = requests.post(
            NODE_SERVER_URL,
            json={"question": question_text, "source": "python-loopback"},
            timeout=10,
        )
        resp.raise_for_status()
        print(f"[Sent to Node] {question_text}")
    except Exception as exc:
        print(f"[Node Post Error] {exc}")


def run_loopback_listener() -> None:
    speaker = sc.default_speaker()
    loopback_mic = sc.get_microphone(id=str(speaker.name), include_loopback=True)
    print(f"Listening to system output: {speaker.name}")
    print("Keep your headphones on — you will hear the interviewer normally.")

    frames_per_block = int(SAMPLE_RATE * BLOCK_SECONDS)
    speech_blocks: list[np.ndarray] = []
    silence_duration = 0.0
    is_speaking = False

    with loopback_mic.recorder(samplerate=SAMPLE_RATE, channels=1) as recorder:
        while True:
            block = recorder.record(numframes=frames_per_block).flatten()
            rms = float(np.sqrt(np.mean(block ** 2)))

            if rms > SILENCE_THRESHOLD:
                speech_blocks.append(block)
                silence_duration = 0.0
                if not is_speaking:
                    is_speaking = True
                    print("[Voice detected] Capturing interviewer...")
            elif is_speaking:
                speech_blocks.append(block)
                silence_duration += BLOCK_SECONDS

                if silence_duration >= SILENCE_LIMIT_SECONDS:
                    total_audio = np.concatenate(speech_blocks)
                    duration = len(total_audio) / SAMPLE_RATE
                    speech_blocks.clear()
                    silence_duration = 0.0
                    is_speaking = False

                    if duration >= MIN_SPEECH_SECONDS:
                        print(f"[Transcribing {duration:.1f}s clip...]")
                        text = transcribe_buffer(total_audio)
                        if text:
                            send_to_node_server(text)
                        else:
                            print("[Skipped empty clip]")


if __name__ == "__main__":
    try:
        run_loopback_listener()
    except KeyboardInterrupt:
        print("\nStopped audio listener.")

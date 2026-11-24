import JSZip from "jszip";

export type DownloadPlatform = "windows" | "macos" | "extension";

export const SAMPLE_INTERVIEW_QUESTIONS = [
  {
    label: "React Re-renders",
    text: "How do you diagnose and eliminate unnecessary re-renders in a large React application?",
  },
  {
    label: "Node.js Scaling",
    text: "How would you design a rate-limited Node.js API that handles 5,000 requests per second?",
  },
  {
    label: "Resume Deep-Dive",
    text: "Walk me through the most challenging project on your resume and the technical trade-offs you made.",
  },
  {
    label: "Hinglish Scenario",
    text: "Agar production deployment ke baad memory leak aa jaye toh aap step-by-step kaise debug karoge?",
  },
];

function getAppOrigin(): string {
  return typeof window !== "undefined"
    ? window.location.origin
    : "http://localhost:3000";
}

const CRACKPILOT_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect width="256" height="256" rx="52" fill="#c6f527"/>
  <path d="M168 94c-8-14-22-22-40-22-30 0-50 22-50 56s20 56 50 56c18 0 32-8 40-22" fill="none" stroke="#050709" stroke-width="30" stroke-linecap="round"/>
</svg>`;

/**
 * Generates crisp 256x256 Crackpilot PNG bytes and wraps them into a valid
 * Windows 10/11 PNG-in-ICO binary so the Desktop shortcut & .exe display
 * the real branded lime Crackpilot icon.
 */
async function generateCrackpilotIconAssets(): Promise<{
  pngBytes: Uint8Array;
  icoBytes: Uint8Array;
}> {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    // Rounded electric lime square
    const r = 52;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(size - r, 0);
    ctx.quadraticCurveTo(size, 0, size, r);
    ctx.lineTo(size, size - r);
    ctx.quadraticCurveTo(size, size, size - r, size);
    ctx.lineTo(r, size);
    ctx.quadraticCurveTo(0, size, 0, size - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fillStyle = "#c6f527";
    ctx.fill();

    // Bold dark geometric "C" mark
    ctx.fillStyle = "#050709";
    ctx.font = "900 164px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("C", size / 2, size / 2 + 8);
  }

  const pngBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not encode Crackpilot PNG icon."));
    }, "image/png");
  });

  const pngBuffer = await pngBlob.arrayBuffer();
  const pngBytes = new Uint8Array(pngBuffer);

  // Standard 22-byte Windows ICO header wrapping 256x256 PNG
  const icoBytes = new Uint8Array(22 + pngBytes.length);
  const view = new DataView(icoBytes.buffer);
  view.setUint16(0, 0, true); // Reserved
  view.setUint16(2, 1, true); // Image type: 1 = icon (.ico)
  view.setUint16(4, 1, true); // Number of images
  icoBytes[6] = 0; // Width 256 (0 encodes 256 in ICO)
  icoBytes[7] = 0; // Height 256
  icoBytes[8] = 0; // Color palette
  icoBytes[9] = 0; // Reserved
  view.setUint16(10, 1, true); // Color planes
  view.setUint16(12, 32, true); // Bits per pixel
  view.setUint32(14, pngBytes.length, true); // Image byte size
  view.setUint32(18, 22, true); // Byte offset to PNG image data
  icoBytes.set(pngBytes, 22);

  return { pngBytes, icoBytes };
}

/**
 * Packages the Crackpilot Desktop Installer Kit (Electron + Branded Windows .ico + Python WASAPI Loopback Audio).
 * Uses standard OS display protection (setContentProtection / WDA_EXCLUDEFROMCAPTURE on Windows 10/11
 * and NSWindowSharingNone on macOS) + Always-On-Top floating overlay across tabs/windows.
 */
export async function downloadCrackpilotDesktopKit(tokenHint?: string): Promise<void> {
  const origin = getAppOrigin();
  const zip = new JSZip();

  try {
    const { pngBytes, icoBytes } = await generateCrackpilotIconAssets();
    zip.file("assets/crackpilot.ico", icoBytes);
    zip.file("assets/crackpilot.png", pngBytes);
  } catch {
    // Fallback to SVG icon if canvas unavailable
  }
  zip.file("assets/crackpilot.svg", CRACKPILOT_ICON_SVG);

  zip.file(
    "package.json",
    JSON.stringify(
      {
        name: "crackpilot-desktop",
        productName: "Crackpilot",
        version: "1.0.0",
        description:
          "Crackpilot floating always-on-top interview workspace with OS screen-share privacy and system loopback audio.",
        main: "electron/main.js",
        scripts: {
          start: "electron .",
          "build:win": "electron-builder --win nsis",
          "build:mac": "electron-builder --mac dmg",
        },
        build: {
          appId: "com.crackpilot.desktop",
          productName: "Crackpilot",
          win: {
            icon: "assets/crackpilot.ico",
            target: [{ target: "nsis", arch: ["x64"] }],
          },
          nsis: {
            oneClick: false,
            installerIcon: "assets/crackpilot.ico",
            uninstallerIcon: "assets/crackpilot.ico",
            createDesktopShortcut: true,
            createStartMenuShortcut: true,
            shortcutName: "Crackpilot",
          },
          mac: {
            icon: "assets/crackpilot.png",
            target: ["dmg"],
          },
        },
        dependencies: {
          electron: "^33.2.0",
        },
        devDependencies: {
          "electron-builder": "^25.1.8",
        },
      },
      null,
      2
    )
  );

  zip.file(
    "electron/main.js",
    `const path = require("path");
const { app, BrowserWindow, globalShortcut } = require("electron");

const CRACKPILOT_URL = process.env.CRACKPILOT_URL || "${origin}/?mode=software";
let overlayWindow = null;

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 1060,
    height: 740,
    minWidth: 480,
    minHeight: 380,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    hasShadow: true,
    icon: path.join(__dirname, "../assets/crackpilot.ico"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Standard OS Screen-Capture & Screenshot Privacy API:
  // Windows 10/11: SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)
  // macOS: NSWindowSharingNone
  overlayWindow.setContentProtection(true);

  // Keep overlay visible above all browser tabs and full-screen windows
  overlayWindow.setAlwaysOnTop(true, "screen-saver", 1);
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  overlayWindow.loadURL(CRACKPILOT_URL);
}

app.whenReady().then(() => {
  createOverlayWindow();

  // Global Alt+H shortcut to hide / show Crackpilot from any tab or app
  globalShortcut.register("Alt+H", () => {
    if (!overlayWindow) return;
    if (overlayWindow.isVisible()) {
      overlayWindow.hide();
    } else {
      overlayWindow.showInactive();
    }
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
`
  );

  zip.file(
    "python-agent/audio_listener.py",
    `"""
Crackpilot System Audio Loopback Listener (Windows WASAPI / macOS BlackHole)
Captures audio playing through your laptop headphones/earphones — including
Google Meet, Zoom, Microsoft Teams, or WhatsApp Desktop/Web calls — and sends
transcribed interviewer questions to your Crackpilot session.
"""

import io
import os
import wave
import numpy as np
import requests
import soundcard as sc
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
BRIDGE_URL = os.getenv("CRACKPILOT_BRIDGE_URL", "${origin}/api/incoming-question")
SAMPLE_RATE = 16000
BLOCK_SECONDS = 0.5
SILENCE_THRESHOLD = 0.011
SILENCE_LIMIT = 1.5
MIN_SPEECH_SECONDS = 1.0

if not OPENAI_API_KEY:
    raise RuntimeError("Add OPENAI_API_KEY in .env before running.")

client = OpenAI(api_key=OPENAI_API_KEY)


def to_wav(samples: np.ndarray) -> io.BytesIO:
    pcm = (np.clip(samples, -1.0, 1.0) * 32767).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(pcm.tobytes())
    buf.seek(0)
    buf.name = "audio.wav"
    return buf


def main() -> None:
    speaker = sc.default_speaker()
    loopback = sc.get_microphone(id=str(speaker.name), include_loopback=True)
    print(f"Crackpilot Audio Agent active on output device: {speaker.name}")
    print("Works with headphones/earphones on Meet, Zoom, Teams, and WhatsApp calls.")

    frames_per_block = int(SAMPLE_RATE * BLOCK_SECONDS)
    chunks = []
    silence = 0.0
    speaking = False

    with loopback.recorder(samplerate=SAMPLE_RATE, channels=1) as rec:
        while True:
            block = rec.record(numframes=frames_per_block).flatten()
            rms = float(np.sqrt(np.mean(block ** 2)))
            if rms > SILENCE_THRESHOLD:
                chunks.append(block)
                silence = 0.0
                speaking = True
            elif speaking:
                chunks.append(block)
                silence += BLOCK_SECONDS
                if silence >= SILENCE_LIMIT:
                    audio = np.concatenate(chunks)
                    chunks.clear()
                    silence = 0.0
                    speaking = False
                    if len(audio) / SAMPLE_RATE >= MIN_SPEECH_SECONDS:
                        res = client.audio.transcriptions.create(
                            model="whisper-1",
                            file=to_wav(audio),
                        )
                        text = res.text.strip()
                        if text:
                            requests.post(
                                BRIDGE_URL,
                                json={"question": text, "source": "headphone-loopback"},
                                timeout=10,
                            )
                            print(f"[Sent] {text}")


if __name__ == "__main__":
    main()
`
  );

  zip.file(
    "python-agent/requirements.txt",
    `openai>=1.58.0
soundcard>=0.4.3
numpy>=1.26.4
requests>=2.32.3
python-dotenv>=1.0.1
`
  );

  zip.file(
    "INSTALL_AND_CREATE_SHORTCUT_WINDOWS.bat",
    `@echo off
title Crackpilot Desktop Setup
echo ============================================
echo   Crackpilot Desktop Installer & Setup
echo ============================================
echo.
echo [1/3] Installing Electron Desktop runtime...
call npm install

echo [2/3] Creating branded Crackpilot icon shortcut on your Desktop...
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\\Crackpilot.lnk'); $s.TargetPath = 'cmd.exe'; $s.Arguments = '/c cd /d \"%~dp0\" && npm start'; $s.WorkingDirectory = '%~dp0'; $s.IconLocation = '%~dp0assets\\crackpilot.ico'; $s.Save()"

echo [3/3] Setup Complete!
echo - A Crackpilot icon has been created on your Desktop.
echo - Optional: Run 'npm run build:win' to generate Crackpilot Setup 1.0.0.exe.
echo.
pause
`
  );

  zip.file(
    ".env.example",
    `OPENAI_API_KEY=sk-your-openai-key
CRACKPILOT_URL=${origin}/?mode=software
CRACKPILOT_BRIDGE_URL=${origin}/api/incoming-question
${tokenHint ? `# Latest Token from Dashboard: ${tokenHint}\n` : ""}`
  );

  zip.file(
    "README.md",
    `# Crackpilot Desktop Installer Kit (Windows 10/11 & macOS)

## Quick Setup (Windows)
1. Extract this ZIP folder.
2. Double-click \`INSTALL_AND_CREATE_SHORTCUT_WINDOWS.bat\` to install Electron and create a branded **Crackpilot** icon on your Desktop.
3. To build a standalone \`Crackpilot Setup 1.0.0.exe\` installer with the Crackpilot icon, run:
   \`\`\`bash
   npm run build:win
   \`\`\`
   The generated \`.exe\` appears inside \`dist/\`.

## System Audio Capture (Headphones / WhatsApp / Meet / Zoom)
\`\`\`bash
cd python-agent
python -m venv venv
venv\\Scripts\\activate
pip install -r requirements.txt
python audio_listener.py
\`\`\`

## Built-In OS Privacy & Always-On-Top
- Uses \`BrowserWindow.setContentProtection(true)\` (Windows \`WDA_EXCLUDEFROMCAPTURE\` & macOS \`NSWindowSharingNone\`) so screenshots and screen-sharing sessions exclude the overlay window.
- Uses \`setAlwaysOnTop(true, "screen-saver")\` so the Crackpilot window stays visible when switching across browser tabs and desktop apps.
- Note: Standard OS desktop applications remain visible in Task Manager as required by Windows/macOS security models.
`
  );

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Crackpilot-Desktop-Installer-Kit.zip";
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Packages the Crackpilot Browser Extension (Manifest V3) with branded Crackpilot icon.
 */
export async function downloadCrackpilotExtension(): Promise<void> {
  const origin = getAppOrigin();
  const zip = new JSZip();

  try {
    const { pngBytes } = await generateCrackpilotIconAssets();
    zip.file("icon.png", pngBytes);
  } catch {
    // Ignore icon failure
  }

  zip.file(
    "manifest.json",
    JSON.stringify(
      {
        manifest_version: 3,
        name: "Crackpilot Overlay Companion",
        version: "1.0.0",
        description:
          "Keeps your Crackpilot interview assistant accessible across every browser tab.",
        permissions: ["storage", "activeTab"],
        icons: {
          "128": "icon.png",
        },
        action: {
          default_icon: "icon.png",
          default_popup: "popup.html",
          default_title: "Crackpilot",
        },
        content_scripts: [
          {
            matches: ["<all_urls>"],
            js: ["content.js"],
          },
        ],
      },
      null,
      2
    )
  );

  zip.file(
    "popup.html",
    `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      body { width: 280px; margin: 0; padding: 16px; background: #050709; color: #f8fafc; font-family: system-ui, sans-serif; }
      h1 { margin: 0 0 8px; font-size: 15px; display: flex; align-items: center; gap: 8px; }
      .logo { width: 22px; height: 22px; border-radius: 5px; background: #c6f527; color: #050709; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; }
      p { margin: 0 0 14px; font-size: 12px; color: #a1a1aa; line-height: 1.5; }
      a { display: block; text-align: center; background: #c6f527; color: #050709; text-decoration: none; padding: 9px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; }
    </style>
  </head>
  <body>
    <h1><span class="logo">C</span> crackpilot</h1>
    <p>Open the floating always-on-top Crackpilot overlay window to keep it visible across tabs.</p>
    <a href="${origin}/?mode=software" target="_blank">Launch Crackpilot Overlay</a>
  </body>
</html>
`
  );

  zip.file(
    "content.js",
    `// Registers Alt+Shift+C across tabs to open or focus Crackpilot
window.addEventListener("keydown", (event) => {
  if (event.altKey && event.shiftKey && event.key.toLowerCase() === "c") {
    window.open("${origin}/?mode=software", "crackpilot_overlay", "width=1040,height=720");
  }
});
`
  );

  zip.file(
    "INSTALL_EXTENSION.txt",
    `How to Install Crackpilot Browser Extension (Chrome / Edge / Brave):
1. Extract this ZIP folder.
2. Open chrome://extensions in your browser.
3. Turn ON "Developer mode" (top right).
4. Click "Load unpacked" and select the extracted folder.
5. Click the Crackpilot icon in your toolbar or press Alt+Shift+C on any tab!
`
  );

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Crackpilot-Browser-Extension.zip";
  a.click();
  URL.revokeObjectURL(url);
}

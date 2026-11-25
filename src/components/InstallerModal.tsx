import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FolderOpen,
  Headphones,
  KeyRound,
  LayoutDashboard,
  RefreshCw,
  Shield,
  X,
} from "lucide-react";
import {
  WINDOWS_EXE_FILENAME,
  WINDOWS_EXE_URL,
  type DownloadPlatform,
} from "../data/crackpilotPackages";
import { apiUrl } from "../lib/api";
import type { SessionTokenState } from "../types";

interface InstallerModalProps {
  open: boolean;
  platform: DownloadPlatform;
  tokenState: SessionTokenState | null;
  onTokenChange: (token: SessionTokenState | null) => void;
  onClose: () => void;
  onLaunchSoftware: () => void;
  onOpenDashboard: () => void;
  onOpenTestingLab: () => void;
}

export function InstallerModal({
  open,
  platform,
  tokenState,
  onTokenChange,
  onClose,
  onLaunchSoftware,
  onOpenDashboard,
  onOpenTestingLab,
}: InstallerModalProps) {
  const [stage, setStage] = useState<"icon" | "wizard">("icon");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [installProgress, setInstallProgress] = useState(0);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [generatingToken, setGeneratingToken] = useState(false);

  useEffect(() => {
    if (open) {
      setStage("icon");
      setStep(1);
      setInstallProgress(0);
    }
  }, [open, platform]);

  useEffect(() => {
    if (stage !== "wizard" || step !== 1) return;
    setInstallProgress(20);
    const t1 = window.setTimeout(() => setInstallProgress(65), 320);
    const t2 = window.setTimeout(() => setInstallProgress(100), 800);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [stage, step]);

  if (!open) return null;

  const isExtension = platform === "extension";
  const fileName = WINDOWS_EXE_FILENAME;

  const copyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCmd(id);
      setTimeout(() => setCopiedCmd(null), 1500);
    } catch {
      // Ignore
    }
  };

  const handleGenerateTokenInline = async () => {
    setGeneratingToken(true);
    try {
      const resp = await fetch(apiUrl("/api/token/generate"), { method: "POST" });
      const data = (await resp.json()) as { token?: SessionTokenState };
      if (resp.ok && data.token) {
        onTokenChange(data.token);
      }
    } finally {
      setGeneratingToken(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-2xl border border-white/12 bg-[#0b0f14] text-white shadow-2xl overflow-hidden">
        {/* Top Bar */}
        <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#070a0e] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-[5px] bg-[#c6f527] text-xs font-extrabold text-[#050709]">
              C
            </span>
            <span className="text-sm font-bold tracking-tight">
              Crackpilot Installer
            </span>
            <span className="font-mono text-[10px] text-[#c6f527] bg-[#1a2210] px-2 py-0.5 rounded">
              {isExtension ? "Extension" : "Windows .exe"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close installer"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* STAGE 1: Prominent Clickable Crackpilot Icon */}
        {stage === "icon" ? (
          <div className="p-6 sm:p-8 text-center space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-medium text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Downloaded: {fileName}</span>
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-extrabold text-white">
                Click the Crackpilot icon to continue setup
              </h2>
              <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                {isExtension
                  ? "Your browser extension package has downloaded. Click the Crackpilot icon below for quick setup."
                  : "Crackpilot-Setup.exe (native Windows installer with the Crackpilot icon) has started downloading. Double-click it in your Downloads bar or click the icon below to continue."}
              </p>
            </div>

            {/* Clickable Branded Crackpilot App Icon Tile */}
            <div className="flex justify-center py-2">
              <button
                type="button"
                onClick={() => setStage("wizard")}
                className="group relative flex flex-col items-center gap-3 rounded-2xl border border-[#c6f527]/40 bg-[#10160d] px-10 py-6 hover:border-[#c6f527] hover:bg-[#172110] transition-all cursor-pointer shadow-xl"
              >
                <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#c6f527] text-4xl font-black text-[#050709] shadow-lg group-hover:scale-105 transition-transform">
                  C
                </span>
                <div className="space-y-0.5">
                  <p className="text-base font-bold text-white">
                    {isExtension ? "crackpilot" : "Crackpilot-Setup.exe"}
                  </p>
                  <p className="font-mono text-[11px] text-[#c6f527] inline-flex items-center gap-1">
                    <span>Click to Continue Setup</span>
                    <ArrowRight className="h-3 w-3" />
                  </p>
                </div>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2 border-t border-white/[0.07]">
              <a
                href={WINDOWS_EXE_URL}
                download={WINDOWS_EXE_FILENAME}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-3.5 py-2 text-xs text-zinc-300 hover:bg-white/[0.08] cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download for Windows (.exe)</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLaunchSoftware();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-3.5 py-2 text-xs text-[#c6f527] hover:bg-white/[0.08] cursor-pointer"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Open Software Now</span>
              </button>
            </div>
          </div>
        ) : (
          /* STAGE 2: Interactive 3-Step Installation Wizard */
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                { id: 1 as const, label: "1. Run .exe Setup" },
                { id: 2 as const, label: "2. Audio & Overlay" },
                { id: 3 as const, label: "3. Token & Launch" },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStep(s.id)}
                  className={`rounded-lg border px-3 py-2 text-left font-semibold transition-colors cursor-pointer ${
                    step === s.id
                      ? "border-[#c6f527] bg-[#1a2210] text-[#c6f527]"
                      : step > s.id
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border-white/[0.08] bg-[#0d1218] text-zinc-400"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {step === 1 && (
              <div className="space-y-4">
                <div className="rounded-xl border border-white/[0.08] bg-[#070a0e] p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">
                      {installProgress < 100
                        ? `Verifying ${fileName}...`
                        : `${fileName} is ready to run`}
                    </span>
                    <span className="font-mono text-[#c6f527]">
                      {installProgress}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full bg-[#c6f527] transition-all duration-300"
                      style={{ width: `${installProgress}%` }}
                    />
                  </div>
                </div>

                {isExtension ? (
                  <div className="rounded-xl border border-white/[0.08] bg-[#10151c] p-4 space-y-2.5 text-xs text-zinc-300">
                    <p className="font-semibold text-white flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-[#c6f527]" />
                      <span>Install Browser Extension (Chrome / Edge)</span>
                    </p>
                    <ol className="list-decimal pl-4 space-y-1.5 text-zinc-400">
                      <li>Extract {fileName}.</li>
                      <li>
                        Open <code className="text-[#c6f527]">chrome://extensions</code> and enable{" "}
                        <strong className="text-white">Developer mode</strong>.
                      </li>
                      <li>
                        Click <strong className="text-white">Load unpacked</strong> and select the folder.
                      </li>
                    </ol>
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/[0.08] bg-[#10151c] p-4 space-y-2.5 text-xs text-zinc-300">
                    <p className="font-semibold text-white flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-[#c6f527]" />
                      <span>Install Crackpilot-Setup.exe (No ZIP Needed)</span>
                    </p>
                    <ol className="list-decimal pl-4 space-y-2 text-zinc-400">
                      <li>
                        Double-click{" "}
                        <strong className="text-[#c6f527]">
                          Crackpilot-Setup.exe
                        </strong>{" "}
                        in your browser Downloads list.
                      </li>
                      <li>
                        If Windows SmartScreen appears, click{" "}
                        <strong className="text-white">More info</strong> →{" "}
                        <strong className="text-white">Run anyway</strong>.
                      </li>
                      <li>
                        Click <strong className="text-white">OK</strong> —
                        Crackpilot installs automatically, creates the{" "}
                        <strong className="text-white">Crackpilot</strong> icon
                        on your Desktop, and launches the app window!
                      </li>
                    </ol>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => setStage("icon")}
                    className="text-xs text-zinc-400 hover:text-white cursor-pointer"
                  >
                    ← Back to Icon
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#c6f527] px-5 py-2 text-xs font-bold text-[#050709] hover:bg-[#b5e41c] cursor-pointer"
                  >
                    <span>Next: Audio &amp; Overlay</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="rounded-xl border border-white/[0.08] bg-[#10151c] p-4 space-y-2 text-xs">
                  <p className="font-semibold text-white flex items-center gap-2">
                    <Headphones className="h-4 w-4 text-[#c6f527]" />
                    <span>Headphone / WhatsApp / Meet Audio</span>
                  </p>
                  <p className="text-zinc-400 leading-relaxed">
                    Inside the Crackpilot window, click{" "}
                    <strong className="text-zinc-200">
                      Headphone / Tab Audio
                    </strong>{" "}
                    to capture interviewer speech on Meet, Zoom, Teams, or
                    WhatsApp Web even while wearing headphones.
                  </p>
                </div>

                <div className="rounded-xl border border-white/[0.08] bg-[#10151c] p-4 space-y-2 text-xs">
                  <p className="font-semibold text-white flex items-center gap-2">
                    <Shield className="h-4 w-4 text-[#c6f527]" />
                    <span>Always-On-Top Floating Mode</span>
                  </p>
                  <p className="text-zinc-400 leading-relaxed">
                    Click the pop-out icon in the top-right bar of Crackpilot
                    (or open Practice Mode / Testing Lab) to float Crackpilot
                    Always On Top across all browser tabs.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenTestingLab();
                    }}
                    className="text-xs font-medium text-[#c6f527] hover:underline cursor-pointer"
                  >
                    Open Practice / Testing Lab
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#c6f527] px-5 py-2 text-xs font-bold text-[#050709] hover:bg-[#b5e41c] cursor-pointer"
                  >
                    <span>Next: Auth Token &amp; Launch</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="rounded-xl border border-white/[0.08] bg-[#10151c] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-white flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-[#c6f527]" />
                      <span>48h Software Auth Token</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleGenerateTokenInline()}
                      disabled={generatingToken}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#c6f527] px-3 py-1 text-[11px] font-bold text-[#050709] hover:bg-[#b5e41c] cursor-pointer disabled:opacity-60"
                    >
                      <RefreshCw
                        className={`h-3 w-3 ${generatingToken ? "animate-spin" : ""}`}
                      />
                      <span>
                        {tokenState ? "Regenerate Token" : "Generate 48h Token"}
                      </span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#070a0e] px-3 py-2.5">
                    <span className="font-mono text-xs font-bold text-[#c6f527] truncate">
                      {tokenState?.token ||
                        "Click Generate 48h Token above to create your key"}
                    </span>
                    {tokenState?.token && (
                      <button
                        type="button"
                        onClick={() => void copyText("tok", tokenState.token)}
                        className="inline-flex items-center gap-1 rounded bg-white/[0.07] px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-white/[0.14] shrink-0 cursor-pointer"
                      >
                        {copiedCmd === "tok" ? (
                          <Check className="h-3 w-3 text-[#c6f527]" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                        <span>{copiedCmd === "tok" ? "Copied" : "Copy"}</span>
                      </button>
                    )}
                  </div>

                  <p className="text-[11px] text-zinc-400">
                    Copy this token, paste it into Crackpilot to Authenticate,
                    and click Start Session.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onLaunchSoftware();
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-[#c6f527] px-5 py-3 text-xs font-bold text-[#050709] hover:bg-[#b5e41c] transition-colors cursor-pointer"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-[#050709] text-[10px] font-black text-[#c6f527]">
                      C
                    </span>
                    <span>Open Crackpilot Software &amp; Authenticate</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenDashboard();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-4 py-3 text-xs font-semibold text-zinc-200 hover:bg-white/[0.08] cursor-pointer"
                  >
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    <span>Workspace</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

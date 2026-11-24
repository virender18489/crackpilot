import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  Lock,
  Mail,
  User,
} from "lucide-react";
import { downloadCrackpilotDesktopKit } from "../data/crackpilotPackages";
import type { UserAccount } from "../types";

interface LoginViewProps {
  onBackHome: () => void;
  onLoginSuccess: (user: UserAccount) => void;
  onLaunchSoftware: () => void;
}

export function LoginView({
  onBackHome,
  onLoginSuccess,
  onLaunchSoftware,
}: LoginViewProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [autoDownloadKit, setAutoDownloadKit] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedInUser, setSignedInUser] = useState<UserAccount | null>(null);
  const [kitDownloaded, setKitDownloaded] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setSubmitting(true);
    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
        }),
      });
      const data = (await resp.json()) as {
        ok?: boolean;
        user?: UserAccount;
        error?: string;
      };
      if (!resp.ok || !data.user) {
        throw new Error(data.error || "Login failed.");
      }

      if (autoDownloadKit) {
        await downloadCrackpilotDesktopKit();
        setKitDownloaded(true);
      }
      setSignedInUser(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#050709] text-white flex flex-col"
      style={{
        background:
          "radial-gradient(ellipse 55% 75% at 85% 20%, rgba(132, 184, 24, 0.16), rgba(5, 7, 9, 1) 65%)",
      }}
    >
      <header className="border-b border-white/[0.08] bg-[#050709]/90">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-2 text-sm text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to crackpilot</span>
          </button>
          <span className="font-mono text-[11px] text-zinc-400">
            WORKSPACE LOGIN
          </span>
        </div>
      </header>

      <div className="flex-1 mx-auto grid w-full max-w-5xl gap-10 px-5 py-12 lg:grid-cols-12 lg:items-center">
        {/* Left info column */}
        <div className="lg:col-span-5 space-y-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#c6f527] text-sm font-extrabold text-[#050709]">
              C
            </span>
            <span className="text-lg font-bold tracking-tight text-white">
              crackpilot
            </span>
            <span className="rounded bg-white/[0.07] px-2 py-0.5 font-mono text-[10px] text-zinc-400">
              WORKSPACE
            </span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-white leading-[1.1]">
            Sign in to download Crackpilot and generate your 48h token.
          </h1>

          <p className="text-sm leading-relaxed text-zinc-400">
            After login, your Crackpilot Desktop Installer Kit downloads
            automatically with the Windows Desktop shortcut creator and native{" "}
            <code className="text-zinc-200">.exe</code> setup. Then open
            Workspace → Overview to generate your token and start your session.
          </p>

          <div className="space-y-2.5 pt-2 text-xs text-zinc-300">
            <p className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#c6f527] shrink-0" />
              <span>Creates a Crackpilot Desktop icon for instant launch</span>
            </p>
            <p className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#c6f527] shrink-0" />
              <span>
                Upload Resume &amp; JD in Target Profile for personalized answers
              </span>
            </p>
            <p className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#c6f527] shrink-0" />
              <span>
                Token-verified software connection with live Start Session sync
              </span>
            </p>
          </div>
        </div>

        {/* Right card: Form or Post-Login Desktop Icon Launcher */}
        <div className="lg:col-span-7">
          {!signedInUser ? (
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-white/[0.09] bg-[#0c1015] p-6 sm:p-8 space-y-5 shadow-2xl"
            >
              <div>
                <h2 className="text-xl font-bold text-white">
                  Login to Workspace
                </h2>
                <p className="mt-1 text-xs text-zinc-400">
                  Enter your details to open your Crackpilot Dashboard and
                  download the desktop installer package.
                </p>
              </div>

              <div className="space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-zinc-300">
                    Full Name
                  </span>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Aarav Mehta"
                      className="w-full rounded-lg border border-white/10 bg-[#070a0e] py-2.5 pl-9 pr-3 text-sm text-white placeholder-zinc-500 focus:border-[#c6f527] focus:outline-none"
                    />
                  </div>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-zinc-300">
                    Email Address
                  </span>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="aarav@example.com"
                      className="w-full rounded-lg border border-white/10 bg-[#070a0e] py-2.5 pl-9 pr-3 text-sm text-white placeholder-zinc-500 focus:border-[#c6f527] focus:outline-none"
                    />
                  </div>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-zinc-300">
                    Password
                  </span>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full rounded-lg border border-white/10 bg-[#070a0e] py-2.5 pl-9 pr-3 text-sm text-white placeholder-zinc-500 focus:border-[#c6f527] focus:outline-none"
                    />
                  </div>
                </label>

                <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoDownloadKit}
                    onChange={(e) => setAutoDownloadKit(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-600 bg-[#070a0e] accent-[#c6f527]"
                  />
                  <span className="text-xs leading-relaxed text-zinc-300">
                    Automatically download{" "}
                    <strong className="text-white">
                      Crackpilot-Desktop-Installer-Kit.zip
                    </strong>{" "}
                    (includes Desktop shortcut script &amp; Windows{" "}
                    <code className="text-[#c6f527]">.exe</code> builder) right
                    after login
                  </span>
                </label>
              </div>

              {error && (
                <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#c6f527] px-4 py-3 text-sm font-bold text-[#050709] hover:bg-[#b5e41c] transition-colors cursor-pointer disabled:opacity-60"
              >
                <span>
                  {submitting
                    ? "Signing in & Downloading Setup..."
                    : "Login & Download Crackpilot"}
                </span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          ) : (
            <div className="rounded-2xl border border-white/[0.09] bg-[#0c1015] p-6 sm:p-8 space-y-6 shadow-2xl">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-[#c6f527] shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Welcome, {signedInUser.name}
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-300">
                    {kitDownloaded
                      ? "Your Crackpilot Desktop Installer Kit has started downloading. Extract it and double-click INSTALL_AND_CREATE_SHORTCUT_WINDOWS.bat to place the Crackpilot icon on your Desktop."
                      : "You are signed in. You can download the Desktop Installer Kit anytime from Workspace → Downloads."}
                  </p>
                </div>
              </div>

              {/* Desktop Icon Launcher */}
              <div className="rounded-xl border border-white/10 bg-[#070a0e] p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => {
                    onLoginSuccess(signedInUser);
                    onLaunchSoftware();
                  }}
                  className="group flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-[#11161d] px-6 py-4 hover:border-[#c6f527]/60 transition-colors cursor-pointer"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#c6f527] text-xl font-extrabold text-[#050709] shadow-lg group-hover:scale-105 transition-transform">
                    C
                  </span>
                  <span className="text-xs font-bold text-white">
                    crackpilot
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    Click to Launch App
                  </span>
                </button>

                <div className="flex-1 space-y-2 text-xs text-zinc-300">
                  <p className="font-semibold text-white">
                    Next Steps to Connect:
                  </p>
                  <ol className="list-decimal pl-4 space-y-1 text-zinc-400">
                    <li>
                      Open <strong className="text-zinc-200">Workspace</strong>{" "}
                      → <strong className="text-zinc-200">Overview</strong> and
                      click{" "}
                      <strong className="text-[#c6f527]">
                        Generate 48h Token
                      </strong>
                      .
                    </li>
                    <li>
                      Open <strong className="text-zinc-200">Crackpilot</strong>
                      , paste the token, and click{" "}
                      <strong className="text-[#c6f527]">Authenticate</strong>.
                    </li>
                    <li>
                      Click{" "}
                      <strong className="text-emerald-400">
                        Start Session
                      </strong>{" "}
                      to launch live answers.
                    </li>
                  </ol>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onLoginSuccess(signedInUser)}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-[#c6f527] px-4 py-2.5 text-sm font-bold text-[#050709] hover:bg-[#b5e41c] transition-colors cursor-pointer"
                >
                  <span>Go to Workspace Overview</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void downloadCrackpilotDesktopKit()}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2.5 text-xs font-medium text-zinc-200 hover:bg-white/[0.08] transition-colors cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Again</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

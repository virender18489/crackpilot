import { useState } from "react";
import { ArrowLeft, CheckCircle2, Sparkles } from "lucide-react";
import { loginAccount } from "../lib/clientStore";
import type { UserAccount } from "../types";

interface LoginViewProps {
  onBackHome: () => void;
  onLoginSuccess: (user: UserAccount) => void;
  onLaunchSoftware: () => void;
}

type AuthMode = "signin" | "signup" | "forgot";

export function LoginView({ onBackHome, onLoginSuccess }: LoginViewProps) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setResetSent(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (mode === "forgot") {
      setSubmitting(true);
      window.setTimeout(() => {
        setSubmitting(false);
        setResetSent(true);
      }, 350);
      return;
    }

    setSubmitting(true);
    try {
      const user = await loginAccount({
        email: email.trim(),
        name: mode === "signup" && name.trim() ? name.trim() : undefined,
      });
      onLoginSuccess(user);
    } catch (err) {
      console.error("[Crackpilot LoginView] Authentication failed:", err);
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#050709] text-white flex flex-col justify-between px-5 py-8 selection:bg-[#c6f527] selection:text-[#050709]"
      style={{
        background:
          "radial-gradient(ellipse 60% 60% at 50% 0%, rgba(198, 245, 39, 0.10), rgba(5, 7, 9, 1) 68%)",
      }}
    >
      {/* Top Bar: Crackpilot Brand + Back link */}
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-2 text-sm font-bold tracking-tight text-white cursor-pointer"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-[5px] bg-[#c6f527] text-xs font-extrabold text-[#050709]">
            C
          </span>
          <span>crackpilot</span>
        </button>

        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Home</span>
        </button>
      </div>

      {/* Centered Simple Auth Section in Crackpilot Dark + Electric Lime Theme */}
      <main className="mx-auto w-full max-w-[430px] py-10">
        <div className="rounded-2xl border border-white/[0.08] bg-[#0c1015]/95 p-7 sm:p-8 shadow-2xl space-y-6">
          {/* Header */}
          <div className="space-y-1.5">
            <h1 className="text-[28px] font-extrabold tracking-tight text-white leading-tight">
              {mode === "signin"
                ? "Welcome back"
                : mode === "signup"
                  ? "Create your account"
                  : "Forgot password"}
            </h1>
            <p className="text-sm text-zinc-400">
              {mode === "signin"
                ? "Sign in to your Crackpilot account"
                : mode === "signup"
                  ? "Get started with your Crackpilot workspace"
                  : "Enter your email and we’ll send a reset link"}
            </p>
          </div>

          {/* Forgot Password Success State */}
          {mode === "forgot" && resetSent ? (
            <div className="space-y-5">
              <div className="rounded-xl border border-[#c6f527]/30 bg-[#141c0d] p-4 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-[#c6f527] shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs leading-relaxed">
                  <p className="font-semibold text-white">Reset link sent</p>
                  <p className="text-zinc-300">
                    If an account exists for{" "}
                    <span className="font-mono text-[#c6f527]">{email}</span>,
                    check your inbox for password reset instructions.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="w-full rounded-xl bg-[#c6f527] hover:bg-[#b5e41c] py-3 text-sm font-bold text-[#050709] transition-colors cursor-pointer"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <label className="block space-y-1.5">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-300">
                    Full Name
                  </span>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Aarav Mehta"
                    className="w-full rounded-xl border border-white/10 bg-[#070a0e] px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-[#c6f527] focus:outline-none transition-colors"
                  />
                </label>
              )}

              <label className="block space-y-1.5">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-300">
                  Email Address
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full rounded-xl border border-white/10 bg-[#070a0e] px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-[#c6f527] focus:outline-none transition-colors"
                />
              </label>

              {mode !== "forgot" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="login-password"
                      className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-300"
                    >
                      Password
                    </label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={() => switchMode("forgot")}
                        className="text-xs font-medium text-[#c6f527] hover:text-[#d8fa61] transition-colors cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <input
                    id="login-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-white/10 bg-[#070a0e] px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-[#c6f527] focus:outline-none transition-colors"
                  />
                </div>
              )}

              {error && (
                <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3.5 py-2 text-xs text-rose-300">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-[#c6f527] hover:bg-[#b5e41c] py-3.5 text-sm font-bold text-[#050709] transition-colors cursor-pointer disabled:opacity-60"
              >
                {submitting
                  ? mode === "forgot"
                    ? "Sending Reset Link..."
                    : mode === "signup"
                      ? "Creating Account..."
                      : "Signing In..."
                  : mode === "forgot"
                    ? "Send Reset Link"
                    : mode === "signup"
                      ? "Get Started"
                      : "Sign In"}
              </button>
            </form>
          )}

          {/* OR Divider */}
          <div className="flex items-center gap-4">
            <span className="h-px flex-1 bg-white/[0.08]" />
            <span className="font-mono text-[11px] font-medium text-zinc-500">
              OR
            </span>
            <span className="h-px flex-1 bg-white/[0.08]" />
          </div>

          {/* Mode Switch Links */}
          <p className="text-center text-sm text-zinc-300">
            {mode === "signin" ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className="font-semibold text-[#c6f527] underline underline-offset-4 hover:text-[#d8fa61] cursor-pointer"
                >
                  Get Started
                </button>
              </>
            ) : (
              <>
                Remembered your password?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className="font-semibold text-[#c6f527] underline underline-offset-4 hover:text-[#d8fa61] cursor-pointer"
                >
                  Sign In
                </button>
              </>
            )}
          </p>

          {/* Bottom Agent Partner Pill matching Crackpilot lime theme */}
          <div className="border-t border-white/[0.08] pt-5 flex justify-center">
            <button
              type="button"
              onClick={onBackHome}
              className="inline-flex items-center gap-2 rounded-full border border-[#c6f527]/30 bg-[#141c0d] px-5 py-2.5 text-xs font-medium text-[#c6f527] hover:border-[#c6f527]/60 hover:bg-[#1a2510] transition-colors cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Want to become an Agent Partner? Apply Here</span>
            </button>
          </div>
        </div>
      </main>

      <div className="h-4" />
    </div>
  );
}

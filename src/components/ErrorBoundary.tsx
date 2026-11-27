import React from "react";
import { clearOverlayAuthStorage } from "../lib/clientStore";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Unexpected application error.";
    return {
      hasError: true,
      errorMessage: message,
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error("[Crackpilot ErrorBoundary] Caught runtime error:", error, info);
  }

  handleRecover = () => {
    try {
      clearOverlayAuthStorage();
    } catch {
      // Ignore storage cleanup errors
    }
    this.setState({ hasError: false, errorMessage: "" });
  };

  handleHardReload = () => {
    try {
      clearOverlayAuthStorage();
    } catch {
      // Ignore storage cleanup errors
    }
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen w-full bg-[#080d18] text-slate-100 flex flex-col">
        <header className="flex h-10 shrink-0 items-center justify-between border-b border-slate-700/60 bg-[#0d1220] px-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-[#405fe8] text-[11px] font-bold text-white">
              C
            </span>
            <span className="text-xs font-semibold tracking-tight text-slate-100">
              Crackpilot
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-slate-800 border border-slate-700 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#b4f416]">
              <span>v1.0.7</span>
              <span className="text-slate-500">•</span>
              <span className="text-emerald-300 font-normal">live</span>
            </span>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-xl border border-slate-700/70 bg-[#0d1424] p-6 space-y-4 shadow-2xl">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-white">
                {this.props.fallbackTitle || "Crackpilot Recovery Mode"}
              </h2>
              <p className="text-xs text-slate-400">
                A runtime error occurred during initialization. Resetting will
                return cleanly to the Authenticate Crackpilot screen.
              </p>
            </div>

            {this.state.errorMessage && (
              <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 font-mono text-xs text-rose-300 break-words">
                {this.state.errorMessage}
              </p>
            )}

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={this.handleRecover}
                className="flex-1 rounded-lg bg-[#405fe8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3552d6] transition-colors cursor-pointer"
              >
                Return to Authenticate
              </button>
              <button
                type="button"
                onClick={this.handleHardReload}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Reload App
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

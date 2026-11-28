import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import "./index.css";

declare global {
  interface Window {
    __CRACKPILOT_MOUNTED__?: boolean;
  }
}

const rootEl = document.getElementById("root");
if (rootEl) {
  try {
    createRoot(rootEl).render(
      <ErrorBoundary fallbackTitle="Authenticate Crackpilot — Recovery">
        <App />
      </ErrorBoundary>
    );
    window.__CRACKPILOT_MOUNTED__ = true;
  } catch (err) {
    console.error("[Crackpilot Bootstrap] Root render failed:", err);
    const msg = err instanceof Error ? err.message : String(err);
    const msgEl = document.getElementById("cp-boot-msg");
    const titleEl = document.getElementById("cp-boot-title");
    const retryBtn = document.getElementById("cp-boot-retry");
    if (titleEl) titleEl.textContent = "Crackpilot Startup Error";
    if (msgEl) msgEl.textContent = msg || "Failed to initialize React UI.";
    if (retryBtn) retryBtn.style.display = "inline-block";
  }
}

const { contextBridge, ipcRenderer } = require("electron");

function invokeSafe(channel, ...args) {
  return ipcRenderer.invoke(channel, ...args).catch((err) => {
    console.error(`[Crackpilot Preload] IPC invoke failed (${channel}):`, err);
    throw err;
  });
}

try {
  contextBridge.exposeInMainWorld("crackpilotDesktop", {
    isElectron: true,
    version: "1.0.7",
    minimizeWindow: () => invokeSafe("crackpilot:minimize"),
    minimizeWindowSync: () => {
      try {
        return Boolean(ipcRenderer.sendSync("crackpilot:minimize-sync"));
      } catch (err) {
        console.error("[Crackpilot Preload] minimizeWindowSync failed:", err);
        return false;
      }
    },
    hideWindow: () => invokeSafe("crackpilot:hide"),
    closeWindow: () => invokeSafe("crackpilot:close"),
    showWindow: () => invokeSafe("crackpilot:show"),
    toggleMaximize: () => invokeSafe("crackpilot:toggle-maximize"),
    setCompact: (compact) => invokeSafe("crackpilot:set-compact", compact),
    setOpacity: (opacity) => invokeSafe("crackpilot:set-opacity", opacity),
    setAlwaysOnTop: (enabled) =>
      invokeSafe("crackpilot:set-always-on-top", enabled),
    setBehindMode: (enabled) =>
      invokeSafe("crackpilot:set-behind-mode", Boolean(enabled)),
    toggleBehindMode: () => invokeSafe("crackpilot:toggle-behind-mode"),
    getBehindMode: () => invokeSafe("crackpilot:get-behind-mode"),
    setBehindHoverInteractive: (hovering) =>
      invokeSafe("crackpilot:set-behind-hover", Boolean(hovering)),
    openExternal: (url) => invokeSafe("crackpilot:open-external", url),
    reloadLiveApp: () => invokeSafe("crackpilot:reload-live"),
    captureScreen: () => invokeSafe("capture-screen"),
    onBehindModeChanged: (callback) => {
      if (typeof callback !== "function") return () => {};
      const handler = (_event, enabled) => callback(Boolean(enabled));
      ipcRenderer.on("behind-mode-changed", handler);
      return () => ipcRenderer.removeListener("behind-mode-changed", handler);
    },
    onWindowMinimized: (callback) => {
      if (typeof callback !== "function") return () => {};
      const handler = () => callback();
      ipcRenderer.on("crackpilot:window-minimized", handler);
      return () => ipcRenderer.removeListener("crackpilot:window-minimized", handler);
    },
    onWindowClosing: (callback) => {
      if (typeof callback !== "function") return () => {};
      const handler = () => callback();
      ipcRenderer.on("crackpilot:window-closing", handler);
      return () => ipcRenderer.removeListener("crackpilot:window-closing", handler);
    },
  });
  console.log("[Crackpilot Preload] window.crackpilotDesktop bridge exposed (v1.0.7).");
} catch (err) {
  console.error("[Crackpilot Preload] Failed to expose crackpilotDesktop bridge:", err);
}

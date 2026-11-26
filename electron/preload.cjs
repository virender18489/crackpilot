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
    version: "1.0.5",
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
    showWindow: () => invokeSafe("crackpilot:show"),
    toggleMaximize: () => invokeSafe("crackpilot:toggle-maximize"),
    setCompact: (compact) => invokeSafe("crackpilot:set-compact", compact),
    setOpacity: (opacity) => invokeSafe("crackpilot:set-opacity", opacity),
    setAlwaysOnTop: (enabled) =>
      invokeSafe("crackpilot:set-always-on-top", enabled),
    openExternal: (url) => invokeSafe("crackpilot:open-external", url),
  });
  console.log("[Crackpilot Preload] window.crackpilotDesktop bridge exposed (v1.0.5).");
} catch (err) {
  console.error("[Crackpilot Preload] Failed to expose crackpilotDesktop bridge:", err);
}

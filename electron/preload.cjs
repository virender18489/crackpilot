const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("crackpilotDesktop", {
  isElectron: true,
  hideWindow: () => ipcRenderer.invoke("crackpilot:hide"),
  showWindow: () => ipcRenderer.invoke("crackpilot:show"),
  toggleMaximize: () => ipcRenderer.invoke("crackpilot:toggle-maximize"),
  setCompact: (compact) => ipcRenderer.invoke("crackpilot:set-compact", compact),
  setOpacity: (opacity) => ipcRenderer.invoke("crackpilot:set-opacity", opacity),
  setAlwaysOnTop: (enabled) =>
    ipcRenderer.invoke("crackpilot:set-always-on-top", enabled),
  openExternal: (url) => ipcRenderer.invoke("crackpilot:open-external", url),
});

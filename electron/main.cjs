const {
  app,
  BrowserWindow,
  desktopCapturer,
  globalShortcut,
  ipcMain,
  session,
  shell,
} = require("electron");
const fs = require("fs");
const path = require("path");

const APP_VERSION = "1.0.5";
let mainWindow = null;

function logInfo(...args) {
  console.log("[Crackpilot Main]", ...args);
}

function logError(...args) {
  console.error("[Crackpilot Main]", ...args);
}

// Ensure clicking the Desktop icon again brings back the hidden Crackpilot window
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  logInfo("Secondary instance detected — forwarding focus to primary instance.");
  app.quit();
} else {
  app.on("second-instance", () => {
    logInfo("second-instance event received — restoring overlay window.");
    showOverlayWindow();
  });
}

function resolveIconPath() {
  const iconPath = path.join(__dirname, "../public/favicon.ico");
  if (!fs.existsSync(iconPath)) {
    logError("Window icon missing at:", iconPath);
  }
  return iconPath;
}

function enforceStealthWindowFlags(win) {
  if (!win || win.isDestroyed()) return;
  try {
    win.setMenuBarVisibility(false);
    win.setSkipTaskbar(true);
    // win.setContentProtection(true); // Commented out so window remains visible on Print Screen / screenshots (uncomment to re-enable)
    // win.setAlwaysOnTop(true, "screen-saver"); // Uncomment when re-enabling screen-capture protection
    win.setContentProtection(false);
  } catch (err) {
    logError("Failed to apply stealth window flags:", err);
  }
}

function showOverlayWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  try {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    enforceStealthWindowFlags(mainWindow);
    mainWindow.show();
    mainWindow.focus();
    enforceStealthWindowFlags(mainWindow);
    logInfo("Overlay window shown.");
  } catch (err) {
    logError("showOverlayWindow failed:", err);
  }
}

function hideOverlayWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  try {
    mainWindow.setSkipTaskbar(true);
    mainWindow.hide();
    logInfo("Overlay window hidden (Alt+H or Desktop icon restores it).");
    return true;
  } catch (err) {
    logError("hideOverlayWindow failed:", err);
    return false;
  }
}

function createWindow() {
  const preloadPath = path.join(__dirname, "preload.cjs");
  if (!fs.existsSync(preloadPath)) {
    logError("CRITICAL: preload script not found at:", preloadPath);
  } else {
    logInfo(`Creating BrowserWindow v${APP_VERSION} with preload:`, preloadPath);
  }

  const win = new BrowserWindow({
    width: 1080,
    height: 780,
    minWidth: 500,
    minHeight: 420,
    title: "Crackpilot",
    icon: resolveIconPath(),
    show: false, // Keep hidden until ready-to-show so Windows 11 never flashes a taskbar icon
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    // TESTING MODE: commented out alwaysOnTop so Print Screen / Snipping Tool captures the window cleanly
    // alwaysOnTop: true,
    alwaysOnTop: false,
    skipTaskbar: true,
    resizable: true,
    minimizable: true,
    maximizable: true,
    closable: true,
    hasShadow: false,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  mainWindow = win;
  enforceStealthWindowFlags(win);

  win.once("ready-to-show", () => {
    enforceStealthWindowFlags(win);
    win.show();
    win.focus();
    enforceStealthWindowFlags(win);
    logInfo("Window ready-to-show complete (skipTaskbar=true).");
  });

  // Windows 11 DWM can re-add a taskbar entry on show/focus/maximize/unmaximize — re-enforce skipTaskbar
  for (const evt of ["show", "focus", "restore", "maximize", "unmaximize"]) {
    win.on(evt, () => {
      if (!win.isDestroyed()) {
        win.setSkipTaskbar(true);
        win.setContentProtection(false);
        // TESTING MODE: Uncomment below when re-enabling stealth protection
        // if (evt === "show" || evt === "restore") {
        //   win.setAlwaysOnTop(true, "screen-saver");
        // }
      }
    });
  }

  // Intercept OS-level minimize (e.g. Win+D) so skipTaskbar:true never leaves a bottom-left stub
  win.on("minimize", (event) => {
    event.preventDefault();
    logInfo("OS minimize intercepted — hiding overlay cleanly.");
    hideOverlayWindow();
  });

  win.webContents.on("preload-error", (_event, preloadFile, error) => {
    logError("CRITICAL preload-error in", preloadFile, error);
  });

  win.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL) => {
      logError(
        `did-fail-load (${errorCode}): ${errorDescription} | URL: ${validatedURL}`
      );
    }
  );

  win.webContents.on("render-process-gone", (_event, details) => {
    logError("Renderer process gone:", details);
  });

  // Always open Crackpilot Software Authentication screen directly from Desktop icon
  const remoteAppUrl = process.env.CRACKPILOT_APP_URL;
  const distIndex = path.join(__dirname, "../dist/index.html");

  if (remoteAppUrl) {
    const targetUrl = remoteAppUrl.includes("?")
      ? `${remoteAppUrl}&mode=software`
      : `${remoteAppUrl}?mode=software`;
    logInfo("Loading remote CRACKPILOT_APP_URL:", targetUrl);
    win.loadURL(targetUrl).catch((err) => {
      logError("Remote loadURL failed, falling back to local dist:", err);
      win.loadFile(distIndex, { query: { mode: "software" } }).catch((loadErr) => {
        logError("Fallback loadFile failed:", loadErr);
      });
    });
  } else {
    logInfo("Loading local packaged UI:", distIndex);
    win.loadFile(distIndex, { query: { mode: "software" } }).catch((err) => {
      logError("loadFile failed:", err);
    });
  }

  win.on("closed", () => {
    logInfo("Main window closed.");
    mainWindow = null;
  });
}

function registerIpcHandlers() {
  // With skipTaskbar: true + frameless transparent window on Windows 11,
  // hide() cleanly minimizes/hides the window immediately without leaving a taskbar icon.
  // Press Alt+H or click the Desktop icon to restore it anytime.
  ipcMain.handle("crackpilot:minimize", () => {
    logInfo("IPC crackpilot:minimize invoked.");
    const hidden = hideOverlayWindow();
    return { ok: hidden, hidden };
  });

  ipcMain.on("crackpilot:minimize-sync", (event) => {
    logInfo("IPC crackpilot:minimize-sync invoked.");
    const hidden = hideOverlayWindow();
    event.returnValue = hidden;
  });

  ipcMain.handle("crackpilot:hide", () => {
    logInfo("IPC crackpilot:hide invoked.");
    const hidden = hideOverlayWindow();
    return { ok: hidden, hidden };
  });

  ipcMain.handle("crackpilot:show", () => {
    logInfo("IPC crackpilot:show invoked.");
    showOverlayWindow();
    return { ok: true };
  });

  ipcMain.handle("crackpilot:toggle-maximize", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return false;
    try {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
        mainWindow.setSkipTaskbar(true);
        logInfo("IPC crackpilot:toggle-maximize -> unmaximized.");
        return false;
      }
      mainWindow.maximize();
      mainWindow.setSkipTaskbar(true);
      logInfo("IPC crackpilot:toggle-maximize -> maximized.");
      return true;
    } catch (err) {
      logError("toggle-maximize failed:", err);
      return false;
    }
  });

  ipcMain.handle("crackpilot:set-compact", (_ev, compact) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    try {
      const [currentWidth] = mainWindow.getSize();
      if (compact) {
        mainWindow.setSize(Math.max(currentWidth, 560), 480, true);
      } else {
        mainWindow.setSize(Math.max(currentWidth, 1080), 780, true);
      }
    } catch (err) {
      logError("set-compact failed:", err);
    }
  });

  ipcMain.handle("crackpilot:set-opacity", (_ev, opacity) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    try {
      const clamped = Math.max(0.35, Math.min(1, Number(opacity) || 1));
      mainWindow.setOpacity(clamped);
    } catch (err) {
      logError("set-opacity failed:", err);
    }
  });

  ipcMain.handle("crackpilot:set-always-on-top", (_ev, enabled) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    try {
      // TESTING MODE: Uncomment screen-saver level when re-enabling stealth protection
      // mainWindow.setAlwaysOnTop(Boolean(enabled), "screen-saver");
      mainWindow.setAlwaysOnTop(Boolean(enabled));
    } catch (err) {
      logError("set-always-on-top failed:", err);
    }
  });

  ipcMain.handle("crackpilot:open-external", (_ev, url) => {
    if (typeof url === "string" && /^https?:\/\//i.test(url)) {
      return shell.openExternal(url);
    }
    logError("Blocked invalid external URL:", url);
  });
}

app.whenReady().then(() => {
  logInfo(`Electron app ready (v${APP_VERSION}, platform=${process.platform}).`);

  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      const allowed = [
        "media",
        "display-capture",
        "audioCapture",
        "clipboard-read",
        "clipboard-sanitized-write",
      ];
      callback(allowed.includes(permission));
    }
  );

  if (typeof session.defaultSession.setDisplayMediaRequestHandler === "function") {
    session.defaultSession.setDisplayMediaRequestHandler(
      async (_request, callback) => {
        try {
          const sources = await desktopCapturer.getSources({
            types: ["screen"],
          });
          if (sources.length > 0) {
            callback({ video: sources[0], audio: "loopback" });
            return;
          }
        } catch (err) {
          logError("desktopCapturer.getSources failed:", err);
        }
        callback({});
      }
    );
  }

  registerIpcHandlers();
  createWindow();

  // === TEMPORARILY COMMENTED OUT: Alt+H global shortcut (uncomment when requested) ===
  // const registered = globalShortcut.register("Alt+H", () => {
  //   if (!mainWindow || mainWindow.isDestroyed()) {
  //     createWindow();
  //     return;
  //   }
  //   if (mainWindow.isVisible() && !mainWindow.isMinimized()) {
  //     hideOverlayWindow();
  //   } else {
  //     showOverlayWindow();
  //   }
  // });
  // if (!registered) {
  //   logError("Could not register global shortcut Alt+H (may be in use by another app).");
  // }
  // ===================================================================================

  app.on("activate", () => {
    showOverlayWindow();
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

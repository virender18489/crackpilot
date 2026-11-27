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

const APP_VERSION = "1.0.7";
const PRODUCTION_OVERLAY_URL = "https://crackpilot.vercel.app/?mode=software";
let mainWindow = null;
let isBehindMode = false;

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
    // Keep overlay visible on top in both normal and Behind (click-through) states
    win.setAlwaysOnTop(true, "screen-saver");
    win.setContentProtection(false);
  } catch (err) {
    logError("Failed to apply stealth window flags:", err);
  }
}

function setBehindMode(enabled) {
  isBehindMode = Boolean(enabled);
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.setAlwaysOnTop(true, "screen-saver");
      if (isBehindMode) {
        mainWindow.setIgnoreMouseEvents(true, { forward: true });
        logInfo("Behind Mode ON (Alt+M): clicks and typing pass through to background window.");
      } else {
        mainWindow.setIgnoreMouseEvents(false);
        mainWindow.show();
        mainWindow.focus();
        logInfo("Behind Mode OFF (Alt+M): Crackpilot window interactive and focused.");
      }
      if (!mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send("behind-mode-changed", isBehindMode);
      }
    } catch (err) {
      logError("setBehindMode failed:", err);
    }
  }
  return isBehindMode;
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
    if (!mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send("crackpilot:window-minimized");
    }
    mainWindow.setSkipTaskbar(true);
    mainWindow.hide();
    logInfo("Overlay window hidden (timer paused).");
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
    alwaysOnTop: true,
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

  // Intercept OS-level minimize (e.g. Win+D) so skipTaskbar:true never leaves a bottom-left stub and timer pauses immediately
  win.on("minimize", (event) => {
    event.preventDefault();
    logInfo("OS minimize intercepted — pausing timer and hiding overlay cleanly.");
    hideOverlayWindow();
  });

  win.on("close", () => {
    if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
      win.webContents.send("crackpilot:window-closing");
    }
  });

  win.webContents.on("preload-error", (_event, preloadFile, error) => {
    logError("CRITICAL preload-error in", preloadFile, error);
  });

  const distIndex = path.join(__dirname, "../dist/index.html");
  let fellBackToLocal = false;

  const loadLocalFallback = (reason) => {
    if (fellBackToLocal || win.isDestroyed()) return;
    fellBackToLocal = true;
    logError("Falling back to local packaged UI:", reason);
    win.loadFile(distIndex, { query: { mode: "software" } }).catch((loadErr) => {
      logError("Fallback loadFile failed:", loadErr);
    });
  };

  win.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      // Ignore benign aborted navigations (-3)
      if (errorCode === -3) return;
      logError(
        `did-fail-load (${errorCode}): ${errorDescription} | URL: ${validatedURL}`
      );
      if (isMainFrame && /^https?:\/\//i.test(validatedURL || "")) {
        loadLocalFallback(`${errorDescription} (${errorCode})`);
      }
    }
  );

  win.webContents.on("render-process-gone", (_event, details) => {
    logError("Renderer process gone:", details);
  });

  // Always load the live hosted Vercel overlay URL in production so UI/API updates
  // appear automatically in the .exe without re-downloading, while keeping preload.cjs attached.
  const useLocalOnly = process.env.CRACKPILOT_USE_LOCAL === "1";
  const configuredUrl = (
    process.env.CRACKPILOT_APP_URL || PRODUCTION_OVERLAY_URL
  ).trim();

  if (!useLocalOnly && /^https?:\/\//i.test(configuredUrl)) {
    const targetUrl = configuredUrl.includes("mode=software")
      ? configuredUrl
      : configuredUrl.includes("?")
        ? `${configuredUrl}&mode=software`
        : `${configuredUrl}?mode=software`;
    logInfo("Loading live remote Crackpilot overlay:", targetUrl);
    session.defaultSession
      .clearCache()
      .catch(() => {})
      .finally(() => {
        if (win.isDestroyed()) return;
        win.loadURL(targetUrl).catch((err) => {
          loadLocalFallback(err?.message || String(err));
        });
      });
  } else {
    logInfo("Loading local packaged UI:", distIndex);
    win.loadFile(distIndex, { query: { mode: "software" } }).catch((err) => {
      logError("loadFile failed:", err);
    });
  }

  // Enforce fresh authentication gate on every .exe launch (never auto-login from saved storage)
  win.webContents.on("dom-ready", () => {
    if (win.isDestroyed() || win.webContents.isDestroyed()) return;
    win.webContents
      .executeJavaScript(
        `try {
          ["crackpilot_token_v1","crackpilot_session_token","crackpilot_auth_token","crackpilot_active_session"].forEach(function(k){
            try { localStorage.removeItem(k); } catch(e) {}
            try { sessionStorage.removeItem(k); } catch(e) {}
          });
        } catch(e) {}`
      )
      .catch(() => {});
  });

  win.on("closed", () => {
    logInfo("Main window closed.");
    mainWindow = null;
  });
}

function registerIpcHandlers() {
  // With skipTaskbar: true + frameless transparent window on Windows 11,
  // hide() cleanly minimizes/hides the window immediately without leaving a taskbar icon.
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

  ipcMain.handle("crackpilot:close", () => {
    logInfo("IPC crackpilot:close invoked — closing window after session disconnect.");
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
    }
    return { ok: true };
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
      mainWindow.setAlwaysOnTop(Boolean(enabled), "screen-saver");
    } catch (err) {
      logError("set-always-on-top failed:", err);
    }
  });

  ipcMain.handle("crackpilot:set-behind-mode", (_ev, enabled) => {
    return setBehindMode(Boolean(enabled));
  });

  ipcMain.handle("crackpilot:toggle-behind-mode", () => {
    return setBehindMode(!isBehindMode);
  });

  ipcMain.handle("crackpilot:get-behind-mode", () => {
    return isBehindMode;
  });

  // Smart hover detection on the Behind / Write button:
  // Temporarily allow mouse clicks ONLY while hovering directly over the Behind button so user can click to turn it OFF
  ipcMain.handle("crackpilot:set-behind-hover", (_ev, hovering) => {
    if (!mainWindow || mainWindow.isDestroyed()) return false;
    try {
      if (isBehindMode) {
        if (hovering) {
          mainWindow.setIgnoreMouseEvents(false);
        } else {
          mainWindow.setIgnoreMouseEvents(true, { forward: true });
        }
      } else {
        mainWindow.setIgnoreMouseEvents(false);
      }
      return true;
    } catch (err) {
      logError("set-behind-hover failed:", err);
      return false;
    }
  });

  ipcMain.handle("crackpilot:open-external", (_ev, url) => {
    if (typeof url === "string" && /^https?:\/\//i.test(url)) {
      return shell.openExternal(url);
    }
    logError("Blocked invalid external URL:", url);
  });

  // Reliable background Screen Capture (Alt+S):
  // Briefly hides overlay via opacity 0 for ~120ms so Notepad / VS Code / Browser behind CrackPilot is captured cleanly.
  ipcMain.handle("capture-screen", async () => {
    const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
    let prevOpacity = 1;
    let hidOverlay = false;

    try {
      if (win) {
        try {
          prevOpacity = typeof win.getOpacity === "function" ? win.getOpacity() : 1;
          win.setOpacity(0);
          hidOverlay = true;
          // Wait ~120ms so OS compositor repaints the background window cleanly
          await new Promise((resolve) => setTimeout(resolve, 120));
        } catch (opErr) {
          logError("capture-screen setOpacity(0) warning:", opErr);
        }
      }

      const sources = await desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: { width: 1280, height: 720 },
      });

      const primaryScreen =
        sources.find((s) => s.id.startsWith("screen:")) || sources[0];

      if (!primaryScreen || !primaryScreen.thumbnail || primaryScreen.thumbnail.isEmpty()) {
        return {
          ok: false,
          error: "Screen capture returned an empty frame. Check OS screen capture permissions.",
        };
      }

      let jpegBuffer = primaryScreen.thumbnail.toJPEG(75);
      // Guarantee lightweight payload under 250KB for sub-second Vision upload
      if (jpegBuffer.length > 250 * 1024) {
        jpegBuffer = primaryScreen.thumbnail.toJPEG(60);
      }
      if (jpegBuffer.length > 250 * 1024) {
        const resized = primaryScreen.thumbnail.resize({ width: 1024 });
        jpegBuffer = resized.toJPEG(60);
      }

      const base64 = jpegBuffer.toString("base64");
      if (!base64 || base64.length < 64) {
        return {
          ok: false,
          error: "Captured JPEG frame was empty.",
        };
      }

      logInfo(
        `IPC capture-screen succeeded (${Math.round(jpegBuffer.length / 1024)}KB JPEG).`
      );
      return {
        ok: true,
        base64,
        mimeType: "image/jpeg",
        dataUrl: `data:image/jpeg;base64,${base64}`,
        byteLength: jpegBuffer.length,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logError("IPC capture-screen failed:", message);
      return {
        ok: false,
        error: `Screen capture failed: ${message}`,
      };
    } finally {
      if (hidOverlay && win && !win.isDestroyed()) {
        try {
          win.setOpacity(prevOpacity > 0.05 ? prevOpacity : 1);
        } catch (restoreErr) {
          logError("capture-screen restore opacity warning:", restoreErr);
        }
      }
    }
  });

  ipcMain.handle("crackpilot:reload-live", async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return { ok: false };
    try {
      await session.defaultSession.clearCache().catch(() => {});
      const configuredUrl = (
        process.env.CRACKPILOT_APP_URL || PRODUCTION_OVERLAY_URL
      ).trim();
      const targetUrl = configuredUrl.includes("mode=software")
        ? configuredUrl
        : configuredUrl.includes("?")
          ? `${configuredUrl}&mode=software`
          : `${configuredUrl}?mode=software`;
      logInfo("IPC crackpilot:reload-live -> reloading fresh Vercel overlay:", targetUrl);
      await mainWindow.loadURL(targetUrl);
      return { ok: true };
    } catch (err) {
      logError("reload-live failed, reloading current contents:", err);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.reloadIgnoringCache();
      }
      return { ok: false };
    }
  });
}

app.whenReady().then(() => {
  logInfo(`Electron app ready (v${APP_VERSION}, platform=${process.platform}).`);

  const allowedPermissions = new Set([
    "media",
    "microphone",
    "camera",
    "display-capture",
    "audioCapture",
    "speaker-selection",
    "mediaKeySystem",
    "clipboard-read",
    "clipboard-sanitized-write",
  ]);

  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      const granted = allowedPermissions.has(permission);
      if (granted) {
        logInfo("Auto-approved permission request:", permission);
      }
      callback(granted);
    }
  );

  if (typeof session.defaultSession.setPermissionCheckHandler === "function") {
    session.defaultSession.setPermissionCheckHandler(
      (_webContents, permission) => {
        return allowedPermissions.has(permission);
      }
    );
  }

  if (typeof session.defaultSession.setDisplayMediaRequestHandler === "function") {
    session.defaultSession.setDisplayMediaRequestHandler(
      async (_request, callback) => {
        try {
          const sources = await desktopCapturer.getSources({
            types: ["screen", "window"],
          });
          const primaryScreen =
            sources.find((s) => s.id.startsWith("screen:")) || sources[0];
          if (primaryScreen) {
            logInfo(
              "Auto-granted display media with system audio loopback:",
              primaryScreen.name || primaryScreen.id
            );
            callback({ video: primaryScreen, audio: "loopback" });
            return;
          }
        } catch (err) {
          logError("desktopCapturer.getSources failed:", err);
        }
        callback({});
      },
      { useSystemPicker: false }
    );
  }

  registerIpcHandlers();
  createWindow();

  // Global Alt+M shortcut to toggle Behind (click-through) mode even when focus is on a background app
  const registeredBehind = globalShortcut.register("Alt+M", () => {
    setBehindMode(!isBehindMode);
  });
  if (!registeredBehind) {
    logError("Could not register global shortcut Alt+M (may be in use by another app).");
  } else {
    logInfo("Registered global shortcut Alt+M for Behind (click-through) mode.");
  }

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

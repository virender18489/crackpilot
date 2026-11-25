const {
  app,
  BrowserWindow,
  desktopCapturer,
  globalShortcut,
  ipcMain,
  session,
  shell,
} = require("electron");
const path = require("path");

let mainWindow = null;

// Ensure clicking the Desktop icon again brings back the hidden/minimized Crackpilot window
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    showOverlayWindow();
  });
}

function resolveIconPath() {
  return path.join(__dirname, "../public/favicon.ico");
}

function showOverlayWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.setSkipTaskbar(true);
  mainWindow.show();
  mainWindow.focus();
  mainWindow.setAlwaysOnTop(true, "screen-saver");
}

function hideOverlayWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.setSkipTaskbar(true);
  mainWindow.hide();
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1080,
    height: 780,
    minWidth: 500,
    minHeight: 420,
    title: "Crackpilot",
    icon: resolveIconPath(),
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    minimizable: true,
    maximizable: true,
    closable: true,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });

  mainWindow = win;
  win.setMenuBarVisibility(false);
  win.setSkipTaskbar(true);
  win.setAlwaysOnTop(true, "screen-saver");
  win.setContentProtection(true);

  win.on("show", () => {
    if (!win.isDestroyed()) {
      win.setSkipTaskbar(true);
      win.setAlwaysOnTop(true, "screen-saver");
    }
  });

  // Always open Crackpilot Software Authentication & Live Overlay directly from Desktop icon
  const remoteAppUrl = process.env.CRACKPILOT_APP_URL;
  if (remoteAppUrl) {
    const targetUrl = remoteAppUrl.includes("?")
      ? `${remoteAppUrl}&mode=software`
      : `${remoteAppUrl}?mode=software`;
    win.loadURL(targetUrl).catch(() => {
      win.loadFile(path.join(__dirname, "../dist/index.html"), {
        query: { mode: "software" },
      });
    });
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"), {
      query: { mode: "software" },
    });
  }

  win.on("closed", () => {
    mainWindow = null;
  });
}

function registerIpcHandlers() {
  // With skipTaskbar: true + frameless transparent window on Windows 11,
  // hide() cleanly minimizes/hides the window immediately without leaving a taskbar icon.
  // Press Alt+H or double-click the Desktop icon to restore it anytime.
  ipcMain.handle("crackpilot:minimize", () => {
    hideOverlayWindow();
  });

  ipcMain.handle("crackpilot:hide", () => {
    hideOverlayWindow();
  });

  ipcMain.handle("crackpilot:show", () => {
    showOverlayWindow();
  });

  ipcMain.handle("crackpilot:toggle-maximize", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return false;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
      return false;
    }
    mainWindow.maximize();
    return true;
  });

  ipcMain.handle("crackpilot:set-compact", (_ev, compact) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const [currentWidth] = mainWindow.getSize();
    if (compact) {
      mainWindow.setSize(Math.max(currentWidth, 560), 480, true);
    } else {
      mainWindow.setSize(Math.max(currentWidth, 1080), 780, true);
    }
  });

  ipcMain.handle("crackpilot:set-opacity", (_ev, opacity) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const clamped = Math.max(0.35, Math.min(1, Number(opacity) || 1));
    mainWindow.setOpacity(clamped);
  });

  ipcMain.handle("crackpilot:set-always-on-top", (_ev, enabled) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.setAlwaysOnTop(Boolean(enabled), "screen-saver");
  });

  ipcMain.handle("crackpilot:open-external", (_ev, url) => {
    if (typeof url === "string" && /^https?:\/\//i.test(url)) {
      shell.openExternal(url);
    }
  });
}

app.whenReady().then(() => {
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
        } catch {
          // Fall back to empty grant
        }
        callback({});
      }
    );
  }

  registerIpcHandlers();
  createWindow();

  // Global OS shortcut Alt+H to instantly hide or restore Crackpilot from any app
  globalShortcut.register("Alt+H", () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow();
      return;
    }
    if (mainWindow.isVisible() && !mainWindow.isMinimized()) {
      hideOverlayWindow();
    } else {
      showOverlayWindow();
    }
  });

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

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

function resolveIconPath() {
  return path.join(__dirname, "../public/favicon.ico");
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
  win.setAlwaysOnTop(true, "screen-saver");
  win.setContentProtection(true);

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
    // Open Crackpilot Live Software Overlay directly when user clicks the Desktop icon
    win.loadFile(path.join(__dirname, "../dist/index.html"), {
      query: { mode: "software" },
    });
  }

  win.on("closed", () => {
    mainWindow = null;
  });
}

function registerIpcHandlers() {
  ipcMain.handle("crackpilot:minimize", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.minimize();
    }
  });

  ipcMain.handle("crackpilot:hide", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide();
    }
  });

  ipcMain.handle("crackpilot:show", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    }
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
  // Allow mic, screen capture, and system audio permissions seamlessly
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

  // Enable native getDisplayMedia screen + Windows loopback system audio capture
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
          // Fall back to empty grant on error
        }
        callback({});
      }
    );
  }

  registerIpcHandlers();
  createWindow();

  // Global OS shortcut Alt+H to instantly hide or restore the Crackpilot HUD
  globalShortcut.register("Alt+H", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isVisible() && !mainWindow.isMinimized()) {
      mainWindow.hide();
    } else {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
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

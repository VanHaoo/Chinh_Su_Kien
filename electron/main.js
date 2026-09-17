const { app, BrowserWindow, screen, dialog, ipcMain, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const {
  startDisplayLock,
  stopDisplayLock,
  setLockState,
  getLockState,
} = require("./outputDisplayLock.cjs");

const logPath = path.join(app.getPath("userData"), "app.log");
function log(msg) {
  try {
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (e) {}
}

log("App starting...");

// Hide Electron default application menu completely
Menu.setApplicationMenu(null);

// V8 Memory optimizations: Limit heap to 256MB, disable cache bloat
app.commandLine.appendSwitch("js-flags", "--max-old-space-size=256");
app.commandLine.appendSwitch("disable-http-cache");
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

let controlWindow = null;
let outputWindow = null;

async function startBackendServer() {
  log("Starting backend server...");
  const serverPath = path.join(__dirname, "..", "server", "server.js");
  const { pathToFileURL } = require("url");
  await import(pathToFileURL(serverPath).href);
  log("Backend server imported successfully.");
}

function openOrFocusOutputWindow() {
  try {
    log("openOrFocusOutputWindow triggered.");
    const displays = screen.getAllDisplays();
    if (displays.length < 2) {
      log("Only 1 display detected.");
      stopDisplayLock();
      if (controlWindow && !controlWindow.isDestroyed()) {
        dialog.showMessageBox(controlWindow, {
          type: "info",
          title: "Thông báo màn chiếu",
          message: "Cần kết nối màn hình thứ 2 để dùng chế độ trình chiếu hai màn hình.",
        });
      }
      return;
    }

    // Determine which display currently contains the Control window
    let controlDisplay = screen.getPrimaryDisplay();
    if (controlWindow && !controlWindow.isDestroyed()) {
      const controlBounds = controlWindow.getBounds();
      controlDisplay = screen.getDisplayMatching(controlBounds) || controlDisplay;
    }

    // Choose another display as Output display
    const outputDisplay = displays.find((d) => d.id !== controlDisplay.id) || displays[1];
    // Use bounds (not workArea) to get full screen including taskbar area
    const { x, y, width, height } = outputDisplay.bounds;
    const sf = outputDisplay.scaleFactor || 1;
    log(`Selected Output Display ID: ${outputDisplay.id}, bounds: [x=${x}, y=${y}, w=${width}, h=${height}], scaleFactor=${sf}`);

    // Pass physical pixel bounds to lockService
    startDisplayLock(outputDisplay.bounds, controlDisplay.bounds, process.pid);

    function applyOutputBounds(win) {
      // Force exact pixel bounds then kiosk
      win.setKiosk(false);
      win.setBounds({ x, y, width, height }, false);
      win.setFullScreen(true);
      win.setAlwaysOnTop(true, "screen-saver", 1);
      setTimeout(() => {
        if (win && !win.isDestroyed()) {
          win.setBounds({ x, y, width, height }, false);
          win.setKiosk(true);
          win.setAlwaysOnTop(true, "screen-saver", 1);
          log(`Output bounds enforced: x=${x} y=${y} w=${width} h=${height}`);
        }
      }, 300);
    }

    if (outputWindow && !outputWindow.isDestroyed()) {
      log("Output window exists, re-applying bounds...");
      applyOutputBounds(outputWindow);
      outputWindow.showInactive();
      if (controlWindow && !controlWindow.isDestroyed()) controlWindow.focus();
      return;
    }

    log("Creating fresh Output window on 2nd monitor...");
    outputWindow = new BrowserWindow({
      x,
      y,
      width,
      height,
      show: false,
      frame: false,
      fullscreen: false,   // start false, apply after ready
      fullscreenable: true,
      kiosk: false,        // start false, apply after ready
      autoHideMenuBar: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      title: "LED Controller - Presentation Output",
      backgroundColor: "#000000",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        backgroundThrottling: false,
        autoplayPolicy: "no-user-gesture-required",
      },
    });

    outputWindow.loadURL("http://127.0.0.1:4000/output");

    outputWindow.once("ready-to-show", () => {
      if (outputWindow && !outputWindow.isDestroyed()) {
        applyOutputBounds(outputWindow);
        outputWindow.showInactive();
        if (controlWindow && !controlWindow.isDestroyed()) controlWindow.focus();
      }
    });

    outputWindow.on("closed", () => {
      outputWindow = null;
      stopDisplayLock();
      log("Output window closed.");
      if (controlWindow && !controlWindow.isDestroyed()) controlWindow.focus();
    });
  } catch (err) {
    log("Error in openOrFocusOutputWindow: " + (err.stack || err.message));
  }
}

function createControlWindow() {
  try {
    log("Creating Control window...");
    controlWindow = new BrowserWindow({
      width: 1366,
      height: 850,
      show: true,
      autoHideMenuBar: true,
      title: "LED Controller - Control Dashboard",
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        nodeIntegration: false,
        contextIsolation: true,
        backgroundThrottling: false,
      },
    });

    controlWindow.setMenuBarVisibility(false);
    controlWindow.loadURL("http://127.0.0.1:4000/control");

    controlWindow.on("closed", () => {
      controlWindow = null;
      stopDisplayLock();
      if (outputWindow && !outputWindow.isDestroyed()) {
        outputWindow.close();
      }
      app.quit();
    });
    log("Control window created successfully.");
  } catch (err) {
    log("Control Window Creation Error: " + (err.stack || err.message));
    dialog.showErrorBox("Control Window Creation Error", err.stack || err.message);
  }
}

// Display connect / disconnect event handlers
function handleDisplayChange() {
  log("Display configuration changed.");
  const displays = screen.getAllDisplays();
  if (displays.length < 2) {
    stopDisplayLock();
    if (outputWindow && !outputWindow.isDestroyed()) {
      outputWindow.close();
    }
  } else {
    // Auto open / re-align when display configuration changes
    openOrFocusOutputWindow();
  }
}

ipcMain.on("open-output-window", () => {
  log("IPC event 'open-output-window' received.");
  openOrFocusOutputWindow();
});

ipcMain.handle("toggle-output-lock", () => {
  const next = !getLockState();
  log("Toggle output lock: " + next);
  if (outputWindow && !outputWindow.isDestroyed()) {
    const displays = screen.getAllDisplays();
    if (displays.length >= 2) {
      let controlDisplay = screen.getPrimaryDisplay();
      if (controlWindow && !controlWindow.isDestroyed()) {
        controlDisplay = screen.getDisplayMatching(controlWindow.getBounds()) || controlDisplay;
      }
      const outputDisplay = displays.find((d) => d.id !== controlDisplay.id) || displays[1];
      setLockState(next, outputDisplay.bounds, controlDisplay.bounds, process.pid);
    } else {
      setLockState(next, null, null, process.pid);
    }
  } else {
    setLockState(next, null, null, process.pid);
  }
  return next;
});

ipcMain.handle("get-output-lock", () => {
  return getLockState();
});

app.whenReady().then(async () => {
  log("app.whenReady resolved.");
  try {
    createControlWindow();
    await startBackendServer();

    // Tự động mở màn chiếu ngay khi mở app nếu có 2 màn hình
    const displays = screen.getAllDisplays();
    if (displays.length >= 2) {
      log("2+ displays detected at startup. Auto-opening Output window...");
      setTimeout(() => {
        openOrFocusOutputWindow();
      }, 1000);
    }

    screen.on("display-added", () => {
      log("Display added event. Auto-opening Output window...");
      setTimeout(() => {
        openOrFocusOutputWindow();
      }, 1000);
    });
    screen.on("display-removed", handleDisplayChange);
    screen.on("display-metrics-changed", handleDisplayChange);
  } catch (err) {
    log("Startup Error: " + (err.stack || err.message));
    dialog.showErrorBox("Startup Error", err.stack || err.message);
  }
});

app.on("window-all-closed", () => {
  log("window-all-closed event fired.");
  stopDisplayLock();
  if (process.platform !== "darwin") app.quit();
});


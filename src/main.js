// main.js
import {
  app, BrowserWindow, Tray, Menu, nativeImage, Notification,
  ipcMain, session, powerMonitor, screen, globalShortcut, shell
} from "electron";
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";
import ElectronStore from "electron-store";
import { fileURLToPath } from "url";

import {
    createWindow,
    toggleWindow,
    clampContentHeight,
    openHelpWindow,
    openGameWindow
} from "./main/windowManager.js";
import {
    resolveElementByName,
    getToday,
    getForDate,
    listElements,
    buildUntisUrl,
    fetchAndSchedule,
    invalidateCache,
    WebUntisElementType
} from "./main/untis.js";

const Store = ElectronStore.default;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// notify toggle
const store = new Store();
let notificationsEnabled = store.get("notificationsEnabled", true);

ipcMain.on("set-notifications-enabled", (event, enabled) => {
  notificationsEnabled = !!enabled;
  store.set("notificationsEnabled", notificationsEnabled);
});

let tray = null;
let destroyTimer = null;

app.commandLine.appendSwitch('disable-features', 'Geolocation');
app.disableHardwareAcceleration();

/* -------------------- single instance -------------------- */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
app.on("second-instance", () => {
  toggleWindow();
});

/* -------------------- .env loader -------------------- */
function loadEnv() {
  const candidates = [
    path.join(process.resourcesPath, ".env"),
    path.join(app.getAppPath(), ".env"),
    path.join(process.cwd(), ".env")
  ];
  for (const p of candidates) { if (fs.existsSync(p)) { dotenv.config({ path: p }); break; } }
}
loadEnv();

/* -------------------- icon / resource helpers -------------------- */
function getIconPath() {
  const filename = "assets/icon.ico";
  return app.isPackaged ? path.join(process.resourcesPath, filename) : path.join(app.getAppPath(), filename);
}

/* -------------------- notifications -------------------- */
let notifTimers = [];
function clearTimers() { for (const t of notifTimers) clearTimeout(t); notifTimers = []; }
function scheduleAt(ts, fn) { const ms = ts - Date.now(); if (ms > 500) notifTimers.push(setTimeout(fn, ms)); }
function todayAt(h, m) { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate(), h, m, 0, 0).getTime(); }
function scheduleToasts(lessons) {
  clearTimers();
  if (!notificationsEnabled) return;

  const now = Date.now();
  
  const upcoming = (lessons||[]).filter(l => new Date(l.start).getTime()>now)
  .sort((a,b)=>+new Date(a.start)-+new Date(b.start))[0];
  if (upcoming) {
    const start = new Date(upcoming.start).getTime();
    scheduleAt(start - 5*60*1000, () => new Notification({
      title: "Næsti tími byrjar skjótt 🏃🏻 ",
      body: `${upcoming.subject || "Tími"} kl. ${new Date(start).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"})}${upcoming.room ? " • " + upcoming.room : ""}`,
      silent: false
   }).show());
  }
  if (Array.isArray(lessons) && lessons.length > 0) {
    const lastEndMs = Math.max(...lessons.map(l => new Date(l.end).getTime()));
    const coffee = todayAt(9, 20), lunch = todayAt(12, 15);
    if (coffee > now && lastEndMs >= coffee) scheduleAt(coffee, () => new Notification({ title: "Kaffimik ☕︎", body: "20 min.", silent: false }).show());
    if (lunch > now && lastEndMs >= lunch) scheduleAt(lunch, () => new Notification({ title: "Døgurði 🍽", body: "30 min.", silent: false }).show());
  }
}



/* -------------------- window management -------------------- */
function createTray() {
  const trayImage = nativeImage.createFromPath(getIconPath());
  tray = new Tray(trayImage);
  tray.setToolTip("Tímatalva");
  const menu = Menu.buildFromTemplate([
    { type: "separator" },
    { label: "Byrja við innritan", type: "checkbox",
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }) },
    { type: "separator" },
    { label: "Gevst", click: () => { app.isQuiting = true; app.quit(); } }
  ]);
  tray.setContextMenu(menu);
  tray.on("click", () => toggleWindow());
}

/* -------------------- security -------------------- */
function hardenWebContents() {
  // CSP
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": ["default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;"]
      }
    });
  });

  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  app.on("web-contents-created", (_e, contents) => {
    contents.setWindowOpenHandler(() => ({ action: "deny" }));
    contents.on("will-navigate", (e, url) => { if (!url.startsWith("file://")) e.preventDefault(); });
  });
}

/* -------------------- global shortcut -------------------- */
function registerGlobalShortcut() {
  const accel = "Control+Alt+T";
  const ok = globalShortcut.register(accel, () => { toggleWindow(); });
  if (!ok) console.warn("Global shortcut registration failed:", accel);
}

/* -------------------- IPC -------------------- */
function setupIpc() {
  ipcMain.handle("untis:resolve", async (_e, name) => await resolveElementByName(name));
  ipcMain.handle("untis:getToday", async (_e, id, type) => await getToday(id, type));
  ipcMain.handle("untis:getForDate", async (_e, id, type, dateStr) => await getForDate(id, type, dateStr));
  ipcMain.handle("untis:listElements", async () => await listElements());
  ipcMain.on("schedule-toasts", (_e, lessons) => scheduleToasts(lessons || []));
  ipcMain.on("app:openHelp", () => openHelpWindow());
  ipcMain.on("app:openGame", () => openGameWindow());
  ipcMain.on("get-win-id", (e) => { e.returnValue = e.sender.id; });
  ipcMain.on("resize-window", (_e, payload) => {
    const win = BrowserWindow.fromId(payload.id);
    if (!win) return;

    const newW = Number(payload.width) || 0;
    const newH = clampContentHeight(Number(payload.height) || 0);

    const [currentW, currentH] = win.getContentSize();
    const bounds = win.getBounds();
    const display = screen.getDisplayMatching(bounds).workArea;

    // Only resize/move if there's a meaningful change
    if (Math.abs(newW - currentW) < 2 && Math.abs(newH - currentH) < 2) {
      return;
    }

    const newX = display.x + display.width - newW;

    // Set bounds and content size
    // Note: setContentSize might not be needed if setBounds works reliably for this.
    // Using setBounds is generally better for positioning and sizing simultaneously.
    win.setBounds({
      x: newX,
      y: bounds.y, // Keep original y
      width: newW,
      height: newH,
    }, true); // Animate
  });
  ipcMain.on("open-untis-week", (_e, payload) => {
    const elementId = Number(payload?.id);
    const elementType = Number(payload?.type) || WebUntisElementType.CLASS;
    const dateStr = payload?.date || undefined;
    const url = buildUntisUrl(elementId || 0, elementType, dateStr);
    if (url.startsWith("https://")) {
      shell.openExternal(url).catch(() => {
        const base = `${getBaseUrl()}/?school=${encodeURIComponent(getSchool())}`;
        if (base.startsWith("https://")) shell.openExternal(base).catch(() => {});
      });
    }
  });
}

/* -------------------- Frog Rain Window -------------------- */
let frogWin = null;
let frogWinCloseTimer = null;

function closeFrogWin() {
    if (frogWin && !frogWin.isDestroyed()) {
      frogWin.close();
    }
}

ipcMain.on('show-frog-rain', () => {
  // If window exists, just add more frogs and reset timer
  if (frogWin && !frogWin.isDestroyed()) {
    frogWin.webContents.send('add-more-frogs');
    if (frogWinCloseTimer) clearTimeout(frogWinCloseTimer);
    frogWinCloseTimer = setTimeout(closeFrogWin, 10000);
    return;
  }

  // If window doesn't exist, create it
  const mainWin = BrowserWindow.getAllWindows()[0];
  if (mainWin) {
    mainWin.setAlwaysOnTop(false);
  }
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  frogWin = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
    }
  });

  frogWin.setIgnoreMouseEvents(true);
  frogWin.loadFile(path.join(__dirname, "..", "assets", "frogs.html"));

  // Ensure the main window closing also closes the frog window
  const frogMainWin = BrowserWindow.getAllWindows()[0];
  if (frogMainWin) {
    const parentCloseHandler = () => {
      if (frogWin && !frogWin.isDestroyed()) {
        frogWin.close();
      }
    };
    frogMainWin.once('closed', parentCloseHandler);
    // Clean up this listener if the frog window closes first
    frogWin.once('closed', () => {
      frogMainWin.removeListener('closed', parentCloseHandler);
    });
  }

  frogWin.on('closed', () => {
    const closedFrogMainWin = BrowserWindow.getAllWindows()[0];
    if (closedFrogMainWin && !closedFrogMainWin.isDestroyed()) {
      closedFrogMainWin.setAlwaysOnTop(true);
    }
    frogWin = null;
    if (frogWinCloseTimer) clearTimeout(frogWinCloseTimer);
    frogWinCloseTimer = null;
  });

  if (frogWinCloseTimer) clearTimeout(frogWinCloseTimer);
  frogWinCloseTimer = setTimeout(closeFrogWin, 10000); // Close after 10 seconds
});

/* -------------------- lifecycle -------------------- */
app.whenReady().then(() => {
  if (process.platform === "win32") app.setAppUserModelId("timatalva");
  hardenWebContents();
  powerMonitor.on("resume", () => { 
    const mainWin = BrowserWindow.getAllWindows()[0];
    if (mainWin) mainWin.webContents.send("trigger-refresh"); 
  });
  createTray();
  setupIpc();
  registerGlobalShortcut();
  toggleWindow(); // This will create and show the window for the first time.
  scheduleNextFetch(); // Start the long-term fetch scheduler
});
app.on("will-quit", () => { globalShortcut.unregisterAll(); });
app.on("before-quit", () => { app.isQuiting = true; if (destroyTimer) clearTimeout(destroyTimer); });
app.on("window-all-closed", () => {});

/* -------------------- Background Fetch Scheduler -------------------- */
function scheduleNextFetch() {
  const baseMinutes = 180; // 3 hours
  const minJitter = 40;
  const maxJitter = 70;
  const jitterMinutes = minJitter + Math.floor(Math.random() * (maxJitter - minJitter + 1));
  const intervalMs = (baseMinutes + jitterMinutes) * 60 * 1000;

  setTimeout(async () => {
    try {
      // Invalidate the cache first to ensure fresh data is fetched.
      invalidateCache();
      // Then, fetchAndSchedule handles fetching and notifying the renderer.
      await fetchAndSchedule();
    } catch (err) {
      console.error("Failed to fetch lessons during scheduled background update:", err);
    }
    scheduleNextFetch(); // Reschedule for the next run
  }, intervalMs);
}
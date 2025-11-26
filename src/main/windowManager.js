// src/main/windowManager.js
import { app, BrowserWindow, screen, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "url";
import fs from "fs";

const WIN_WIDTH = 310;
const MIN_HEIGHT = 140;

let win = null;
let helpWin = null;
let gameWin = null;
let destroyTimer = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getIconPath() {
    const filename = "assets/icon.ico";
    return app.isPackaged ? path.join(process.resourcesPath, filename) : path.join(app.getAppPath(), filename);
}

function getBundledPath(rel) {
  const candidates = [path.join(process.resourcesPath, "assets", rel), path.join(app.getAppPath(), "assets", rel)];
  for (const p of candidates) if (fs.existsSync(p)) return p;
  return candidates[0];
}

function clampContentHeight(h) {
    const { workArea } = screen.getPrimaryDisplay();
    const maxH = Math.max(MIN_HEIGHT, workArea.height - 20);
    return Math.max(MIN_HEIGHT, Math.min(Math.round(h), maxH));
}

function placeTopRight(targetWin) {
    if (!targetWin) return;
    const { workArea } = screen.getPrimaryDisplay();
    const { width, height } = targetWin.getBounds();
    
    targetWin.setBounds({ 
        x: Math.round(workArea.x + workArea.width - width), 
        y: Math.round(workArea.y), 
        width: width, 
        height: height 
    });
}

function createWindow() {
    const preloadPath = path.join(__dirname, "..", "preload.cjs");
    win = new BrowserWindow({
        width: WIN_WIDTH, height: 442, useContentSize: false, // Set to false because setBounds considers total size
        show: false, // Start hidden
        alwaysOnTop: true, frame: false, transparent: true, resizable: false, skipTaskbar: true,
        icon: getIconPath(),
        webPreferences: {
            preload: preloadPath, contextIsolation: true, sandbox: true, nodeIntegration: false,
            webSecurity: true, spellcheck: false, backgroundThrottling: true, disableBlinkFeatures: "Geolocation",
        }
    });
    win.loadFile(path.join(__dirname, "..", "..", "assets", "renderer.html"));
    win.setMenuBarVisibility(false);
    
    win.on("show", () => { 
        placeTopRight(win);
        if (destroyTimer) { clearTimeout(destroyTimer); destroyTimer = null; } 
    });

    win.on("hide", () => {
        if (destroyTimer) clearTimeout(destroyTimer);
        destroyTimer = setTimeout(() => { if (win) { win.destroy(); win = null; } }, 5 * 60 * 1000);
    });

    win.on("closed", () => { win = null; });
    if (app.isPackaged) win.webContents.on("devtools-opened", () => win.webContents.closeDevTools());
    
    let blurTimeout = null;
    win.on("blur", () => {
        if (win && !win.isDestroyed() && win.isVisible()) {
            const childWindows = win.getChildWindows();
            if (childWindows.some(child => child.isFocused())) return;
            if (helpWin && !helpWin.isDestroyed() && helpWin.isFocused()) return;
            
            if (blurTimeout) clearTimeout(blurTimeout);
            blurTimeout = setTimeout(() => {
                if (win && !win.isDestroyed() && win.isVisible()) win.hide();
            }, 300);
        }
    });

    win.on("focus", () => {
        if (blurTimeout) clearTimeout(blurTimeout);
    });

    win.on("close", (e) => { if (!app.isQuiting) { e.preventDefault(); win.hide(); } });
    win.on("closed", () => { win = null; });
    return win;
}

function openHelpWindow() {
  if (helpWin && !helpWin.isDestroyed()) { helpWin.focus(); return; }
  helpWin = new BrowserWindow({
    width: 761, height: 961, resizable: true, minimizable: false, maximizable: false,
    modal: false, parent: null, title: "Hjálp", icon: getIconPath(),
    webPreferences: { contextIsolation: true, sandbox: true, preload: path.join(__dirname, "help-preload.cjs") }
  });
  const helpPath = getBundledPath("help.html");
  helpWin.loadURL(`file://${helpPath.replace(/\\/g,"/")}`);
  helpWin.setMenuBarVisibility(false);
  helpWin.on("closed", () => { helpWin = null; });
}

function openGameWindow() {
  if (gameWin && !gameWin.isDestroyed()) { gameWin.focus(); return; }
  gameWin = new BrowserWindow({
    fullscreen: true,
    resizable: false,
    title: "Sigl",
    icon: getIconPath(),
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      preload: path.join(app.getAppPath(), "assets", "sigl", "sigl-preload.cjs")
    }
  });
  const gamePath = getBundledPath("sigl/sigl.html");
  gameWin.loadURL(`file://${gamePath.replace(/\\/g, "/")}`);
  gameWin.setMenuBarVisibility(false);
  gameWin.on("closed", () => { gameWin = null; });
}

function toggleWindow() {
    if (!win || win.isDestroyed()) win = createWindow();
    if (win.isVisible()) {
        win.hide();
    }
    else {
        win.show(); // will be placed by 'show' event
        win.focus();
    }
}

export {
    win,
    createWindow,
    toggleWindow,
    placeTopRight,
    clampContentHeight,
    openHelpWindow,
    openGameWindow
};

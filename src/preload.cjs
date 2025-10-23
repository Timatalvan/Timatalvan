// preload.cjs
const { contextBridge, ipcRenderer } = require("electron");

// Hard-disable geolocation
try {
  Object.defineProperty(navigator, "geolocation", { value: undefined, configurable: false });
} catch {}

contextBridge.exposeInMainWorld("untis", {
  winId: ipcRenderer.sendSync("get-win-id"),
  defaultName: "M5",

  // RPC-style calls
  resolveElementByName: (name) => ipcRenderer.invoke("untis:resolve", name),
  getToday: (id, type) => ipcRenderer.invoke("untis:getToday", id, type),
  getForDate: (id, type, dateStr) => ipcRenderer.invoke("untis:getForDate", id, type, dateStr),
  listElements: () => ipcRenderer.invoke("untis:listElements"),

  // Timers/toasts
  scheduleToasts: (lessons) => ipcRenderer.send("schedule-toasts", lessons),

  // Events from main
  onTriggerRefresh: (cb) => {
    if (typeof cb !== "function") return () => {};
    const handler = () => cb();
    ipcRenderer.on("trigger-refresh", handler);
    return () => ipcRenderer.off("trigger-refresh", handler);
  },
  onLessonsUpdated: (cb) => {
    if (typeof cb !== "function") return () => {};
    const handler = (_event, lessons) => cb(lessons);
    ipcRenderer.on("lessons-updated", handler);
    return () => ipcRenderer.off("lessons-updated", handler);
  },

  // UI helpers
  openHelp: () => ipcRenderer.send("app:openHelp"),
  resizeTo: (payload) => ipcRenderer.send("resize-window", payload),

  // Open WebUntis in browser
  openUntisWeek: (payload) => ipcRenderer.send("open-untis-week", payload),

  // Added: notification toggle
  setNotificationsEnabled: (enabled) => ipcRenderer.send("set-notifications-enabled", !!enabled),

  // Added: frog rain
  showFrogRain: () => ipcRenderer.send('show-frog-rain'),
  onAddMoreFrogs: (cb) => {
    if (typeof cb !== "function") return () => {};
    const handler = () => cb();
    ipcRenderer.on("add-more-frogs", handler);
    return () => ipcRenderer.off("add-more-frogs", handler);
  },

  // Added: game
  openGame: () => ipcRenderer.send("app:openGame"),
});

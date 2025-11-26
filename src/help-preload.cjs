const { contextBridge } = require("electron");

// Since this is a simple, local HTML file with no user input,
// no need to expose any powerful APIs.
// An empty preload script is sufficient for sandboxing.
contextBridge.exposeInMainWorld("api", {});

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("widgetAPI", {
  onData: (callback) => ipcRenderer.on("widget-data", (_e, data) => callback(data)),
});

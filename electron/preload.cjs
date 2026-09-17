const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openOutput: () => ipcRenderer.send("open-output-window"),
  toggleOutputLock: () => ipcRenderer.invoke("toggle-output-lock"),
  getOutputLock: () => ipcRenderer.invoke("get-output-lock"),
});

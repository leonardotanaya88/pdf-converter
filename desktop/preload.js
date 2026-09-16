/**
 * PDF Converter — preload. API minimal untuk renderer (contextIsolation on).
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  /** Baca file dari disk (untuk viewer — file dibuka dari OS). */
  readFile: (filePath) => ipcRenderer.invoke("read-file", filePath),
  /** Dialog "Buka PDF" — kembalikan path atau null. */
  openFileDialog: () => ipcRenderer.invoke("open-file-dialog"),
  /** Versi aplikasi (package.json). */
  getVersion: () => ipcRenderer.invoke("app-version"),
  /** Status server lokal (embedded). */
  getServerStatus: () => ipcRenderer.invoke("server-status"),
  /** Restart server lokal. */
  restartServer: () => ipcRenderer.invoke("server-restart"),
});
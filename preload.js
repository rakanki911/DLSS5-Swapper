'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  boot: () => ipcRenderer.invoke('boot'),
  setLanguage: (lang) => ipcRenderer.invoke('set-language', lang),
  pickGame: () => ipcRenderer.invoke('pick-game'),
  pickSource: () => ipcRenderer.invoke('pick-source'),
  pickReShade: () => ipcRenderer.invoke('pick-reshade'),
  resetPaths: () => ipcRenderer.invoke('reset-paths'),
  scanGame: (dir) => ipcRenderer.invoke('scan-game', dir),
  apply: (config) => ipcRenderer.invoke('apply', config),
  restore: (dir) => ipcRenderer.invoke('restore', dir),
  openPath: (target) => ipcRenderer.invoke('open-path', target),
  window: (action) => ipcRenderer.invoke('window', action),
  // Electron no longer exposes File.path to the renderer, so dropped folders
  // have to be resolved here in the preload.
  pathForFile: (file) => {
    try { return webUtils.getPathForFile(file); } catch { return null; }
  },
  onLog: (handler) => ipcRenderer.on('log', (_event, event) => handler(event))
});

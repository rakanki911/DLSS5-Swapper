'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('lab', {
  // ---- in-game overlay ----
  overlays: () => ipcRenderer.invoke('overlay-list'),
  overlayPreferences: () => ipcRenderer.invoke('overlay-preferences'),
  saveOverlayPreferences: (patch) => ipcRenderer.invoke('overlay-save-preferences', patch),
  overlayAdd: () => ipcRenderer.invoke('overlay-add'),
  overlayRemove: (id) => ipcRenderer.invoke('overlay-remove', id),
  overlayInstall: (id) => ipcRenderer.invoke('overlay-install', id),
  overlayUninstall: (id) => ipcRenderer.invoke('overlay-uninstall', id),
  overlaySource: () => ipcRenderer.invoke('overlay-source'),
  boot: () => ipcRenderer.invoke('boot'),
  setLang: (lang) => ipcRenderer.invoke('set-lang', lang),
  setTheme: (theme) => ipcRenderer.invoke('set-theme', theme),
  window: (action) => ipcRenderer.invoke('window', action),
  library: () => ipcRenderer.invoke('library'),
  scan: (dir) => ipcRenderer.invoke('scan', dir),
  history: () => ipcRenderer.invoke('history'),
  copyText: (text) => ipcRenderer.invoke('copy-text', text),
  gameMenu: (dir, options) => ipcRenderer.invoke('game-menu', dir, options),
  settings: () => ipcRenderer.invoke('settings'),
  setGroupGamesByStore: (enabled) => ipcRenderer.invoke('set-group-games-by-store', enabled),
  setAutoScanDrives: (enabled) => ipcRenderer.invoke('set-auto-scan-drives', enabled),
  addFolder: () => ipcRenderer.invoke('add-folder'),
  removeFolder: (dir) => ipcRenderer.invoke('remove-folder', dir),
  excludeRoot: (dir) => ipcRenderer.invoke('exclude-root', dir),
  addGame: () => ipcRenderer.invoke('add-game'),
  addGameByPath: (dir) => ipcRenderer.invoke('add-game-path', dir),
  setPoster: (dir) => ipcRenderer.invoke('set-poster', dir),
  hide: (dir) => ipcRenderer.invoke('hide', dir),
  reset: () => ipcRenderer.invoke('reset'),
  open: (dir) => ipcRenderer.invoke('open', dir),
  openProject: (destination) => ipcRenderer.invoke('open-project', destination),
  setApiOverride: (dir, exePath, value) => ipcRenderer.invoke('set-api-override', dir, exePath, value),
  artStatus: () => ipcRenderer.invoke('art-status'),
  artFetch: (dir, name, appid) => ipcRenderer.invoke('art-fetch', dir, name, appid),
  touch: (dir) => ipcRenderer.invoke('touch', dir),
  recents: () => ipcRenderer.invoke('recents'),
  details: (dir) => ipcRenderer.invoke('details', dir),
  install: (dir, exePath, route, api) => ipcRenderer.invoke('install', dir, exePath, route, api),
  addons: () => ipcRenderer.invoke('addons'),
  addonToggle: (file, on) => ipcRenderer.invoke('addon-toggle', file, on),
  addonPick: () => ipcRenderer.invoke('addon-pick'),
  addonSave: (entry) => ipcRenderer.invoke('addon-save', entry),
  addonRemove: (file) => ipcRenderer.invoke('addon-remove', file),
  restoreGame: (dir) => ipcRenderer.invoke('restore', dir),
  onJob: (handler) => ipcRenderer.on('job', (_e, event) => handler(event)),
  pathForFile: (file) => { try { return webUtils.getPathForFile(file); } catch { return null; } },
  checkForUpdates: () => ipcRenderer.invoke('updater-check'),
  startUpdateDownload: () => ipcRenderer.invoke('updater-download'),
  installUpdate: () => ipcRenderer.invoke('updater-install'),
  cancelUpdateDownload: () => ipcRenderer.invoke('updater-cancel'),
  getUpdateStatus: () => ipcRenderer.invoke('updater-status'),
  setAutoCheckUpdates: (enabled) => ipcRenderer.invoke('set-auto-check-updates', enabled),
  onUpdaterEvent: (handler) => {
    const fn = (_e, data) => handler(data);
    ipcRenderer.on('updater-event', fn);
    return () => ipcRenderer.removeListener('updater-event', fn);
  },
  onUpdaterProgress: (handler) => {
    const fn = (_e, data) => handler(data);
    ipcRenderer.on('updater-progress', fn);
    return () => ipcRenderer.removeListener('updater-progress', fn);
  }
});

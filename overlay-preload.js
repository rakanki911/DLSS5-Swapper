'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('overlayRuntime', {
  onPreferences:fn=>ipcRenderer.on('lab-overlay-preferences',(_event,value)=>fn(value)),
  onStatus: fn => { const callback = (_event, status) => fn(status); ipcRenderer.on('lab-overlay-status', callback); },
  onVisibility: fn => ipcRenderer.on('lab-overlay-visibility', (_event, visible) => fn(visible)),
  setControl: command => ipcRenderer.send('lab-overlay-control', command),
  resize: height => ipcRenderer.send('lab-overlay-resize', height)
});

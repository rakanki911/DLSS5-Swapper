'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { scanGame, scanSource } = require('./src/core/scan');
const { applySwap, restore } = require('./src/core/apply');

let win = null;

function settingsFile() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
  } catch {
    return {};
  }
}

function saveSettings(patch) {
  const next = { ...loadSettings(), ...patch };
  try {
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
    fs.writeFileSync(settingsFile(), JSON.stringify(next, null, 2), 'utf8');
  } catch {}
  return next;
}

// The DLSS 5 files and the ReShade installer ship with the app in resources
// /payload (see scripts/collect-payload.js). During development the same folder
// sits in the project root.
function payloadDir() {
  const candidates = [
    app.isPackaged ? path.join(process.resourcesPath, 'payload') : null,
    path.join(app.getAppPath(), 'payload'),
    path.join(path.dirname(app.getPath('exe')), 'payload')
  ].filter(Boolean);
  return candidates.find((dir) => fs.existsSync(dir)) || null;
}

// Falls back to folders next to the app so a loose copy of the files still
// works when nothing was bundled.
function resolveSource() {
  const saved = loadSettings().sourceDir;
  if (saved) {
    const probe = scanSource(saved);
    if (probe.ok) return { dir: saved, source: probe, bundled: false };
  }

  const bundled = payloadDir();
  if (bundled) {
    const probe = scanSource(bundled);
    if (probe.ok) return { dir: bundled, source: probe, bundled: true };
  }

  for (const dir of [path.resolve(app.getAppPath(), '..'), path.dirname(app.getPath('exe'))]) {
    const probe = scanSource(dir);
    if (probe.ok) return { dir, source: probe, bundled: false };
  }
  const fallback = bundled || path.resolve(app.getAppPath(), '..');
  return { dir: fallback, source: scanSource(fallback), bundled: false };
}

function newestSetup(found) {
  found.sort((a, b) => {
    for (let i = 0; i < 3; i++) {
      const diff = (b.version[i] || 0) - (a.version[i] || 0);
      if (diff) return diff;
    }
    return 0;
  });
  return found[0] || null;
}

function setupsIn(dir) {
  const found = [];
  let entries = [];
  try { entries = fs.readdirSync(dir); } catch { return found; }
  for (const name of entries) {
    // Only the "Addon" build can load the DLSS 5 add-on.
    if (!/^ReShade_Setup_.*_Addon\.exe$/i.test(name)) continue;
    const version = (name.match(/(\d+)\.(\d+)\.(\d+)/) || []).slice(1).map(Number);
    found.push({ file: path.join(dir, name), version });
  }
  return found;
}

function resolveReShadeSetup() {
  const saved = loadSettings().reshadeSetup;
  if (saved && fs.existsSync(saved)) return { file: saved, bundled: false };

  const bundled = payloadDir();
  if (bundled) {
    const inPayload = newestSetup(setupsIn(bundled));
    if (inPayload) return { file: inPayload.file, bundled: true };
  }

  const home = os.homedir();
  const found = [
    path.join(home, 'Downloads'),
    path.join(home, 'OneDrive', 'Downloads'),
    path.join(home, 'Desktop'),
    path.join(home, 'OneDrive', 'Desktop'),
    app.getAppPath(),
    path.resolve(app.getAppPath(), '..')
  ].flatMap(setupsIn);

  const best = newestSetup(found);
  return best ? { file: best.file, bundled: false } : { file: null, bundled: false };
}

function initialLanguage() {
  const saved = loadSettings().language;
  if (saved === 'ar' || saved === 'en') return saved;
  return String(app.getLocale() || '').toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

function createWindow() {
  win = new BrowserWindow({
    width: 980,
    height: 780,
    minWidth: 820,
    minHeight: 620,
    backgroundColor: '#0b0e13',
    icon: path.join(__dirname, 'src', 'renderer', 'icon.png'),
    // The window draws its own title bar, so the frame comes off.
    frame: false,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => { win = null; });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Core modules report {code, params}; the renderer decides the wording.
const log = (event) => win && win.webContents.send('log', event);

ipcMain.handle('boot', () => {
  const resolved = resolveSource();
  const reshade = resolveReShadeSetup();
  return {
    sourceDir: resolved.dir,
    source: resolved.source,
    sourceBundled: resolved.bundled,
    reshadeSetup: reshade.file,
    reshadeBundled: reshade.bundled,
    lastGame: loadSettings().lastGame || null,
    language: initialLanguage(),
    appVersion: app.getVersion()
  };
});

ipcMain.handle('set-language', (_event, language) => {
  saveSettings({ language });
  return language;
});

ipcMain.handle('pick-game', async () => {
  const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('pick-source', async () => {
  const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
  if (result.canceled) return null;
  const dir = result.filePaths[0];
  saveSettings({ sourceDir: dir });
  return { dir, source: scanSource(dir), bundled: false };
});

ipcMain.handle('pick-reshade', async () => {
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [{ name: 'ReShade Setup', extensions: ['exe'] }]
  });
  if (result.canceled) return null;
  const file = result.filePaths[0];
  saveSettings({ reshadeSetup: file });
  return file;
});

// Drops the override and goes back to whatever shipped with the app.
ipcMain.handle('reset-paths', () => {
  saveSettings({ sourceDir: null, reshadeSetup: null });
  const resolved = resolveSource();
  const reshade = resolveReShadeSetup();
  return {
    sourceDir: resolved.dir,
    source: resolved.source,
    sourceBundled: resolved.bundled,
    reshadeSetup: reshade.file,
    reshadeBundled: reshade.bundled
  };
});

ipcMain.handle('scan-game', async (_event, gameDir) => {
  const result = await scanGame(gameDir);
  saveSettings({ lastGame: gameDir });
  return result;
});

ipcMain.handle('apply', async (_event, config) => {
  try {
    const manifest = await applySwap(config, log);
    return { ok: true, manifest };
  } catch (err) {
    return { ok: false, code: err.code || null, params: err.params || {}, message: err.message };
  }
});

ipcMain.handle('restore', async (_event, gameDir) => {
  try {
    await restore(gameDir, log);
    return { ok: true };
  } catch (err) {
    return { ok: false, code: err.code || null, params: err.params || {}, message: err.message };
  }
});

ipcMain.handle('open-path', (_event, target) => shell.openPath(target));

ipcMain.handle('window', (_event, action) => {
  if (!win) return;
  if (action === 'minimize') win.minimize();
  else if (action === 'close') win.close();
  else if (action === 'maximize') {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  }
});

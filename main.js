'use strict';
// DLSS 5 Swapper
// Finds the games already on the machine and installs DLSS 5 Neural
// Rendering into them, using the scanners in src/core.
const { app, BrowserWindow, ipcMain, dialog, shell, clipboard, Menu, Tray, Notification, nativeImage, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL, fileURLToPath } = require('url');
const { paletteFromPixels, mergePalettes } = require('./src/core/palette');
const crypto = require('crypto');

const os = require('os');
const diagnostics = require('./src/core/diagnostics');
const { scanGame } = require('./src/core/scan.js');
const { discover, folder, dedupe, isInside, steam } = require('./src/library');
const { contextForSteamGame, createSetupRunner } = require('./src/core/proton');
const art = require('./src/steamart');
const { backupRoot, saveActiveManifest, writeTracked, makeReShadeConfigWritable } = require('./src/core/apply.js');
const { scanSource } = require('./src/core/scan.js');
const pe = require('./src/core/pe.js');
const { ensureLumenite, ensureDgVoodoo, missingVCRuntime } = require('./src/core/runtime-components.js');
// A component that downloaded and verified, then vanished before it could be
// used, is a security tool quarantining it - never the connection. Saying
// "check your connection" there sends people after the wrong thing.
const componentCode = (error, fallback) => (error && error.code === 'componentRemoved' ? 'componentQuarantined' : fallback);
const installRoutes = require('./src/shared/install-routes');
const renderingApi = require('./src/shared/rendering-api');
const { projectUrl } = require('./src/core/project-links');
const optiscaler = require('./src/core/optiscaler');
const { missingPayload } = require('./src/core/payload-guidance');
const backends = require('./src/core/backend-manager');
const journal = require('./src/core/file-journal');
const guards = require('./src/core/install-guards');
const compatibility = require('./src/core/compatibility');
const antiCheatWarning = require('./src/shared/anti-cheat-warning');
const featureI18n = require('./src/shared/feature-i18n');
const featureText = (key, ...args) => featureI18n.t(loadState().lang, key, ...args);
const vulkanLayer = require('./src/core/vulkan-layer');
const { HistoryStore, knownFolders, fromManifests } = require('./src/core/history');
const gameMenu = require('./src/core/game-menu');
const { CommunityClient, ADMIN_TOKEN_PATTERN } = require('./src/community-client');
const { AdminVault } = require('./src/admin-vault');
let historyStore;
const history = () => historyStore || (historyStore = new HistoryStore(path.join(app.getPath('userData'), 'history.jsonl')));
let communityClient;
let adminVault;
const adminAccess = () => adminVault || (adminVault = new AdminVault({
  file: path.join(app.getPath('userData'), 'community-admin.bin'), storage: safeStorage
}));
const community = () => communityClient || (communityClient = new CommunityClient({
  file: path.join(app.getPath('userData'), 'community.json'),
  // Only ever set by hand, to point a development build at a server running
  // locally. Unset - which is every installed copy - it is the real one.
  baseUrl: process.env.DLSS5_COMMUNITY_API || undefined,
  getAdminToken: () => adminAccess().load()
}));
const communityAnswer = async work => {
  try { return { ok: true, ...(await work()) }; }
  catch (error) { return { ok: false, error: error.code || 'community_failed', message: error.message, status: error.status || null }; }
};
const gameName = dir => lastGames.find(game => keyFor(game.dir) === keyFor(dir))?.name || path.basename(dir);
function saveOperation(dir, manifest, action, send) {
  try { history().record(dir, manifest, action, gameName(dir)); }
  catch (error) {
    // The game operation succeeded. Report the separate history write failure.
    // HistoryStore retains the row in memory for a later retry.
    send({ code: 'historySaveWarning', params: { error: error.message } });
  }
}

// ---------- add-on builds ----------
// The integrated RenoDX build is always installed and is not presented as an
// optional add-on. Other bundled or user-added builds still appear in the
// Add-ons screen, and an `addons` folder beside the executable remains valid.
function addonFolders() {
  if (!app.isPackaged) return [path.join(__dirname, 'addons')];
  return [
    path.join(process.resourcesPath, 'addons'),
    path.join(path.dirname(app.getPath('exe')), 'addons')
  ];
}

// What each build is, keyed by the hash of its contents so a build keeps its
// description wherever the file is moved or renamed to. The bullet lists are
// the authors' own release notes from the RenoDX Discord, kept verbatim and
// untranslated for the same reason a changelog is: they are a quote, not our
// wording. Anything unrecognised falls back to the folder it sits in.
const KNOWN = {
  // The build that used to ship. Recognised if someone adds it by hand, but
  // it is no longer the one bundled.
  '189efdee6a327833': { name: 'Stable (previous)' },
  // Superseded by the v4.7 that now ships. Kept recognised so a hand-added copy
  // is still named rather than showing up as its folder.
  '0c0a02578d2aadf2': { name: 'v4.6 (previous)' },
  // Bundled: the build the in-game overlay's adapter is fingerprinted against.
  '88116071ef689864': {
    name: 'v4.7',
    shipped: true
  }
};

// An add-on's identity is the hash of its contents, and the add-ons page asks
// for it every time it is opened - which meant reading and hashing several
// megabytes per file on each visit. A file is the same file while its path,
// size and modification time are unchanged, so the answer is kept.
const describedFiles = new Map();

function describe(file, label) {
  let stat;
  try { stat = fs.statSync(file); } catch { return null; }
  const key = path.resolve(file).toLowerCase();
  const stamp = `${stat.size}:${stat.mtimeMs}`;
  const remembered = describedFiles.get(key);
  let id, version, size;
  if (remembered && remembered.stamp === stamp) {
    ({ id, version, size } = remembered);
  } else {
    let buf;
    try { buf = fs.readFileSync(file); } catch { return null; }
    version = pe.getFileVersion(file);
    id = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16);
    size = buf.length;
    describedFiles.set(key, { stamp, id, version, size });
  }
  // This former bundled companion duplicates capabilities now provided by the
  // integrated RenoDX and Feeder routes and can conflict when loaded beside
  // them. Hide stale copies left behind by an older installation too.
  if (id === '76e8a0c90a6b99a7') return null;
  const known = KNOWN[id] || {};
  return {
    ...known,
    // Identity is the content, not the path: the same build sits both in the
    // app payload and loose in the project root, and listing it twice would
    // invite someone to "switch" to the build already running.
    id,
    path: file,
    file: path.basename(file),
    label: known.name || label,
    size,
    // A build with no version resource reports 0.0.0.0, which says nothing.
    version: version && version !== '0.0.0.0' ? version : null
  };
}

// The folder a build sits in is the only description we have of it, and it is
// the one the person writing it chose - "RE Engine games", "dx12 dx 11 dx 9".
function addonLibrary() {
  const found = [];
  const seen = new Set();
  const add = (file, label, own) => {
    if (!/\.addon(64)?$/i.test(file)) return;
    const row = describe(file, label);
    if (row && own) {
      row.custom = true;
      // Hand-added builds are listed exactly as given. Nearly every build is
      // called renodx-dlss.addon64 and several share their contents, so
      // matching on either would refuse files the person deliberately picked.
      // Only the path decides, and the row is always theirs to delete.
      row.id = 'custom:' + path.resolve(file).toLowerCase();
      // A hand-added build is described only by what the person typed. It used
      // to fall back on the recognised build's entry, so an add-on named
      // "tajriba" came back wearing somebody else's release notes and warning.
      row.label = own.name || path.basename(path.dirname(file));
      row.notes = own.notes && own.notes.length ? own.notes : null;
      row.warn = own.tag || null;
      row.caution = null;
      row.shipped = false;
    }
    // The payload copy is added first, so it is the one that survives and the
    // list says "shipped with the app" rather than naming a stray folder.
    if (row && !seen.has(row.id)) { seen.add(row.id); found.push(row); }
  };

  const p = payload(true);
  if (p && p.source.addon) add(p.source.addon, null);

  for (const box of addonFolders()) {
    let dropped = [];
    try { dropped = fs.readdirSync(box); } catch { continue; /* no such folder is normal */ }
    for (const f of dropped) add(path.join(box, f), null);
  }

  for (const e of loadState().addonFiles || []) {
    const row = typeof e === 'string' ? { path: e } : e;
    add(row.path, null, {
      custom: true, name: row.name || null, notes: row.notes || null, tag: row.tag || null
    });
  }

  // The shipped build is the base, not a choice, so it is not offered.
  const base = p && path.basename(p.source.addon).toLowerCase();
  const chosen = new Set(enabledAddons());
  return found
    .filter((r) => !r.shipped)
    .map((r) => ({
      ...r,
      active: chosen.has(r.path),
      // Same file name as the base means it overwrites it rather than joining.
      replaces: path.basename(r.path).toLowerCase() === base
    }));
}

// The payload that ships with the app. `raw` skips the add-on override,
// which is how the library finds the shipped build in the first place.
function payload(raw) {
  // Installed, the payload rides along as an extra resource; from source it
  // sits beside main.js.
  for (const dir of [path.join(process.resourcesPath || '', 'payload'), path.join(__dirname, 'payload')]) {
    const probe = scanSource(dir);
    if (probe.ok) {
      const setup = fs.readdirSync(dir).find((f) => /^ReShade_Setup_.*_Addon\.exe$/i.test(f));
      // Point at the chosen build instead of copying files around: the payload
      // folder is what a build ships, and switching must not rewrite it.
      // Only a same-named build changes what applySwap installs; a differently
      // named one is copied in afterwards, beside the base.
      if (!raw) {
        const state = loadState();
        const list = state.addons || (state.addon ? [state.addon] : []);
        const base = path.basename(probe.addon).toLowerCase();
        const over = list.find((f) => fs.existsSync(f) && path.basename(f).toLowerCase() === base);
        if (over) probe.addon = over;
      }
      return { source: probe, reshadeSetup: setup ? path.join(dir, setup) : null };
    }
  }
  return null;
}

let win = null;

const stateFile = () => path.join(app.getPath('userData'), 'library.json');
const posterDir = () => path.join(app.getPath('userData'), 'posters');
const keyFor = (dir) => crypto.createHash('sha1').update(path.resolve(dir).toLowerCase()).digest('hex').slice(0, 16);
// Bump when scan metadata or detection changes so an old wrong result is not
// kept forever merely because the folder was scanned by an earlier release.
const SCAN_RULES = 7;

// One live object, not a fresh snapshot per call. Every handler used to parse
// the file, hold that copy across an await, and write the whole thing back:
// two scans running at once each wrote their own stale copy, and whichever
// finished last silently dropped the other's result. Sharing the object means
// every write carries everything already known.
let liveState = null;

function readState() {
  try {
    const value = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  } catch { /* absent or unreadable: start from the defaults below */ }
  // Nothing seeded: the drive sweep finds game libraries on its own, and a
  // path from the machine this was written on means nothing anywhere else.
  return { folders: [], excludedRoots: [], manual: [], posters: {}, hidden: [], scans: {} };
}

function loadState() {
  if (!liveState) liveState = readState();
  return liveState;
}

function saveState(state) {
  // A handler that built its own object still becomes the live one, so a caller
  // that does not go through loadState() cannot resurrect the old race.
  if (state && state !== liveState) liveState = state;
  try {
    fs.mkdirSync(path.dirname(stateFile()), { recursive: true });
    fs.writeFileSync(stateFile(), JSON.stringify(liveState, null, 2), 'utf8');
    return true;
  } catch { return false; }
}

// A choice belongs to one executable, not every launcher in the same folder.
const apiPreferenceKey = (dir, exe) => crypto.createHash('sha256')
  .update(path.resolve(dir).toLowerCase()).update('\0')
  .update(path.relative(dir, exe).toLowerCase()).digest('hex');
function apiPreference(state, dir, exe) {
  const value = state.apiOverrides?.[apiPreferenceKey(dir, exe)];
  return renderingApi.valid(value) ? value : 'auto';
}

// Renderer can only load what it is handed a URL for.
function posterUrl(game, state) {
  const key = keyFor(game.dir);
  const custom = state.posters[key];
  if (custom && fs.existsSync(custom)) return { url: pathToFileURL(custom).href, tall: true, custom: true };
  // Art fetched earlier is already on disk; use it before the
  // launcher's own cache, which is often only a wide header.
  const record = state.art && state.art[key];
  const saved = record?.rules === ART_RULES ? record : null;
  if (saved && saved.cover) return { url: saved.cover, tall: true, custom: false };
  // A game too new for a portrait capsule still has a banner. The grid knows
  // how to show a wide image, which beats falling back to two initials.
  if (saved && saved.hero) return { url: saved.hero, tall: false, custom: false };
  if (game.poster) return { url: pathToFileURL(game.poster.file).href, tall: game.poster.tall, custom: false };
  return null;
}

// The tray. Closing the window puts the app here rather than ending it, which
// is what #255 asked for: people close a window out of habit and then wonder
// why the overlay stopped answering in the game they are still playing.
let tray = null;
// The main process has no translations of its own, so the renderer hands these
// over the way it already does for the game context menu.
let trayLabels = { show: 'Open DLSS 5 Swapper', quit: 'Quit' };

function showWindow() {
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function buildTrayMenu() {
  if (!tray || tray.isDestroyed()) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: trayLabels.show, click: showWindow },
    { type: 'separator' },
    // The only way out that means it: everything else hides the window.
    { label: trayLabels.quit, click: () => { quitting = true; app.quit(); } }
  ]));
}

function ensureTray() {
  if (tray && !tray.isDestroyed()) return tray;
  const source = nativeImage.createFromPath(path.join(__dirname, 'src', 'renderer', 'icon.png'));
  // A 16px tray icon on Windows; an empty image would throw, so a full-size
  // fallback is better than no tray at all.
  const icon = source.isEmpty() ? source : source.resize({ width: 16, height: 16, quality: 'good' });
  try { tray = new Tray(icon); } catch { return null; }
  tray.setToolTip('DLSS 5 Swapper');
  tray.on('click', showWindow);
  tray.on('double-click', showWindow);
  buildTrayMenu();
  return tray;
}

// The portable build runs from a folder it extracts into %TEMP% on each launch;
// an installed copy runs from where it was installed. Which one is speaking
// changes what the person should do about a missing payload.
const runningPortable = () =>
  Boolean(process.env.PORTABLE_EXECUTABLE_DIR) ||
  /[\/]Temp[\/]/i.test(process.resourcesPath || '');

const payloadMissing = () => missingPayload({
  packaged: app.isPackaged,
  resourcesPath: process.resourcesPath || __dirname,
  appRoot: __dirname,
  portable: runningPortable(),
  temp: app.getPath ? (() => { try { return app.getPath('temp'); } catch { return null; } })() : null
});

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1040,
    minHeight: 700,
    backgroundColor: '#05070a',
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
  // Close hides to the tray unless the person turned that off, or unless the
  // app is genuinely quitting - Quit in the tray menu, or the OS asking.
  win.on('close', (event) => {
    if (quitting || loadState().closeToTray === false || !ensureTray()) return;
    event.preventDefault();
    win.hide();
  });
  win.on('closed', () => {
    win = null;
    // The overlay bridge holds an offscreen window, so the window list is
    // never empty and window-all-closed never arrives: without this the
    // process stayed in Task Manager with nothing on screen.
    if (!quitting) app.quit();
  });
}

// Windows groups taskbar entries and attributes shortcuts by this id. Without
// it the window is filed under whatever launched it - "Electron" when run from
// source - instead of under the app.

app.setAppUserModelId('com.rakan.dlss5swapper');

// A second copy of the app is not just wasted memory: it writes its own
// overlay endpoint over the first one's and listens on its own pipe, so the
// panel in the game would be driven by whichever window happened to start
// last. Opening the app again raises the window that is already running.
//
// The lock is asked for defensively - the IPC handlers in this file are also
// exercised outside Electron, where app is a stand-in that has no such call.
const singleInstance = typeof app.requestSingleInstanceLock === 'function'
  ? app.requestSingleInstanceLock()
  : true;
if (!singleInstance) {
  app.quit();
} else {
  // Opening the app again raises the window - including when it is in the tray
  // rather than merely minimised.
  app.on('second-instance', showWindow);
}


// The same overlay library the Overlay page manages, so an install picks up
// exactly the build shown there.
function overlayLibrary() {
  const { createOverlayLibrary } = require('./src/overlays');
  const root = path.resolve(__dirname);
  const builtin = app.isPackaged
    ? path.join(process.resourcesPath, 'overlay', 'dlss5-lab-overlay.addon64')
    : path.join(root, 'dist/overlay/dlss5-lab-overlay.addon64');
  return createOverlayLibrary(path.join(app.getPath('userData'), 'overlay-library'), builtin,
    [root, app.isPackaged ? path.dirname(app.getPath('exe')) : root]);
}

// The in-game overlay draws its panel in an offscreen window here and streams
// the frames over a local pipe, so the bridge lives as long as the app does.
let overlayBridge;
let quitting = false;

app.whenReady().then(async () => {
  // app.quit() is asynchronous, so a copy that lost the lock still reaches
  // this point: without the guard it would create a window and take over the
  // overlay endpoint on its way out.
  if (!singleInstance) return;
  // Registered here rather than at load: main.js is exercised in a plain vm
  // context by the tests, where src modules are stubbed and cannot be called.
  require('./src/overlay-ipc')({ app, ipcMain, dialog, shell, window: () => win, bridge: () => overlayBridge });
  createWindow();
  // The icon is there from launch, not only after the first close - somebody
  // who wants the app parked in the tray wants to see that it is.
  if (loadState().closeToTray !== false) ensureTray();
  startNotices();
  try {
    overlayBridge = await require('./src/overlay-bridge')({ BrowserWindow, userData: app.getPath('userData') });
    if (quitting) overlayBridge.close();
  } catch (error) {
    if (!quitting) console.error('Overlay bridge:', error.message);
  }
  setTimeout(async () => {
    try {
      const state = loadState();
      if (state.autoCheckUpdates !== false && (!updaterState.status || updaterState.status === 'idle')) {
        const curVer = app.getVersion ? app.getVersion() : require('./package.json').version;
        const res = await updater.checkForUpdates({
          currentVersion: curVer,
          isPortable: isPortableRunning()
        });
        if (res.available) {
          broadcastUpdater('available', { info: res, error: null });
        }
      }
    } catch {
      // Startup background check is non-fatal
    }
  }, 4000);
});
// The overlay bridge keeps an offscreen window of its own, so closing the
// visible one no longer emptied the window list and window-all-closed never
// arrived: the process stayed in Task Manager with nothing on screen. Quitting
// follows the window the person actually closed.
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { quitting = true; overlayBridge?.close(); });

// ---------- in-app updater helpers ----------
function isPortableRunning() {
  return Boolean(
    process.env.PORTABLE_EXECUTABLE_DIR ||
    process.env.PORTABLE_EXECUTABLE_FILE ||
    (process.execPath && path.basename(process.execPath).toLowerCase().includes('portable'))
  );
}

let updaterState = {
  status: 'idle',
  info: null,
  progress: null,
  error: null,
  downloadedFile: null
};
let downloadAbortController = null;

function broadcastUpdater(status, extra = {}) {
  updaterState = { ...updaterState, status, ...extra };
  if (win && !win.isDestroyed()) {
    win.webContents.send('updater-event', { status, ...updaterState });
  }
}

// ---------- library ----------

// The renderer needs a URL for the logo, and it falls back to a drawn mark if
// the file is not there.
ipcMain.handle('boot', () => {
  const state = loadState();
  const asUrl = (name) => {
    const file = path.join(__dirname, 'assets', name);
    return fs.existsSync(file) ? pathToFileURL(file).href : null;
  };
  return {
    version: require('./package.json').version,
    // Said at launch rather than at the moment somebody presses Install. The
    // app used to look completely healthy right up until it could not work.
    payloadMissing: (() => {
      // Never let a probe stop the app opening: a launch that fails because it
      // could not check its own files is worse than the missing files.
      try { return payload() ? null : payloadMissing().message; } catch { return null; }
    })(),
    theme: state.theme || 'light',
    lang: state.lang || 'en',
    groupGamesByStore: state.groupGamesByStore !== false,
    logo: asUrl('logo.png'),
    logoDark: asUrl('logo-dark.png')
  };
});

ipcMain.handle('set-lang', (_event, lang) => {
  const state = loadState();
  state.lang = lang;
  saveState(state);
  return lang;
});

ipcMain.handle('set-theme', (_event, theme) => {
  const state = loadState();
  state.theme = theme;
  saveState(state);
  return theme;
});

// Import legacy backups from known locations only. Do not scan all drives.
ipcMain.handle('history', () => {
  let warning = false;
  const rows = history().list(mutationBusy ? [] : knownFolders(loadState(), lastGames), () => { warning = true; });
  return { rows, warning };
});

// One file with everything a report needs: the app's own log, the game's
// ReShade and Feeder logs, the install manifest, the driver. Asking for those
// one at a time costs a round trip per report and half arrive incomplete.
//
// Nothing is gathered silently. The person is shown every file that would go in
// and where it came from, and chooses where to save it.
ipcMain.handle('save-diagnostics', async (event, dir, activity) => {
  if (typeof dir !== 'string' || !path.isAbsolute(dir)) return { ok: false };
  const window = BrowserWindow.fromWebContents(event.sender);
  const userData = app.getPath('userData');
  let exeDir = null;
  try {
    const scan = await scanGame(dir);
    if (scan.chosen) exeDir = path.dirname(scan.chosen.path);
  } catch { /* the folder alone is still worth reporting */ }

  const found = diagnostics.sources({ gameDir: dir, exeDir, userData });
  const list = found.length
    ? found.map(item => `\u2022 ${item.file}  (${Math.ceil(item.bytes / 1024)} KB)`).join('\n')
    : 'No log files were found for this game yet.';
  const consent = await dialog.showMessageBox(window, {
    type: 'question', title: 'Save diagnostics',
    message: 'These files will be copied into one text file:',
    detail: `${list}\n\nIt also records the app version, your GPU and driver, and this session's activity log. Game folder paths appear in it. Read it before attaching it anywhere.`,
    buttons: ['Cancel', 'Choose where to save'], defaultId: 1, cancelId: 0
  });
  if (consent.response !== 1) return { ok: false, cancelled: true };

  let gpu = null;
  try { gpu = guards.driverNames(await guards.gpuInfo()); } catch { /* advice only */ }
  const { text } = diagnostics.report({
    gameDir: dir, exeDir, userData,
    facts: {
      app: app.getVersion(), electron: process.versions.electron, platform: `${process.platform} ${os.release()}`,
      gpu, game: path.basename(dir), 'game folder': dir, 'executable folder': exeDir,
      activity: typeof activity === 'string' && activity.length <= 512 * 1024 ? `\n${activity}` : null
    }
  });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const picked = await dialog.showSaveDialog(window, {
    title: 'Save diagnostics',
    defaultPath: path.join(app.getPath('documents'), `dlss5-swapper-diagnostics-${stamp}.txt`),
    filters: [{ name: 'Text', extensions: ['txt'] }]
  });
  if (picked.canceled || !picked.filePath) return { ok: false, cancelled: true };
  try {
    await fs.promises.writeFile(picked.filePath, text, 'utf8');
    return { ok: true, file: picked.filePath, count: found.length };
  } catch (error) {
    return { ok: false, message: error.message };
  }
});

ipcMain.handle('copy-text', (_event, text) => {
  if (typeof text !== 'string' || !text.trim() || Buffer.byteLength(text, 'utf8') > 16 * 1024 * 1024) return false;
  try { clipboard.writeText(text); return true; } catch { return false; }
});

ipcMain.handle('game-menu', async (event, dir, options) => {
  if (typeof dir !== 'string' || !path.isAbsolute(dir)) return null;
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || window.isDestroyed()) return null;
  return gameMenu.show({ Menu, dialog, window, dir, name: gameName(dir),
    labels: options?.labels, position: options?.position, busy: mutationBusy || options?.busy === true });
});

ipcMain.handle('settings', () => {
  const state = loadState();
  let posterCount = 0;
  try { posterCount = fs.readdirSync(posterDir()).length; } catch {}
  return {
    folders: state.folders, stateFile: stateFile(), posterDir: posterDir(), posterCount,
    roots: lastRoots,
    excludedRoots: state.excludedRoots || [],
    hidden: [...(state.hidden || [])],
    autoScanDrives: state.autoScanDrives === true,
    groupGamesByStore: state.groupGamesByStore !== false,
    closeToTray: state.closeToTray !== false
  };
});

// ---------- community compatibility ----------
// Network access stays in the main process. The renderer receives only parsed
// data and cannot choose an arbitrary host or attach the private install id to
// another request.
ipcMain.handle('community-profile', async () => {
  if (adminAccess().load()) {
    try { await community().adminStatus(); }
    catch (error) { if (error.code === 'admin_unauthorized') adminAccess().clear(); }
  }
  return community().profile();
});
ipcMain.handle('community-profile-save', (_event, profile) => communityAnswer(async () => ({
  profile: await (async () => {
    const input = profile && typeof profile === 'object' ? profile : {};
    const candidate = String(input.name || '').trim();
    if (!candidate.startsWith('dlss5_admin_')) return community().saveProfile(input);
    if (!ADMIN_TOKEN_PATTERN.test(candidate)) throw Object.assign(new Error('Invalid administrator access code.'), { code: 'admin_unauthorized' });
    const admin = await community().adminLogin(candidate);
    adminAccess().save(candidate);
    return { ...community().profile(), admin };
  })()
})));
ipcMain.handle('community-admin-logout', () => communityAnswer(async () => {
  adminAccess().clear();
  community().adminLogout();
  return { profile: { ...community().profile(), admin: null } };
}));
ipcMain.handle('community-delete-me', () => communityAnswer(async () => ({
  result: await community().deleteMe()
})));
ipcMain.handle('community-cards', (_event, filters) => communityAnswer(async () => ({
  ...(await community().cardsPage(filters && typeof filters === 'object' ? filters : {}))
})));
ipcMain.handle('community-my-reports', () => communityAnswer(async () => ({
  result: await community().myReports()
})));
ipcMain.handle('community-replies', (_event, id, fresh) => communityAnswer(async () => ({
  thread: await community().replies(id, { fresh: fresh === true })
})));
ipcMain.handle('community-reply', (_event, id, body, mentions) => communityAnswer(async () => ({
  reply: await community().reply(id, typeof body === 'string' ? body : '', Array.isArray(mentions) ? mentions : [])
})));
ipcMain.handle('community-card', (_event, key, etag, fresh) => communityAnswer(async () => {
  if (typeof key !== 'string' || key.length > 300) throw Object.assign(new Error('Invalid game card.'), { code: 'bad_card' });
  const result = await community().card(key, typeof etag === 'string' ? etag : null, { fresh: fresh === true });
  return result.notModified ? result : { card: result.data, etag: result.etag };
}));
ipcMain.handle('community-updates', (_event, key, since, etag) => communityAnswer(async () => {
  if (typeof key !== 'string' || key.length > 300) throw Object.assign(new Error('Invalid game card.'), { code: 'bad_card' });
  const result = await community().updates(key, since, typeof etag === 'string' ? etag : null);
  return result.notModified ? result : { updates: result.data, etag: result.etag };
}));
ipcMain.handle('community-report', (_event, report) => communityAnswer(async () => ({
  result: await community().report(report && typeof report === 'object' ? report : {})
})));
ipcMain.handle('community-withdraw', (_event, id) => communityAnswer(async () => ({
  result: await community().withdraw(id)
})));
ipcMain.handle('community-withdraw-reply', (_event, id) => communityAnswer(async () => ({
  result: await community().withdrawReply(id)
})));
ipcMain.handle('community-reaction', (_event, id, emoji, on) => communityAnswer(async () => ({
  result: await community().react(id, emoji, on)
})));
ipcMain.handle('community-admin-moderate', (_event, kind, id, action) => communityAnswer(async () => ({
  result: await community().adminModerate(kind, id, action)
})));
// The line over the title: where the game came from, and what the store calls
// it. Both are already known - nothing here is guessed at.
function kickerFor(dir, game) {
  let genres = [];
  try { genres = ((loadState().art || {})[keyFor(dir)] || {}).genres || []; } catch { /* none yet */ }
  return [game.launcher, genres[0]].filter(Boolean).join(' · ') || null;
}
// The banner the library already downloaded for this folder, if there is one.
function heroFor(dir) {
  try {
    const record = (loadState().art || {})[keyFor(dir)];
    return record && record.hero && onDisk(record.hero) ? record.hero : null;
  } catch { return null; }
}
// The scanner speaks in the name of the DLL it hooks, where "dxgi" covers both
// DirectX 11 and 12; the community database speaks in the names people use. The
// label is the only place the two are told apart, so the label decides. What it
// cannot decide - DirectX 10, bare DXGI, an executable that named no renderer -
// is left for the person to choose rather than guessed at.
function communityApi(chosen) {
  const label = String(chosen?.apiLabel || '');
  if (/11\/12/.test(label)) return null;
  if (/DirectX 12/i.test(label)) return 'dx12';
  if (/DirectX 11/i.test(label)) return 'dx11';
  if (/DirectX 9/i.test(label)) return 'dx9';
  if (/DirectX 8/i.test(label)) return 'dx8';
  if (/Vulkan/i.test(label)) return 'vulkan';
  if (/OpenGL/i.test(label)) return 'opengl';
  return null;
}


// ---------------------------------------------------------------- notices
// A reply under your result, your name in a sentence, or a comment on a game
// you follow. The server keeps the rows; this asks for the ones above the last
// id it saw, so an app closed all week is told once rather than a hundred
// times. The wording is the renderer's job - the community feature speaks the
// two languages its own page does, not the thirty-eight the installer needs.
const NOTICE_EVERY = 60_000;
let noticeTimer = null;
let noticeBusy = false;

const noticesOn = () => loadState().communityNotices !== false;

async function pollNotices() {
  if (noticeBusy || !noticesOn() || !win || win.isDestroyed()) return;
  noticeBusy = true;
  try {
    // The very first look only learns where the line is. Nobody wants to be
    // greeted by every notification they have ever earned.
    if (await community().noticeCatchUp()) return;
    const answer = await community().notices();
    const fresh = (answer && answer.notices || []).filter(notice => !notice.read);
    if (fresh.length && win && !win.isDestroyed()) win.webContents.send('community-notices', fresh);
  } catch { /* offline, or the service is down: try again next minute */ }
  finally { noticeBusy = false; }
}

function startNotices() {
  if (noticeTimer) clearInterval(noticeTimer);
  noticeTimer = setInterval(() => { pollNotices(); }, NOTICE_EVERY);
  setTimeout(() => { pollNotices(); }, 8000);
}

// Shown only after the page has said what they should say, and marked read
// only after they have actually been shown - a crash in between should repeat
// a notification, never swallow it.
ipcMain.handle('community-notify', (_event, items) => {
  if (!Array.isArray(items) || !Notification.isSupported() || !noticesOn()) return { ok: false };
  for (const item of items.slice(0, 4)) {
    const popup = new Notification({
      title: String(item?.title || '').slice(0, 120),
      body: String(item?.body || '').slice(0, 240)
    });
    popup.on('click', () => {
      if (!win || win.isDestroyed()) return;
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
      win.webContents.send('community-open', item);
    });
    popup.show();
  }
  return { ok: true };
});

ipcMain.handle('community-notices-read', () => communityAnswer(async () => ({
  result: await community().readNotices()
})));
ipcMain.handle('community-notice-settings', (_event, on) => {
  const state = loadState();
  if (typeof on === 'boolean') { state.communityNotices = on; saveState(state); }
  return { ok: true, on: state.communityNotices !== false };
});
ipcMain.handle('community-follow', (_event, key, on) => communityAnswer(async () => ({
  result: await community().follow(String(key || ''), on !== false)
})));
ipcMain.handle('community-notices', () => communityAnswer(async () => ({
  result: await community().notices()
})));
ipcMain.handle('community-edit-reply', (_event, id, body) => communityAnswer(async () => ({
  result: await community().editReply(id, typeof body === 'string' ? body : '')
})));

ipcMain.handle('community-prefill', async (_event, dir) => {
  if (typeof dir !== 'string' || !path.isAbsolute(dir)) return { ok: false, error: 'bad_game' };
  const game = lastGames.find(row => keyFor(row.dir) === keyFor(dir));
  if (!game) return { ok: false, error: 'bad_game' };
  return communityAnswer(async () => {
    const scan = await scanGame(dir);
    // The API the person actually installed against: their own override when
    // they set one, detection otherwise.
    const target = scan.chosen
      ? renderingApi.effective(scan.chosen, apiPreference(loadState(), dir, scan.chosen.path))
      : null;
    const gpus = await guards.gpuInfo().catch(() => null);
    const gpu = Array.isArray(gpus) && gpus[0] ? gpus[0] : {};
    const route = scan.install?.route === 'native' ? 'renodx' : (scan.install?.route || null);
    const store = ({ Steam: 'steam', 'Epic Games': 'epic', GOG: 'gog', Xbox: 'xbox', Ubisoft: 'ubisoft' })[game.launcher] || null;
    return { prefill: {
      title: game.name, poster: game.poster?.url || game.poster || null,
      // The wide banner was fetched with the poster when the library filled in,
      // so the report header can have it without asking the network again - and
      // a game found in a folder has no store id to look one up with anyway.
      hero: heroFor(dir),
      // The colour of the two pictures this dialog is about to show. Without
      // this it fell back to a hash of the title, which is why a red game came
      // out green.
      palette: paletteOfAll(heroFor(dir), game.poster?.url || game.poster || null),
      kicker: kickerFor(dir, game),
      game: { store, storeId: store && game.id ? String(game.id) : null, title: game.name,
        exe: scan.chosen?.rel ? path.basename(scan.chosen.rel) : null },
      route: ['feeder', 'renodx', 'optiscaler'].includes(route) ? route : null,
      api: communityApi(target),
      gpu: gpu.name || null, driver: gpu.driver || null,
      cpu: os.cpus()?.[0]?.model || null,
      os: `${process.platform} ${os.release()}`, app: app.getVersion()
    } };
  });
});

ipcMain.handle('set-close-to-tray', (_event, enabled) => {
  const state = loadState();
  state.closeToTray = enabled === true;
  saveState(state);
  if (state.closeToTray) ensureTray();
  // Turning it off leaves the icon alone: the window is open, and taking the
  // tray away under a menu somebody may have just opened is worse than a
  // harmless icon that does the same two things.
  return state.closeToTray;
});

ipcMain.handle('set-tray-labels', (_event, labels) => {
  if (labels && typeof labels.show === 'string' && typeof labels.quit === 'string') {
    trayLabels = { show: labels.show, quit: labels.quit };
    buildTrayMenu();
  }
  return true;
});

ipcMain.handle('set-group-games-by-store', (_event, enabled) => {
  const state = loadState();
  state.groupGamesByStore = enabled === true;
  saveState(state);
  return state.groupGamesByStore;
});

ipcMain.handle('set-auto-scan-drives', (_event, enabled) => {
  const state = loadState();
  state.autoScanDrives = enabled === true;
  if (!state.autoScanDrives) lastRoots = [];
  saveState(state);
  return state.autoScanDrives;
});

ipcMain.handle('set-auto-check-updates', (_event, enabled) => {
  const state = loadState();
  state.autoCheckUpdates = enabled === true;
  saveState(state);
  return state.autoCheckUpdates;
});

ipcMain.handle('updater-status', () => updaterState);

ipcMain.handle('updater-check', async () => {
  if (updaterState.status === 'downloading') {
    return { ok: true, status: updaterState.status, ...updaterState.info };
  }
  broadcastUpdater('checking');
  try {
    const curVer = app.getVersion ? app.getVersion() : require('./package.json').version;
    const res = await updater.checkForUpdates({
      currentVersion: curVer,
      isPortable: isPortableRunning()
    });
    if (res.available) {
      broadcastUpdater('available', { info: res, error: null });
    } else {
      broadcastUpdater('not-available', { info: res, error: null });
    }
    return { ok: true, ...res };
  } catch (err) {
    broadcastUpdater('error', { error: err.message });
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('updater-download', async () => {
  if (!updaterState.info?.asset) {
    return { ok: false, error: 'No update asset available' };
  }
  if (updaterState.status === 'downloading') {
    return { ok: true, downloading: true };
  }

  downloadAbortController = new AbortController();
  broadcastUpdater('downloading', {
    progress: { percent: 0, transferred: 0, total: updaterState.info.asset.size || 0, speed: 0 }
  });

  const updatesDir = path.join(app.getPath('userData'), 'updates');
  try {
    const res = await updater.downloadUpdate({
      asset: updaterState.info.asset,
      updatesDir,
      abortSignal: downloadAbortController.signal,
      onProgress: (p) => {
        updaterState.progress = p;
        if (win && !win.isDestroyed()) {
          win.webContents.send('updater-progress', p);
        }
      }
    });
    broadcastUpdater('downloaded', { downloadedFile: res.filePath, error: null });
    return { ok: true, filePath: res.filePath };
  } catch (err) {
    if (downloadAbortController?.signal?.aborted) {
      broadcastUpdater('available', { error: 'Download cancelled' });
      return { ok: false, cancelled: true };
    }
    broadcastUpdater('error', { error: err.message });
    return { ok: false, error: err.message };
  } finally {
    downloadAbortController = null;
  }
});

ipcMain.handle('updater-cancel', () => {
  if (downloadAbortController) {
    downloadAbortController.abort();
    downloadAbortController = null;
    return { ok: true };
  }
  return { ok: false };
});

ipcMain.handle('updater-install', () => {
  if (!updaterState.downloadedFile) {
    return { ok: false, error: 'No downloaded update found' };
  }
  try {
    broadcastUpdater('installing');
    const res = updater.applyUpdate({
      filePath: updaterState.downloadedFile,
      isPortable: isPortableRunning(),
      isPackaged: app.isPackaged,
      quitFn: () => app.quit(),
      showInFolderFn: (f) => shell.showItemInFolder(f)
    });
    return res;
  } catch (err) {
    broadcastUpdater('error', { error: err.message });
    return { ok: false, error: err.message };
  }
});

// Used when a folder arrives by drop rather than through the picker.
ipcMain.handle('add-game-path', (_event, dir) => {
  const state = loadState();
  if (fs.existsSync(dir) && !state.manual.includes(dir)) {
    state.manual.push(dir);
    saveState(state);
  }
  return dir;
});

// The roots found on the drives, kept so Settings can show what was searched
// without paying for the sweep twice.
let lastRoots = [];
let lastGames = [];

ipcMain.handle('library', () => {
  const state = loadState();
  const found = discover(
    state.folders,
    state.autoScanDrives === true,
    state.excludedRoots || []
  );
  lastRoots = found.roots;
  const games = found.games.concat(
    state.manual
      .filter((dir) => fs.existsSync(dir))
      .map((dir) => ({ launcher: 'Added by hand', id: null, name: path.basename(dir), dir, poster: null }))
  );

  const hidden = new Set(state.hidden.map((d) => d.toLowerCase()));
  lastGames = dedupe(games)
    .filter((g) => !hidden.has(path.resolve(g.dir).toLowerCase()))
    .map((g) => ({
      key: keyFor(g.dir),
      launcher: g.launcher,
      // Steam records the app id, so its games never need a name search.
      appid: g.launcher === 'Steam' ? g.id : null,
      name: g.name,
      dir: g.dir,
      poster: posterUrl(g, state),
      // Whatever the last scan found, so cards can render before rescanning.
      cached: state.scans[keyFor(g.dir)] && state.scans[keyFor(g.dir)].rules === SCAN_RULES
        ? state.scans[keyFor(g.dir)]
        : null
    }));
  return lastGames;
});

// Scanning 37 folders takes seconds, so each card asks for its own result and
// the grid fills in as they land.
ipcMain.handle('scan', async (_event, dir) => {
  const state = loadState();
  const key = keyFor(dir);
  try {
    const scan = await scanGame(dir);
    const dlss = scan.primaryDlss;
    const result = {
      dir,
      ok: Boolean(scan.chosen),
      installable: installRoutes.routesFor(scan.chosen).length > 0,
      api: scan.chosen ? scan.chosen.apiLabel : null,
      bitness: scan.chosen ? scan.chosen.bitness : null,
      dx12: Boolean(scan.chosen && scan.chosen.apiLabel === 'DirectX 12'),
      exe: scan.chosen ? scan.chosen.rel : null,
      reason: scan.emptyReason || null,
      dlss: dlss ? dlss.version : null,
      hasDlss: Boolean(dlss),
      addon: Boolean(scan.addonPresent),
      optiscaler: Boolean(scan.install?.optiscaler?.installed),
      reshade: scan.reshade.installed ? scan.reshade.version : null,
      scannedAt: Date.now(),
      rules: SCAN_RULES
    };
    state.scans[key] = result;
    saveState(state);
    return result;
  } catch (err) {
    return { ok: false, api: null, dx12: false, reason: 'error', error: err.message };
  }
});

// ---------- editing the library ----------

ipcMain.handle('add-folder', async () => {
  const res = await dialog.showOpenDialog(win, { properties: ['openDirectory'], title: 'Scan this folder for games' });
  if (res.canceled) return null;
  const state = loadState();
  if (!state.folders.includes(res.filePaths[0])) state.folders.push(res.filePaths[0]);
  state.excludedRoots = (state.excludedRoots || []).filter(
    (root) => path.resolve(root).toLowerCase() !== path.resolve(res.filePaths[0]).toLowerCase()
  );
  saveState(state);
  return res.filePaths[0];
});

ipcMain.handle('remove-folder', (_event, dir) => {
  const state = loadState();
  state.folders = state.folders.filter((f) => f !== dir);
  state.excludedRoots = state.excludedRoots || [];
  if (!state.excludedRoots.some((root) => path.resolve(root).toLowerCase() === path.resolve(dir).toLowerCase())) {
    state.excludedRoots.push(dir);
  }
  lastRoots = lastRoots.filter(
    (root) => path.resolve(root).toLowerCase() !== path.resolve(dir).toLowerCase()
  );
  saveState(state);
  return true;
});

// Auto-discovered roots used to be display-only, so unwanted locations came
// back on every scan. Excluding one removes only its library entries; no file
// or folder on disk is changed.
ipcMain.handle('exclude-root', (_event, dir) => {
  const state = loadState();
  state.excludedRoots = state.excludedRoots || [];
  if (!state.excludedRoots.some((root) => path.resolve(root).toLowerCase() === path.resolve(dir).toLowerCase())) {
    state.excludedRoots.push(dir);
  }
  state.folders = state.folders.filter(
    (folder) => path.resolve(folder).toLowerCase() !== path.resolve(dir).toLowerCase()
  );
  lastRoots = lastRoots.filter(
    (root) => path.resolve(root).toLowerCase() !== path.resolve(dir).toLowerCase()
  );
  saveState(state);
  return true;
});

ipcMain.handle('add-game', async () => {
  const res = await dialog.showOpenDialog(win, { properties: ['openDirectory'], title: 'Add one game' });
  if (res.canceled) return null;
  const state = loadState();
  if (!state.manual.includes(res.filePaths[0])) state.manual.push(res.filePaths[0]);
  saveState(state);
  return res.filePaths[0];
});

ipcMain.handle('set-poster', async (_event, dir) => {
  const res = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    title: 'Pick a poster',
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
  });
  if (res.canceled) return null;

  // Copied into the app's own folder, keyed by path, so renaming the game
  // folder is the only thing that loses it.
  const state = loadState();
  fs.mkdirSync(posterDir(), { recursive: true });
  const dest = path.join(posterDir(), keyFor(dir) + path.extname(res.filePaths[0]));
  fs.copyFileSync(res.filePaths[0], dest);
  state.posters[keyFor(dir)] = dest;
  saveState(state);
  return pathToFileURL(dest).href;
});

ipcMain.handle('hide', (_event, dir) => {
  const state = loadState();
  if (!state.hidden.includes(dir)) state.hidden.push(dir);
  saveState(state);
  return true;
});

// Hiding a game only takes it out of the list, so it has to be possible to
// put it back. Without this the only way out was resetting the whole library.
ipcMain.handle('unhide', (_event, dir) => {
  const state = loadState();
  const wanted = path.resolve(String(dir)).toLowerCase();
  state.hidden = (state.hidden || []).filter((item) => path.resolve(item).toLowerCase() !== wanted);
  saveState(state);
  return true;
});

ipcMain.handle('reset', () => {
  try { fs.unlinkSync(stateFile()); } catch {}
  return true;
});

ipcMain.handle('open', (_event, dir) => shell.openPath(dir));
ipcMain.handle('open-project', async (_event, destination) => {
  const url = projectUrl(destination);
  if (!url) return false;
  try { await shell.openExternal(url); return true; } catch { return false; }
});

// The home page lists the last games touched, newest first.
ipcMain.handle('touch', (_event, dir) => {
  const state = loadState();
  state.recents = [{ dir, at: Date.now() }]
    .concat((state.recents || []).filter((r) => r.dir !== dir))
    .slice(0, 12);
  saveState(state);
  return state.recents;
});

// Before anything has been installed in this session, the row is filled from
// the backup manifests already sitting in the game folders - real installs
// with real dates rather than an empty shelf.
function recentsFromManifests(state) {
  const latest = new Map();
  for (const row of fromManifests(knownFolders(state, lastGames))) {
    const key = keyFor(row.dir);
    const at = Date.parse(row.date);
    if (!latest.has(key) || latest.get(key).at < at) latest.set(key, { dir: row.dir, at });
  }
  return [...latest.values()].sort((a, b) => b.at - a.at).slice(0, 12);
}

ipcMain.handle('recents', () => {
  const state = loadState();
  const excluded = state.excludedRoots || [];
  const manual = new Set((state.manual || []).map((dir) => path.resolve(dir).toLowerCase()));
  const saved = (state.recents || []).filter((r) =>
    fs.existsSync(r.dir) && (
      manual.has(path.resolve(r.dir).toLowerCase()) || !excluded.some((root) => isInside(r.dir, root))
    )
  );
  return saved.length ? saved : recentsFromManifests(state);
});

// ---------- artwork ----------

// Which builds are switched on. Any number can be, because ReShade loads every
// .addon64 in the folder. `state.addon` was a single path in earlier versions.
function enabledAddons() {
  const state = loadState();
  const list = state.addons || (state.addon ? [state.addon] : []);
  return list.filter((f) => fs.existsSync(f) && describe(f, null));
}

// The one that takes the base's place, if any: same file name means the same
// file on disk, so it lands on top rather than beside it.
function replacementAddon() {
  const p = payload(true);
  if (!p) return null;
  const base = path.basename(p.source.addon).toLowerCase();
  return enabledAddons().find((f) => path.basename(f).toLowerCase() === base) || null;
}

// The rest ride along with the base. Two builds sharing a file name cannot both
// be written, so the first switched on keeps the name.
function companionAddons() {
  const p = payload(true);
  if (!p) return [];
  const taken = new Set([path.basename(p.source.addon).toLowerCase()]);
  const out = [];
  for (const f of enabledAddons()) {
    const name = path.basename(f).toLowerCase();
    if (taken.has(name)) continue;
    taken.add(name);
    out.push(f);
  }
  return out;
}

// apply.js keeps its own copy of this private to the module, and the same
// thing is needed here for the second add-on placed beside it.
function enableAddon(exeDir, addonName) {
  const ini = path.join(exeDir, 'ReShade.ini');
  if (!fs.existsSync(ini)) return;
  const text = fs.readFileSync(ini, 'utf8');
  const stem = addonName.replace(/\.addon(64)?$/i, '');
  const match = text.match(/^DisabledAddons=(.*)$/m);
  if (match && match[1].toLowerCase().includes(stem.toLowerCase())) {
    fs.writeFileSync(ini, text.replace(/^DisabledAddons=.*$/m, 'DisabledAddons='), 'utf8');
  }
}

ipcMain.handle('window', (_event, action) => {
  if (!win) return;
  if (action === 'minimize') win.minimize();
  else if (action === 'close') win.close();
  else if (action === 'maximize') win.isMaximized() ? win.unmaximize() : win.maximize();
});

// #229, #258, #104: the driver warning was a line in the install log, and
// every line after it said "added" and "done". Three people spent days on a
// driver the app had already named. It is a question now - answered once per
// driver version, never a block: the install is still theirs to make.
ipcMain.handle('driver-neural-fault', async () => {
  const rows = await guards.gpuInfo();
  if (!rows || !guards.driverNeuralFault(rows)) return { fault: false };
  const names = guards.driverNames(rows);
  const state = loadState();
  return { fault: true, names, acknowledged: (state.driverAcknowledged || []).includes(names) };
});

ipcMain.handle('acknowledge-driver', (_event, names) => {
  if (typeof names !== 'string' || !names) return false;
  const state = loadState();
  const seen = state.driverAcknowledged || [];
  // Keyed by the exact adapter-and-version string, so a driver change asks
  // again and a reinstall of the same one does not.
  if (!seen.includes(names)) { state.driverAcknowledged = [...seen, names].slice(-8); saveState(state); }
  return true;
});

// Which OptiScaler build a game uses, and the ones it may choose between. Only
// names from the pinned list are accepted - the folder is still hash-verified
// and still puts back anything swapped into it by hand (#191).
ipcMain.handle('optiscaler-builds', (_event, dir) => ({
  builds: optiscaler.RELEASES.map((r) => r.version),
  current: (loadState().optiscalerVersion || {})[path.resolve(String(dir || '')).toLowerCase()] || optiscaler.RELEASE.version
}));

ipcMain.handle('set-optiscaler-build', (_event, dir, version) => {
  if (typeof dir !== 'string' || !dir) return null;
  const state = loadState();
  const key = path.resolve(dir).toLowerCase();
  const chosen = optiscaler.releaseFor(version).version;
  const map = { ...(state.optiscalerVersion || {}) };
  if (chosen === optiscaler.RELEASE.version) delete map[key]; else map[key] = chosen;
  state.optiscalerVersion = map;
  saveState(state);
  return chosen;
});

// Whether this game uses the multipass consumer, and whether this build even
// carries it - a payload assembled without the file simply does not offer it.
ipcMain.handle('multipass-state', (_event, dir) => {
  const file = payload()?.source?.feeder?.multipassAddon;
  // Held back deliberately. The Feeder is the only route that installs a
  // neural consumer, and it recognises exactly three names - the glob is
  // `renodx-dlss5*.addon64`, plus deep-fried-chicken and alexs-toolkit. The
  // DLSS Tool ships as `renodx-dlss.addon64`, without the 5, so the Feeder
  // would load it and then report no consumer at all. Offering the choice here
  // would only produce broken installs; it belongs as its own route, which
  // does not use the Feeder. #251.
  const available = false && Boolean(file) && fs.existsSync(file);
  const key = path.resolve(String(dir || '')).toLowerCase();
  return { available, on: (loadState().multipassGames || []).includes(key) };
});

ipcMain.handle('set-multipass', (_event, dir, on) => {
  if (typeof dir !== 'string' || !dir) return false;
  const state = loadState();
  const key = path.resolve(dir).toLowerCase();
  const list = (state.multipassGames || []).filter((g) => g !== key);
  if (on === true) list.push(key);
  state.multipassGames = list;
  saveState(state);
  return on === true;
});

ipcMain.handle('addons', () => addonLibrary());

// Switching one on leaves the others alone. The single exception is a build
// that would be written under a name another switched-on build already claims:
// only one file can hold that name, so the older choice steps aside.
ipcMain.handle('addon-toggle', (_event, file, on) => {
  const state = loadState();
  let list = state.addons || (state.addon ? [state.addon] : []);
  delete state.addon;

  if (!on) {
    list = list.filter((f) => f !== file);
  } else {
    const row = addonLibrary().find((r) => r.path === file);
    if (!row) return { ok: false, message: 'That build is no longer there' };
    const name = path.basename(file).toLowerCase();
    const clash = list.find((f) => f !== file && path.basename(f).toLowerCase() === name);
    list = list.filter((f) => f !== clash && f !== file);
    list.push(file);
    if (clash) {
      state.addons = list; saveState(state);
      return { ok: true, replaced: path.basename(clash) };
    }
  }
  state.addons = list;
  saveState(state);
  return { ok: true };
});

// Picking only reports what was chosen; nothing is stored until the dialog in
// the window is filled in and confirmed.
ipcMain.handle('addon-pick', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: 'Add an add-on build',
    filters: [{ name: 'ReShade add-on', extensions: ['addon64', 'addon'] }],
    properties: ['openFile']
  });
  if (res.canceled || !res.filePaths.length) return null;

  const file = res.filePaths[0];
  const row = describe(file, null);
  if (!row) return { error: 'unreadable' };
  return {
    path: file,
    file: row.file,
    size: row.size,
    version: row.version,
    // The folder is a better first guess than the file name, which is the same
    // for every build.
    suggestedName: path.basename(path.dirname(file))
  };
});

ipcMain.handle('addon-save', (_event, entry) => {
  const state = loadState();
  const list = (state.addonFiles || []).map((e) => (typeof e === 'string' ? { path: e } : e));
  state.addonFiles = [
    ...list.filter((e) => e.path !== entry.path),
    {
      path: entry.path,
      name: (entry.name || '').trim() || null,
      tag: (entry.tag || '').trim() || null,
      notes: String(entry.description || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
    }
  ];
  saveState(state);
  return true;
});

ipcMain.handle('addon-remove', (_event, file) => {
  const state = loadState();
  const list = (state.addonFiles || []).map((e) => (typeof e === 'string' ? { path: e } : e));
  state.addonFiles = list.filter((e) => e.path !== file);
  // Removing the one that was switched on falls back to the built-in add-on.
  state.addons = (state.addons || []).filter((f) => f !== file);
  if (state.addon === file) delete state.addon;
  saveState(state);
  return true;
});

ipcMain.handle('art-status', () => ({ available: art.available() }));

ipcMain.handle('community-palette', (_event, pixels) => {
  if (!Array.isArray(pixels) || pixels.length !== 12 * 12 * 4 ||
      pixels.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return null;
  return paletteFromPixels(Uint8Array.from(pixels), 'rgba');
});

ipcMain.handle('community-palette-merge', (_event, palettes) =>
  mergePalettes(Array.isArray(palettes) ? palettes.slice(0, 2) : []));

// Bumped whenever the art picked for a game could change, so folders cached
// under the old rule fetch again instead of keeping a bad banner forever.
const ART_RULES = 4;

// A community card is a game somebody else has, so there is no folder to key
// its artwork by - but a card keyed "steam:<appid>" carries the appid itself,
// which is the best lookup there is. Everything else falls back to the title.
//
// The image is downloaded here and handed over as a file:// URL, because the
// renderer's policy allows no remote images at all - and should not.
const onDisk = url => {
  if (typeof url !== 'string' || !url.startsWith('file:')) return false;
  try { return fs.existsSync(fileURLToPath(url)); } catch { return false; }
};
// The colour a card is lit by. Electron already decodes every picture format
// the art comes in, so the image is shrunk to a thumbnail and read from that -
// twelve by twelve is enough to say what a poster is mostly made of, and small
// enough that doing it is free.
function paletteOf(fileUrl) {
if (!fileUrl) return null;
  try {
    const image = nativeImage.createFromPath(fileURLToPath(fileUrl));
    if (image.isEmpty()) return null;
    const small = image.resize({ width: 12, height: 12, quality: 'good' });
    return paletteFromPixels(small.toBitmap(), 'bgra');
  } catch { return null; }
}

// The banner and the poster are both on screen, so both decide.
const paletteOfAll = (...files) => mergePalettes(files.map(paletteOf));

ipcMain.handle('community-art', async (_event, key, title) => {
  if (typeof key !== 'string' || !/^[a-z]+:[A-Za-z0-9._-]{1,64}$/.test(key)) return { none: true };
  const state = loadState();
  const cacheKey = `community-w-${crypto.createHash('sha256').update(key).digest('hex').slice(0, 24)}`;
  // A remembered picture is only worth serving while the file is still there.
  // Antivirus quarantine, a cleanup tool or a cleared profile all take these
  // away, and a record pointing at a missing file renders as a broken image
  // forever - the cache has to notice rather than insist.
  const cached = state.art && state.art[cacheKey];
  if (cached && (cached.none || onDisk(cached.cover))) {
    if (cached.none || cached.palette !== undefined) return cached;
    // Remembered before there was such a thing as a palette: read one now
    // rather than leaving the card grey until the art is downloaded again.
    cached.palette = paletteOfAll(cached.cover, cached.poster);
    saveState(state);
    return cached;
  }

  const [kind, id] = key.split(':');
  try {
    const hit = await art.look(String(title || '').slice(0, 120), kind === 'steam' ? id : null);
    if (!hit) {
      // Remember the miss too: a game with no art must not be looked up again
      // on every visit to the page.
      state.art = state.art || {};
      state.art[cacheKey] = { none: true, fetchedAt: Date.now() };
      saveState(state);
      return { none: true };
    }
    const dest = path.join(app.getPath('userData'), 'art');
    // The card is landscape, so this wants the wide art. The tall 600x900
    // poster would be cropped to a band across the middle of the picture.
    let cover = null;
    for (const url of [hit.heroUrl, hit.heroFallbackUrl, hit.coverUrl]) {
      if (!url) continue;
      try { cover = pathToFileURL(await art.download(url, path.join(dest, cacheKey + '-wide.jpg'))).href; break; }
      catch { /* try the next shape */ }
    }
    // The opened card shows both: the wide art behind its header, and the tall
    // poster beside the title the way a store page does.
    let poster = null;
    try { poster = pathToFileURL(await art.download(hit.coverUrl, path.join(dest, cacheKey + '-tall.jpg'))).href; }
    catch { poster = null; }
    // The wide art is what the header shows, so it decides; the poster is
    // the fallback for a game whose banner is a black-and-white logo.
    const record = { cover, poster, palette: paletteOfAll(cover, poster), fetchedAt: Date.now() };
    state.art = state.art || {};
    state.art[cacheKey] = record;
    saveState(state);
    return record;
  } catch {
    return { none: true };
  }
});

ipcMain.handle('art-fetch', async (_event, dir, name, appid) => {
  const state = loadState();
  const key = keyFor(dir);
  const cached = state.art && state.art[key];
  if (cached && cached.rules === ART_RULES) return cached;

  try {
    const hit = await art.look(name, appid);
    if (!hit) return { none: true };

    const dest = path.join(app.getPath('userData'), 'art');
    const record = { ...hit, cover: null, hero: null, rules: ART_RULES, fetchedAt: Date.now() };
    const grab = async (url, suffix) => {
      try { return pathToFileURL(await art.download(url, path.join(dest, key + suffix))).href; }
      catch { return null; }
    };
    record.cover = await grab(hit.coverUrl, '-cover.jpg');
    // A few older apps have no hero image; the store header is the same shape.
    record.hero = await grab(hit.heroUrl, '-hero.jpg');
    if (!record.hero && hit.heroFallbackUrl) record.hero = await grab(hit.heroFallbackUrl, '-hero.jpg');

    state.art = state.art || {};
    state.art[key] = record;
    saveState(state);
    return record;
  } catch (err) {
    return { error: err.message };
  }
});

// ---------- installing ----------

// Releases move quickly and nothing here updates itself, so someone can sit
// on a build for weeks without knowing. One lookup per launch, no identifiers
// sent, no download started: the answer is a version number and a link the
// person may click. Any failure is silence - this must never delay a start.
let updateAnswer = null;
// Nothing wrote the app's own failures down anywhere, so a crash left the
// person with nothing to report but a description. Keep the last few in
// userData, bounded, and let the diagnostics file carry them.
function recordCrash(kind, error) {
  try {
    const file = path.join(app.getPath('userData'), 'crash.log');
    const entry = `[${new Date().toISOString()}] ${kind}: ${error && error.stack ? error.stack : String(error)}\n\n`;
    let previous = '';
    try { previous = fs.readFileSync(file, 'utf8'); } catch { /* first one */ }
    // Newest last, oldest dropped: 256 KB is plenty and cannot grow unbounded.
    const combined = (previous + entry).slice(-256 * 1024);
    fs.writeFileSync(file, combined, 'utf8');
  } catch { /* a failure to record a failure is not worth a second one */ }
}
// Guarded because main.js is also evaluated in test sandboxes that are not a
// real process; a module should not install global handlers regardless.
if (typeof process !== 'undefined' && typeof process.on === 'function') {
  process.on('uncaughtException', (error) => recordCrash('uncaughtException', error));
  process.on('unhandledRejection', (reason) => recordCrash('unhandledRejection', reason));
}

const releaseTag = /^v?(\d+)\.(\d+)\.(\d+)/;
function newerRelease(current, latest) {
  const a = releaseTag.exec(current), b = releaseTag.exec(latest);
  if (!a || !b) return false;
  for (let i = 1; i <= 3; i++) {
    if (Number(b[i]) > Number(a[i])) return true;
    if (Number(b[i]) < Number(a[i])) return false;
  }
  return false;
}
ipcMain.handle('update-check', async () => {
  if (updateAnswer) return updateAnswer;
  const current = app.getVersion();
  try {
    const response = await fetch('https://api.github.com/repos/rakanki911/DLSS5-Swapper/releases/latest', {
      headers: { 'User-Agent': `DLSS5-Swapper/${current}`, Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw Error(String(response.status));
    const release = await response.json();
    const latest = String(release.tag_name || '').replace(/^v/, '');
    updateAnswer = { current, latest, newer: newerRelease(current, latest) };
  } catch {
    // Offline, rate-limited or blocked: say nothing rather than worry anyone.
    updateAnswer = { current, latest: null, newer: false };
  }
  return updateAnswer;
});
ipcMain.handle('details', async (_event, dir) => {
  const detailsPayload = payload();
  const scan = await scanGame(dir);
  // Opening a game is a chance to undo the read-only ReShade.ini an install
  // from before 2.2.2 left behind - the banner on #155 outlives an app update
  // because only an install used to clear it.
  if (scan.chosen) {
    try {
      const cleared = await makeReShadeConfigWritable(path.dirname(scan.chosen.path));
      if (cleared.length) console.log('Cleared read-only:', cleared.join(', '), 'in', dir);
    } catch { /* a game folder we cannot touch is not a reason to fail here */ }
  }
  const state = loadState();
  const hasNativeDlss = installRoutes.nativeDlssPresent(scan);
  const files = [...scan.dlssFiles, ...scan.streamlineFiles]
    .map((f) => ({ rel: f.rel, name: f.name, version: f.version }));
  return {
    ok: Boolean(scan.chosen),
    reason: scan.chosen ? null : (scan.emptyReason || null),
    exe: scan.chosen ? scan.chosen.rel : null,
    exePath: scan.chosen ? scan.chosen.path : null,
    api: scan.chosen ? scan.chosen.apiLabel : null,
    apiKey: scan.chosen ? scan.chosen.api : null,
    bitness: scan.chosen ? scan.chosen.bitness : null,
    via: scan.chosen ? scan.chosen.via : null,
    emulator: scan.emulator,
    installedRoute: scan.install && scan.install.route,
    antiCheatWarning: compatibility.hasAntiCheat(dir, scan.chosen?.path),
    installedApi: scan.install && scan.install.api,
    installedExe: scan.install && scan.install.exe,
    previousReShadeRoute: scan.install && scan.install.previousReShadeRoute,
    optiscaler: scan.install && scan.install.optiscaler,
    recommendedRoute: installRoutes.recommendedRoute(scan),
    exes: scan.exeCandidates.map((e) => ({
      rel: e.rel, path: e.path, apiLabel: e.apiLabel, api: e.api,
      bitness: e.bitness, size: e.size, via: e.via,
      emulator: e.emulator,
      installIssue: compatibility.targetIssue(dir, e.path),
      antiCheatWarning: compatibility.hasAntiCheat(dir, e.path),
      hasNativeDlss,
      apiOverride: apiPreference(state, dir, e.path),
      apiChoices: e.apiChoices || [{ api: e.api, label: e.apiLabel }],
      routes: installRoutes.routesFor({ ...e, hasNativeDlss })
    })),
    files,
    currentDlss: scan.primaryDlss ? {
      rel: scan.primaryDlss.rel,
      version: scan.primaryDlss.version,
      bitness: scan.primaryDlss.bitness
    } : null,
    addon: scan.addonPresent,
    reshade: scan.reshade,
    hasBackup: scan.hasBackup || fs.existsSync(journal.pendingPath(dir)),
    newDlss: detailsPayload && detailsPayload.source ? detailsPayload.source.dlssVersion : null
  };
});

let mutationBusy = false;
ipcMain.handle('set-api-override', async (_event, dir, exePath, value) => {
  if (mutationBusy) return { ok: false, code: 'errJobBusy' };
  if (!renderingApi.valid(value) || typeof dir !== 'string' || !path.isAbsolute(dir) || typeof exePath !== 'string') {
    return { ok: false, code: 'errApiChoice' };
  }
  const scan = await scanGame(dir);
  if (mutationBusy) return { ok: false, code: 'errJobBusy' };
  if (!scan.exeCandidates.some(exe => exe.path === exePath)) return { ok: false, code: 'errApiChoice' };
  const state = loadState();
  state.apiOverrides = state.apiOverrides && typeof state.apiOverrides === 'object' && !Array.isArray(state.apiOverrides)
    ? state.apiOverrides : {};
  const key = apiPreferenceKey(dir, exePath);
  if (value === 'auto') delete state.apiOverrides[key];
  else state.apiOverrides[key] = value;
  return saveState(state) ? { ok: true } : { ok: false, code: 'errApiSave' };
});
async function exclusiveMutation(work) {
  if (mutationBusy) return { ok: false, code: 'errJobBusy' };
  mutationBusy = true;
  try { return await work(); }
  catch (err) { return { ok: false, code: err.code, message: err.message }; }
  finally { mutationBusy = false; }
}

ipcMain.handle('install', (event, dir, exePath, requestedRoute, requestedApi) => exclusiveMutation(async () => {
  const p = payload();
  if (!p) return { ok: false, ...payloadMissing() };
  const scan = await scanGame(dir);
  if (!scan.chosen) return { ok: false, message: 'No game executable found' };

  // Honour the sheet's choice, but only if it is one of the candidates we
  // actually found - never patch a path the renderer made up.
  const detected = scan.exeCandidates.find((e) => e.path === exePath) || scan.chosen;
  const selection = requestedApi ?? apiPreference(loadState(), dir, detected.path);
  const target = renderingApi.effective(detected, selection);
  compatibility.assertSafeTarget(dir, target.path);
  target.hasNativeDlss = installRoutes.nativeDlssPresent(scan);
  const api = target.api;
  const availableRoutes = installRoutes.routesFor(target, api);
  if (requestedRoute === 'optiscaler' && !availableRoutes.includes('optiscaler')) {
    return { ok: false, code: installRoutes.optiReason(target, api) || 'optiUnsupported' };
  }
  if (!availableRoutes.length) return { ok: false, code: 'unsupportedRendererHint', message: 'This rendering API is not supported. Select the game’s DirectX 11 mode where available.' };
  const recommendedRoute = installRoutes.recommendedRoute(scan, target);
  const route = availableRoutes.includes(requestedRoute) ? requestedRoute
    : (availableRoutes.includes(recommendedRoute) ? recommendedRoute : availableRoutes[0]);

  // ReShade Setup is a Windows executable. On Linux, support Windows games
  // launched with Steam Play by using their existing Proton prefix; native
  // Linux games do not load the Windows DLSS/ReShade payload.
  const protonGame = process.platform === 'linux'
    ? steam().find((game) => path.resolve(game.dir) === path.resolve(dir))
    : null;
  const proton = contextForSteamGame(protonGame);
  if (process.platform === 'linux' && !proton) {
    return { ok: false, code: 'errProtonRequired', message: 'This installer supports Windows games launched through Steam Proton. Launch the game once with Proton, then try again.' };
  }
  if (process.platform === 'linux' && api === 'vulkan') {
    return { ok: false, code: 'errLinuxVulkanUnsupported', message: 'The Vulkan Feeder route needs a host Vulkan layer and is not supported on Linux yet. Select a DirectX renderer in the game.' };
  }

  const send = (e) => event.sender.send('job', e);
  await guards.assertGameClosed(dir, target.path);
  if (fs.existsSync(journal.pendingPath(dir))) return { ok: false, code: 'errBackendRecovery' };
  const old = backends.readManifest(dir);
  const changed = old && (old.route !== route || old.game.api !== api || old.game.exe.toLowerCase() !== target.rel.toLowerCase());
  if (changed && (old.game.api === 'vulkan' || api === 'vulkan')) return { ok: false, code: 'errBackendVulkanSwitch' };
  let antiCheatAcknowledged = false;
  if (compatibility.hasAntiCheat(dir, target.path)) {
    const answer = await dialog.showMessageBox(win, antiCheatWarning.dialogOptions(loadState().lang, dir, target.path));
    if (answer.response !== 1) return { ok: false, cancelled: true };
    antiCheatAcknowledged = true;
    send({ code: 'antiCheatRiskAccepted', params: {} });
  }
  // The ReShade and Feeder routes both drive the RenoDX neural consumer, which
  // upstream has measured faulting inside NVIDIA's runtime on a known driver
  // range. Say so before the work starts; it never stops the install.
  if (route === 'native' || route === 'feeder') {
    // Advice only: nothing about reading the driver may decide whether an
    // install runs.
    try {
      const rows = await guards.gpuInfo();
      if (guards.driverNeuralFault(rows)) send({ code: 'driverNeuralFault', params: { gpu: guards.driverNames(rows) } });
    } catch {}
  }

  let optiRoot = null;
  if (route === 'optiscaler') {
    optiscaler.checkConflicts(dir, target.path, old, api);
    if (api === 'vulkan' && await vulkanLayer.existing(vulkanLayer.defaultRunner)) return { ok: false, code: 'errOptiVulkanLayer' };
    const gpu = await guards.gpuInfo();
    // Neither the card nor the driver is refused outright any more. Upstream
    // 0.2.0 says plainly that architectures older than Blackwell work with a
    // modded nvngx_dlssnr.dll, which the person supplies themselves - so this
    // is their decision to make, with both facts in front of them.
    const oldCard = gpu ? !guards.gpuModelSupported(gpu) : false;
    const oldDriver = gpu ? !guards.driverSupported(gpu) : false;
    const confirmation = await dialog.showMessageBox(win, {
      type: 'warning', title: 'OptiScaler DLSS-NR',
      message: featureText('optiConfirm'),
      detail: [gpu ? gpu.map(g => `${g.name} — ${g.driver}`).join('\n') : featureText('errOptiHardware'),
        oldCard ? featureText('optiCardOld') : null,
        oldDriver ? featureText('optiDriverOld') : null,
        featureText('optiHint'), featureText('optiBridgeHint'), featureText('backendHint')].filter(Boolean).join('\n\n'),
      buttons: [featureText('installOpti'), featureText('cancel')], defaultId: 1, cancelId: 1
    });
    if (confirmation.response !== 0) return { ok: false, cancelled: true };
    const missing = missingVCRuntime(64, path.dirname(target.path), process.env.SystemRoot, ['msvcp140_atomic_wait.dll']);
    if (missing.length) return { ok: false, code: 'runtimeRequiredHint', message: missing.join(', ') };
    send({ code: 'optiDownloading', params: {} });
    // A game may name an older pinned build. #238: No Man's Sky runs on
    // 0.1.1.5 and crashes on 0.2.0-patch1, and until now the only way back was
    // to keep an old copy of the whole app.
    const wanted = (loadState().optiscalerVersion || {})[path.resolve(dir).toLowerCase()];
    const release = optiscaler.releaseFor(wanted);
    try { optiRoot = await optiscaler.ensureOptiScaler(app.getPath('userData'), release.version); }
    catch (err) { return { ok: false, code: componentCode(err, 'errOptiDownload'), message: err.message }; }
    send({ code: 'optiVerified', params: { version: release.version } });
  }

  // Check before restoring or touching the game: these DLLs are imported by
  // Feeder and its helper. Never report a working installation if absent.
  if (route === 'feeder') {
    if (!p.source.feeder || !(target.bitness === 32 ? p.source.feeder.ok32 : p.source.feeder.ok64)) {
      return { ok: false, message: 'Feeder payload is incomplete or from mixed releases. Reinstall the updated Swapper package.' };
    }
    const checks = [[target.bitness, path.dirname(target.path)]];
    if (target.bitness === 32) checks.push([64, path.join(path.dirname(target.path), 'host64')]);
    for (const [bits, folder] of checks) {
      const missing = missingVCRuntime(bits, folder);
      if (missing.length) {
        const response = await dialog.showMessageBox(win, {
          type: 'warning', title: 'Microsoft Visual C++ Runtime',
          message: featureText('runtimeRequiredHint'),
          detail: `${bits === 32 ? 'x86' : 'x64'}\n${missing.join(', ')}\n${folder}`,
          buttons: [featureText('runtimeDownload'), featureText('cancel')], cancelId: 1, defaultId: 0
        });
        if (response.response === 0) await shell.openExternal(`https://aka.ms/vc14/vc_redist.${bits === 32 ? 'x86' : 'x64'}.exe`);
        return { ok: false, code: 'runtimeRequiredHint' };
      }
    }
    if (api === 'd3d8' || api === 'd3d9') {
      try {
        p.source.feeder.dgVoodooDir = await ensureDgVoodoo(app.getPath('userData'));
        send({ code: 'legacyWrapperReady', params: { api, bitness: target.bitness } });
      } catch (error) {
        return { ok: false, code: componentCode(error, 'legacyDownloadHint'), message: error.message };
      }
    }
  }

  if (route === 'feeder') {
    try {
      p.source.feeder.lumeniteRoot = await ensureLumenite(app.getPath('userData'));
      send({ code: 'motionProviderReady', params: { provider: 'LumeniteFX Kernel 2.0' } });
    } catch (err) {
      // VORT is bundled under MIT as an offline fallback. The install remains
      // usable even when GitHub is unavailable.
      p.source.feeder.lumeniteRoot = null;
      send({ code: 'motionProviderFallback', params: { error: err.message } });
    }
  }

  // Only user-selected companion builds are installed. Leave unrelated
  // add-ons alone; all managed copies now participate in the transaction.
  const companions = route === 'native' && target.bitness === 64 ? companionAddons() : [];

  // The in-game overlay rides along with the install when it is switched on and
  // the executable is one it supports. Prepared before anything is written, so
  // an unsupported build refuses the install rather than half-finishing it.
  const gameOverlay = require('./src/game-overlay');
  let overlayWanted = false;
  // An unreadable preference means the overlay is off. A DLSS install must not
  // fail because of it.
  try { overlayWanted = require('./src/overlay-preferences').read(app.getPath('userData')).enabled === true; } catch {}

  let overlayPlan = null;
  if (overlayWanted) {
    try {
      // Drop records whose bytes are already gone - a restore, or an overlay
      // rebuilt since. Without this, prepare() refuses the new build because an
      // old record still claims a different one is installed here.
      gameOverlay.cleanupMissing(overlayLibrary(), dir);
      // An update ships a different overlay build. Retire the copy this app
      // installed here for the previous one instead of stopping with "remove
      // the previous test overlay first".
      gameOverlay.replaceOutdated(overlayLibrary(), path.dirname(target.path));
      if (gameOverlay.routes(target).includes(route)) {
        overlayPlan = gameOverlay.prepare({ library: overlayLibrary(), target, route });
      } else {
        // Never silently. A route or an API the panel cannot ride on produced
        // an install with no overlay file and no line saying why, which is
        // indistinguishable from a bug.
        send({ code: 'overlaySkipped', params: { error: `the panel does not attach on ${route}/${target.apiLabel || target.api}` } });
      }
    } catch (error) {
      // DLSS is the job; the overlay rides along. A missing or conflicting
      // overlay build is reported and skipped - the switch defaults to on, so
      // failing here would break every install on a machine without one.
      send({ code: 'overlaySkipped', params: { error: error.message } });
    }
  }

  try {
    // A game could have been launched while the component download ran.
    await guards.assertGameClosed(dir, target.path);
    // Preserve the previous snapshot before a repeat install changes it.
    history().list([{ dir, name: gameName(dir) }], error => send({ code: 'historySaveWarning', params: { error: error.message } }));
    const manifest = await backends.install({
      gameDir: dir,
      exePath: target.path,
      api,
      apiLabel: target.apiLabel,
      bitness: target.bitness,
      route,
      // #251: the multipass consumer, chosen per game and remembered. It
      // replaces the ordinary one, so it is a property of the install rather
      // than an add-on somebody drops in beside it.
      multipass: (loadState().multipassGames || []).includes(path.resolve(dir).toLowerCase()),
      antiCheatAcknowledged,
      emulator: target.emulator,
      source: p.source,
      optiRoot,
      companions,
      reshadeSetup: p.reshadeSetup,
      setupRunner: proton ? createSetupRunner(proton) : undefined,
      vulkanLayerTarget: path.join(app.getPath('userData'), 'reshade-vulkan'),
      installReShade: true,
      addMissingDlss: true,
      addStreamline: false,
      upgradeReShade: false
    }, send);
    // By this point DLSS is installed and the manifest is written. An overlay
    // failure here is reported, never turned into a failed install that the
    // caller would read as "nothing happened".
    if (overlayPlan) try {
      const exeDir = path.dirname(target.path);
      // Feeder's own config template omits two upstream defaults the overlay
      // reads; fill them without touching a choice already made.
      if (route === 'feeder') {
        const cfg = path.join(exeDir, 'dlss5-feed.cfg');
        if (fs.existsSync(cfg)) {
          await writeTracked(manifest, dir, cfg,
            gameOverlay.completeFeederConfig(fs.readFileSync(cfg, 'utf8')), { kind: 'config' });
        }
      }
      await journal.capture(dir, overlayPlan.file);
      await gameOverlay.attach({
        library: overlayLibrary(), target, gameDir: dir, manifest,
        saveManifest: saveActiveManifest, plan: overlayPlan
      });
      send({ code: 'addonInstalled', params: { name: 'DLSS 5 Overlay (F8)' } });
    } catch (error) {
      send({ code: 'overlaySkipped', params: { error: error.message } });
      try { gameOverlay.cleanupMissing(overlayLibrary(), dir); } catch {}
    }
    saveOperation(dir, manifest, 'install', send);
    return { ok: true, replaced: manifest.replaced.length, added: manifest.added.length };
  } catch (err) {
    // Drop stale overlay records whose bytes the rollback already removed.
    try { require('./src/game-overlay').cleanupMissing(overlayLibrary(), dir); } catch {}
    return { ok: false, code: err.code, message: err.message };
  }
}));

ipcMain.handle('restore', (event, dir) => exclusiveMutation(async () => {
  let restoredManifest = null;
  const send = (e) => {
    if (e.code === 'restoreDone') restoredManifest = e.params;
    event.sender.send('job', e);
  };
  try {
    let old = null;
    try { old = backends.readManifest(dir); } catch (error) { if (!fs.existsSync(journal.pendingPath(dir))) throw error; }
    // Recovery belongs to the manifest/journal, not the graphics scanner.
    // A missing/updated/unrecognised executable must not strand our hooks.
    if (!old && !fs.existsSync(journal.pendingPath(dir))) return { ok: false, code: 'errNoBackup' };
    const exe = old ? journal.safePath(dir, old.game.exe) : null;
    await guards.assertGameClosed(dir, exe);
    history().list([{ dir, name: gameName(dir) }], error => send({ code: 'historySaveWarning', params: { error: error.message } }));
    if (!await backends.restore(dir, send)) return { ok: false, code: 'errNoBackup' };
    saveOperation(dir, restoredManifest || {}, restoredManifest ? 'restore' : 'recovery', send);
    return { ok: true };
  } catch (err) {
    return { ok: false, code: err.code, message: err.message };
  }
}));

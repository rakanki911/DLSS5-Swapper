'use strict';

// Isolated UI test data: never load the real library, scan drives or install files.
const { contextBridge } = require('electron');
let groupGamesByStore = true;
let libraryReads = 0;
let installedRoute = null;
let installIssue = null;
let antiCheatWarning = false;
let installCalls = [];
let holdInstall = false;
let finishInstall = null;
let historyRows = [];
let historyFailure = false;
let copiedText = null;
let copyFailure = false;
let nextMenuAction = null;
let gameMenuCalls = [];
let gameActionCalls = [];
const apiOverrides = new Map();
let detectedApi = { api: 'dxgi', apiLabel: 'DirectX 12', bitness: 64 };
let apiSaveFailure = false;
let projectLinkFailure = false;
const projectLinks = [];
const games = [
  ['Euro Truck Simulator', 'DirectX 12', '2.2.16', true],
  ['American Truck Simulator', 'DirectX 11', '310.8.0.0', false],
  ['Truck Racing', 'DirectX 12', null, false],
  ['DuckStation', 'Vulkan', null, true],
  ['OpenGL Game', 'OpenGL', null, false],
  ['Classic DX9', 'DirectX 9', null, false],
  ['محاكي السيارات', 'DirectX 11', null, false],
  ['Unknown DLSS version', 'DirectX 12', null, false, true]
].map(([name, api, dlss, addon, hasDlss], index) => ({
  name, dir: `C:\\FixtureGames\\${index}`, launcher: 'My folders',
  cached: { ok: true, api, dx12: api === 'DirectX 12', dlss, addon, hasDlss: hasDlss ?? Boolean(dlss), bitness: 64 }
}));
games.push({ name: 'No 3D executable', dir: 'C:\\FixtureGames\\no-3d', launcher: 'My folders', cached: { ok: false, reason: 'no-graphics-exe' } });
contextBridge.exposeInMainWorld('lab', {
  boot: async () => ({ lang: 'en', theme: 'light', version: 'test', groupGamesByStore }),
  artStatus: async () => ({ available: false }),
  library: async () => { libraryReads++; return games; },
  settings: async () => ({ groupGamesByStore, folders: [], roots: [], stateFile: 'test', posterDir: 'test', posterCount: 0, autoScanDrives: false }),
  setGroupGamesByStore: async (enabled) => { groupGamesByStore = enabled; return enabled; },
  testLibraryReads: () => libraryReads,
  recents: async () => [],
  history: async () => {
    if (historyFailure) throw new Error('fixture history read failed');
    return { rows: historyRows, warning: false };
  },
  copyText: async text => { if (copyFailure) return false; copiedText = text; return true; },
  testCopiedText: () => copiedText,
  testCopyFailure: value => { copyFailure = value; },
  gameMenu: async (dir, options) => {
    gameMenuCalls.push({ dir, options });
    const selected = nextMenuAction;
    nextMenuAction = null;
    return selected;
  },
  communityProfile: async () => ({ name: 'Fixture', icon: 0, tag: 'test' }),
  communitySaveProfile: async profile => ({ ok: true, profile: { ...profile, tag: 'test' } }),
  communityDeleteMe: async () => ({ ok: true, result: { reports: 0, replies: 0 } }),
  communityCards: async () => ({ ok: true, cards: [], total: 0 }),
  communityCard: async () => ({ ok: false, error: 'not_found' }),
  communityUpdates: async () => ({ ok: true, notModified: true }),
  communityPrefill: async dir => ({ ok: true, prefill: { title: 'Fixture game', game: { title: 'Fixture game', exe: 'Game.exe' }, route: 'feeder', api: 'dx12', gpu: 'Fixture GPU', driver: '1.0', cpu: 'Fixture CPU', os: 'win32 test', app: 'test', dir } }),
  communityReport: async () => ({ ok: true, result: { card: 'title:fixturegame', report: 1 } }),
  communityReaction: async () => ({ ok: true }),
  testMenuAction: value => { nextMenuAction = value; },
  testMenuCalls: () => gameMenuCalls,
  testActionCalls: () => gameActionCalls,
  open: async dir => { gameActionCalls.push({ action: 'open', dir }); return ''; },
  openProject: async value => { projectLinks.push(value); return !projectLinkFailure; },
  testProjectLinks: () => projectLinks,
  testProjectLinkFailure: value => { projectLinkFailure = value; },
  setApiOverride: async (dir, exe, value) => {
    if (apiSaveFailure) return { ok: false, code: 'errApiSave' };
    apiOverrides.set(exe, value); return { ok: true };
  },
  testApiSaveFailure: value => { apiSaveFailure = value; },
  testDetectedApi: value => { detectedApi = value; },
  setPoster: async dir => { gameActionCalls.push({ action: 'poster', dir }); return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>'; },
  hide: async dir => { gameActionCalls.push({ action: 'hide', dir }); return true; },
  testHistory: rows => { historyRows = rows; },
  testHistoryFailure: value => { historyFailure = value; },
  testInstallIssue: value => { installIssue = value; },
  testAntiCheatWarning: value => { antiCheatWarning = value; },
  details: async dir => ({
    ok: true, newDlss: '310.8.0.0', recommendedRoute: 'native', installedRoute,
    previousReShadeRoute: 'native', installedApi: installedRoute ? 'dxgi' : null,
    installedExe: installedRoute ? 'Game.exe' : null, hasBackup: Boolean(installedRoute),
    exes: [{ rel: 'Game.exe', path: dir + '\\Game.exe', api: 'dxgi', apiLabel: 'DirectX 12', bitness: 64, size: 104857600,
      ...detectedApi, apiOverride: apiOverrides.get(dir + '\\Game.exe') || 'auto',
      hasNativeDlss: true, installIssue, antiCheatWarning, apiChoices: [{ api: 'dxgi', label: 'DirectX 12' }] }],
    files: [{ name: 'nvngx_dlss.dll', rel: 'nvngx_dlss.dll', version: '2.2.16' }],
    currentDlss: { rel: 'nvngx_dlss.dll', version: '2.2.16' }, addon: installedRoute === 'native',
    optiscaler: installedRoute === 'optiscaler' ? { version: '0.1.1.5-dlssnr', installed: true } : null,
    reshade: { installed: installedRoute === 'native', version: '6.8.0', addonSupport: true }
  }),
  artFetch: async () => ({ none: true }),
  install: async (dir, exe, route, api) => {
    installCalls.push({ dir, exe, route, api });
    if (holdInstall) await new Promise(resolve => { finishInstall = resolve; });
    installedRoute = route;
    historyRows.push({ name: 'Euro Truck Simulator', dir, date: new Date().toISOString(), route, action: 'install', replaced: 1, added: 5 });
    return { ok: true, replaced: 1, added: 5 };
  },
  restoreGame: async dir => {
    gameActionCalls.push({ action: 'restore', dir });
    historyRows.push({ name: 'Euro Truck Simulator', dir, date: new Date().toISOString(), route: installedRoute, action: 'restore', replaced: 1, added: 5 });
    installedRoute = null; return { ok: true };
  },
  scan: async dir => {
    gameActionCalls.push({ action: 'scan', dir });
    return { ...games.find(g => g.dir === dir).cached, optiscaler: installedRoute === 'optiscaler' };
  },
  touch: async () => [],
  testInstallCalls: () => installCalls,
  testHoldInstall: () => { holdInstall = true; },
  testFinishInstall: () => { holdInstall = false; finishInstall?.(); },
  setLang: async () => {},
  setTheme: async () => {},
  onJob: () => {}
});

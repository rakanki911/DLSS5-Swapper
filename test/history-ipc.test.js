'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { createRequire } = require('module');

// Execute the real IPC handlers with fake installers, downloads and clipboard.
// No game files, GPU, registry, real profile or system clipboard are touched.
test('install/restore IPC records all backends, not failures/cancels, and validates clipboard writes', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swapper-history-ipc-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const main = path.resolve(__dirname, '../main.js');
  const realRequire = createRequire(main);
  const handlers = new Map();
  const game = path.join(root, 'game');
  const target = { path: path.join(game, 'Game.exe'), rel: 'Game.exe', bitness: 64, api: 'dxgi', apiLabel: 'DirectX 12' };
  let old = null, failInstall = false, failRestore = false, cancel = false, copied = null;
  let protectedTarget = false, scanFails = false;
  let antiCheatResponse = 0;
  const riskDialogs = [], installedConfigs = [];
  let menuItems;
  const stubs = {
    electron: { app: { setAppUserModelId() {}, whenReady: () => ({ then() {} }), on() {}, getPath: () => root },
      BrowserWindow: { fromWebContents: () => ({ isDestroyed: () => false, getContentSize: () => [1280, 860] }) },
      Menu: { buildFromTemplate: items => {
        menuItems = items;
        return { popup: options => { items.find(item => item.id === 'copy').click(); options.callback(); } };
      } },
      ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
      dialog: { showMessageBox: async (_window, options) => {
        if (/anti-cheat|مكافحة الغش/.test(options.title)) {
          riskDialogs.push(options);
          return { response: antiCheatResponse };
        }
        return { response: cancel ? 1 : 0 };
      } }, clipboard: { writeText: text => { copied = text; } } },
    './src/core/scan.js': { scanGame: async () => {
      if (scanFails) throw new Error('Executable scan is unavailable');
      return { chosen: target, exeCandidates: [target], hasNativeDlss: true, reshade: { installed: false, file: null, kind: null, version: null, addonSupport: false } };
    } },
    './src/core/compatibility': { assertSafeTarget() {}, hasAntiCheat: () => protectedTarget },
    './src/core/install-guards': { assertGameClosed: async () => {}, antiCheatPresent: () => false, gpuInfo: async () => [{}], gpuSupported: () => true },
    './src/shared/install-routes': { nativeDlssPresent: () => true, routesFor: () => ['native', second, 'optiscaler'], recommendedRoute: () => 'native' },
    './src/core/runtime-components.js': { missingVCRuntime: () => [], ensureLumenite: async () => null },
    './src/core/optiscaler': { checkConflicts() {}, ensureOptiScaler: async () => root, RELEASE: { version: 'fixture' } },
    './src/core/backend-manager': {
      readManifest: () => old,
      install: async config => {
        installedConfigs.push(config);
        if (failInstall) throw new Error('fixture failed install');
        old = { version: 1, date: new Date().toISOString(), route: config.route, game: { dir: game, exe: 'Game.exe', api: 'dxgi' }, replaced: [], added: ['fixture.dll'] };
        return old;
      },
      restore: async (_dir, send) => {
        if (failRestore) throw new Error('fixture failed restore');
        if (!old) return false;
        send({ code: 'restoreDone', params: old }); old = null; return true;
      }
    }
  };
  const context = vm.createContext({ require: name => stubs[name] || realRequire(name), __dirname: path.dirname(main), process, Buffer, console });
  vm.runInContext(fs.readFileSync(main, 'utf8'), context, { filename: main });
  vm.runInContext(`payload = () => ({ source: { feeder: { ok32: true, ok64: true } } }); companionAddons = () => [];`, context);
  const event = { sender: { send() {} } };
  // The Feeder route is refused on Linux. This test is about what reaches the
  // history, not about any one route, so it exercises whichever second route
  // the running platform offers.
  const second = process.platform === 'linux' ? 'optiscaler' : 'feeder';
  for (const route of ['native', 'native', second, 'optiscaler']) {
    assert.equal((await handlers.get('install')(event, game, target.path, route, 'dxgi')).ok, true);
  }
  assert.equal(handlers.get('history')().rows.length, 4, 'no renderer.touch call needed');
  failInstall = true;
  assert.equal((await handlers.get('install')(event, game, target.path, 'native', 'dxgi')).ok, false);
  failInstall = false; cancel = true;
  assert.equal((await handlers.get('install')(event, game, target.path, 'optiscaler', 'dxgi')).cancelled, true);
  assert.equal(handlers.get('history')().rows.length, 4);
  protectedTarget = true;
  const callsBeforeWarning = installedConfigs.length;
  for (const route of ['native', second, 'optiscaler']) {
    assert.equal((await handlers.get('install')(event, game, target.path, route, 'dxgi')).cancelled, true);
  }
  assert.equal(installedConfigs.length, callsBeforeWarning, 'cancel never reaches the installer');
  assert.equal(handlers.get('history')().rows.length, 4);
  assert.equal(riskDialogs.length, 3);
  antiCheatResponse = 1; cancel = false;
  for (const route of ['native', second, 'optiscaler']) {
    assert.equal((await handlers.get('install')(event, game, target.path, route, 'dxgi')).ok, true);
    assert.equal(installedConfigs.at(-1).antiCheatAcknowledged, true);
  }
  assert.equal(handlers.get('history')().rows.length, 7);
  antiCheatResponse = 0;
  assert.equal((await handlers.get('install')(event, game, target.path, 'native', 'dxgi')).cancelled, true, 'a previous approval is never remembered');
  assert.equal(handlers.get('history')().rows.length, 7);
  assert.equal(riskDialogs.length, 7);
  // Restore still works for protected games even if scanning crashes or the
  // executable has disappeared. It uses the backup/journal, not PE detection.
  scanFails = true;
  failRestore = true;
  assert.equal((await handlers.get('restore')(event, game)).ok, false);
  failRestore = false;
  assert.equal((await handlers.get('restore')(event, game)).ok, true);
  assert.equal((await handlers.get('restore')(event, game)).ok, false, 'no backup is not a successful restore');
  scanFails = false;
  const rows = handlers.get('history')().rows;
  assert.equal(rows.length, 8);
  assert.equal(riskDialogs.length, 7, 'restore does not ask for injection consent');
  assert.equal(rows.filter(row => row.action === 'restore').length, 1);
  handlers.get('reset')();
  vm.runInContext('historyStore = null', context);
  assert.equal(handlers.get('history')().rows.length, 8, 'persists independently from library state');
  const copy = handlers.get('copy-text');
  for (const bad of [null, {}, '', ' ', 'a'.repeat(16 * 1024 * 1024 + 1)]) assert.equal(copy(event, bad), false);
  assert.equal(copied, null);
  assert.equal(copy(event, 'سجل\n<game> & restore'), true);
  assert.equal(copied, 'سجل\n<game> & restore');
  assert.equal(await handlers.get('game-menu')(event, 'relative/path', {}), null);
  assert.equal(await handlers.get('game-menu')(event, game, { busy: true, labels: { open: 'فتح المجلد' } }), 'copy');
  assert.equal(menuItems.find(item => item.id === 'restore').enabled, false);
  assert.equal(menuItems.find(item => item.id === 'scan').enabled, false);
  assert.equal(menuItems.find(item => item.id === 'open').label, 'فتح المجلد');
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { createRequire } = require('module');

// Two game cards scan at the same time - which is what the grid always does.
// Each handler used to keep its own parsed copy of library.json across the
// await and write that copy back, so the slower scan overwrote the faster
// one's result and a card came back empty until it was scanned again.
test('concurrent scans both survive in the saved library', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swapper-state-race-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const main = path.resolve(__dirname, '../main.js');
  const realRequire = createRequire(main);
  const handlers = new Map();

  const target = (dir) => ({ path: path.join(dir, 'Game.exe'), rel: 'Game.exe', bitness: 64, api: 'dxgi', apiLabel: 'DirectX 12' });
  // The first scan takes longer than the second, so the finishing order is the
  // opposite of the starting order - exactly the case that lost a write.
  const delays = { slow: 60, fast: 5 };
  const stubs = {
    electron: {
      app: { setAppUserModelId() {}, whenReady: () => ({ then() {} }), on() {}, getPath: () => root },
      BrowserWindow: { fromWebContents: () => null },
      Menu: { buildFromTemplate: () => ({ popup() {} }) },
      ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
      dialog: { showMessageBox: async () => ({ response: 1 }) },
      clipboard: { writeText() {} }
    },
    './src/core/scan.js': {
      scanGame: async (dir) => {
        await new Promise(resolve => setTimeout(resolve, path.basename(dir) === 'slow' ? delays.slow : delays.fast));
        return { chosen: target(dir), exeCandidates: [target(dir)], dlssFiles: [], streamlineFiles: [], reshade: { installed: false } };
      },
      scanSource: () => ({ ok: false })
    },
    './src/shared/install-routes': { nativeDlssPresent: () => true, routesFor: () => ['native'], recommendedRoute: () => 'native' }
  };
  const context = vm.createContext({ require: name => stubs[name] || realRequire(name), __dirname: path.dirname(main), process, Buffer, console, setTimeout, clearTimeout });
  vm.runInContext(fs.readFileSync(main, 'utf8'), context, { filename: main });

  const slow = path.join(root, 'slow');
  const fast = path.join(root, 'fast');
  await Promise.all([handlers.get('scan')({}, slow), handlers.get('scan')({}, fast)]);

  const saved = JSON.parse(fs.readFileSync(path.join(root, 'library.json'), 'utf8'));
  const dirs = Object.values(saved.scans).map(row => row.dir).sort();
  assert.deepEqual(dirs, [fast, slow], 'both scan results must be in the file');
});

test('a setting saved while a scan is in flight is not rolled back by it', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swapper-state-setting-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const main = path.resolve(__dirname, '../main.js');
  const realRequire = createRequire(main);
  const handlers = new Map();
  const target = { path: path.join(root, 'g', 'Game.exe'), rel: 'Game.exe', bitness: 64, api: 'dxgi', apiLabel: 'DirectX 12' };
  const stubs = {
    electron: {
      app: { setAppUserModelId() {}, whenReady: () => ({ then() {} }), on() {}, getPath: () => root },
      BrowserWindow: { fromWebContents: () => null },
      Menu: { buildFromTemplate: () => ({ popup() {} }) },
      ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
      dialog: { showMessageBox: async () => ({ response: 1 }) },
      clipboard: { writeText() {} }
    },
    './src/core/scan.js': {
      scanGame: async () => {
        await new Promise(resolve => setTimeout(resolve, 40));
        return { chosen: target, exeCandidates: [target], dlssFiles: [], streamlineFiles: [], reshade: { installed: false } };
      },
      scanSource: () => ({ ok: false })
    },
    './src/shared/install-routes': { nativeDlssPresent: () => true, routesFor: () => ['native'], recommendedRoute: () => 'native' }
  };
  const context = vm.createContext({ require: name => stubs[name] || realRequire(name), __dirname: path.dirname(main), process, Buffer, console, setTimeout, clearTimeout });
  vm.runInContext(fs.readFileSync(main, 'utf8'), context, { filename: main });

  const scanning = handlers.get('scan')({}, path.join(root, 'g'));
  await handlers.get('set-lang')({}, 'ar');
  await scanning;

  const saved = JSON.parse(fs.readFileSync(path.join(root, 'library.json'), 'utf8'));
  assert.equal(saved.lang, 'ar', 'the language chosen mid-scan must still be there');
  assert.equal(Object.keys(saved.scans).length, 1, 'and the scan result too');
});

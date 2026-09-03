'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { steam } = require('../src/library');
const { protonCandidates } = require('../src/core/proton');

test('Linux Steam discovery finds Proton game libraries and their prefix', (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-linux-steam-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const root = path.join(home, '.local', 'share', 'Steam');
  const library = path.join(home, 'Games');
  const apps = path.join(library, 'steamapps');
  fs.mkdirSync(path.join(apps, 'common', 'Example Game'), { recursive: true });
  fs.mkdirSync(path.join(root, 'steamapps', 'compatdata', '123', 'pfx'), { recursive: true });
  fs.mkdirSync(path.join(root, 'appcache', 'librarycache'), { recursive: true });
  fs.mkdirSync(path.join(root, 'steamapps'), { recursive: true });
  fs.writeFileSync(path.join(root, 'steamapps', 'libraryfolders.vdf'), `"libraryfolders"\n{\n"0"\n{\n"path" "${library.replace(/\\/g, '\\\\')}"\n}\n}`);
  fs.writeFileSync(path.join(apps, 'appmanifest_123.acf'), '"AppState" { "appid" "123" "name" "Example Game" "installdir" "Example Game" }');

  const games = steam({ platform: 'linux', home });
  assert.equal(games.length, 1);
  assert.equal(games[0].id, '123');
  assert.equal(games[0].protonPrefix, path.join(root, 'steamapps', 'compatdata', '123', 'pfx'));
});

test('configured Proton tool is preferred for a Steam prefix', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-proton-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const prefix = path.join(root, 'steamapps', 'compatdata', '123', 'pfx');
  for (const version of ['Proton 8.0', 'Proton 9.0']) {
    const file = path.join(root, 'steamapps', 'common', version, 'proton');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '');
  }
  fs.mkdirSync(prefix, { recursive: true });
  fs.writeFileSync(path.join(path.dirname(prefix), 'config_info'), 'Proton 9.0');
  assert.equal(protonCandidates(root, prefix)[0], path.join(root, 'steamapps', 'common', 'Proton 9.0', 'proton'));
});

const guards = require('../src/core/install-guards');
const { spawn } = require('child_process');
const { once } = require('events');
const linuxOnly = { skip: process.platform !== 'linux' ? 'Linux only' : false };

test('a process running from the game folder blocks the install, and stops blocking once it exits', linuxOnly, async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-guard-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const exe = path.join(dir, 'Game.exe');
  fs.writeFileSync(exe, '');

  // Steam launches a Proton game with the game folder as its working
  // directory, which is what this stands in for.
  const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], { cwd: dir, stdio: 'ignore' });
  t.after(() => { try { child.kill(); } catch {} });
  await once(child, 'spawn');
  await assert.rejects(guards.assertGameClosed(dir, exe), { code: 'errGameRunning' });

  child.kill();
  await once(child, 'exit');
  await guards.assertGameClosed(dir, exe);
});

test('the /proc snapshot names processes and ties none of them to an unrelated folder', linuxOnly, () => {
  const rows = guards.linuxSnapshot(path.join(os.tmpdir(), 'dlss5-no-such-game'));
  const self = rows.find((row) => row.ProcessId === process.pid);
  assert.ok(self, 'the running test process is in the snapshot');
  assert.equal(self.Name, path.basename(process.execPath));
  assert.equal(guards.matchingProcesses(rows, path.join(os.tmpdir(), 'dlss5-no-such-game'), 'Game.exe').length, 0);
});

test('an unreadable process table is a failed check rather than an idle machine', linuxOnly, async () => {
  await assert.rejects(guards.assertGameClosed('/nonexistent', 'Game.exe', () => { throw new Error('EACCES'); }), { code: 'errProcessCheck' });
});

test('the GPU query uses the Linux nvidia-smi binary', linuxOnly, async () => {
  let called = null;
  const rows = await guards.gpuInfo((file, args) => { called = { file, args }; return 'NVIDIA GeForce RTX 5090, 616.56'; });
  assert.equal(called.file, 'nvidia-smi');
  assert.deepEqual(rows, [{ name: 'NVIDIA GeForce RTX 5090', driver: '616.56' }]);
  assert.equal(guards.gpuSupported(rows), true);
});

test('a wine process is tied to the game by what it has mapped, not by its own exe path', linuxOnly, async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-maps-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const exe = path.join(dir, 'Game.exe');
  fs.writeFileSync(exe, '');

  // Stands in for a Proton game: the process runs from outside the folder and
  // its /proc/<pid>/exe points at the runtime, exactly as wine's does. The
  // only tie left is the library it loaded out of the game folder.
  const library = path.join(dir, 'game.so');
  fs.copyFileSync(fs.realpathSync('/usr/lib/libz.so.1'), library);
  const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)', 'Game.exe'],
    { cwd: os.tmpdir(), stdio: 'ignore', env: { ...process.env, LD_PRELOAD: library } });
  t.after(() => { try { child.kill(); } catch {} });
  await once(child, 'spawn');

  const row = guards.linuxSnapshot(dir).find((entry) => entry.ProcessId === child.pid);
  assert.equal(row.ExecutablePath, library);
  await assert.rejects(guards.assertGameClosed(dir, exe), { code: 'errGameRunning' });
});

// Runs the real install handler with fake installers and a fake Steam root, to
// check which games still reach the Windows ReShade Setup and which no longer
// have to. No game files, GPU or real Steam library are touched.
test('an install without a Steam Play prefix still runs, and only refuses where it reaches ReShade Setup', linuxOnly, async (t) => {
  const vm = require('vm');
  const { createRequire } = require('module');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-proton-gate-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const game = path.join(root, 'game');
  fs.mkdirSync(game, { recursive: true });
  const target = { path: path.join(game, 'Game.exe'), rel: 'Game.exe', bitness: 64, api: 'dxgi', apiLabel: 'DirectX 12' };

  const main = path.resolve(__dirname, '../main.js');
  const realRequire = createRequire(main);
  const handlers = new Map();
  const configs = [];
  let steamGames = [];
  const stubs = {
    electron: { app: { setAppUserModelId() {}, whenReady: () => ({ then() {} }), on() {}, getPath: () => root },
      BrowserWindow: { fromWebContents: () => ({ isDestroyed: () => false, getContentSize: () => [1280, 860] }) },
      Menu: { buildFromTemplate: () => ({ popup() {} }) },
      ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
      dialog: { showMessageBox: async () => ({ response: 0 }) }, clipboard: { writeText() {} } },
    './src/library': { ...realRequire('./src/library'), steam: () => steamGames },
    './src/core/scan.js': { scanGame: async () => ({ chosen: target, exeCandidates: [target], hasNativeDlss: true, reshade: { installed: false, file: null, kind: null, version: null, addonSupport: false } }) },
    './src/core/compatibility': { assertSafeTarget() {}, hasAntiCheat: () => false },
    './src/core/install-guards': { assertGameClosed: async () => {}, antiCheatPresent: () => false, gpuInfo: async () => [{}], gpuSupported: () => true },
    './src/shared/install-routes': { nativeDlssPresent: () => true, routesFor: () => ['native'], recommendedRoute: () => 'native' },
    './src/core/runtime-components.js': { missingVCRuntime: () => [], ensureLumenite: async () => null },
    './src/core/optiscaler': { checkConflicts() {}, ensureOptiScaler: async () => root, RELEASE: { version: 'fixture' } },
    './src/core/backend-manager': {
      readManifest: () => null,
      install: async (config) => {
        configs.push(config);
        return { version: 1, date: new Date().toISOString(), route: config.route, game: { dir: game, exe: 'Game.exe', api: 'dxgi' }, replaced: [], added: [] };
      },
      restore: async () => true
    }
  };
  const context = vm.createContext({ require: (name) => stubs[name] || realRequire(name), __dirname: path.dirname(main), process, Buffer, console });
  vm.runInContext(fs.readFileSync(main, 'utf8'), context, { filename: main });
  vm.runInContext('payload = () => ({ source: { feeder: { ok32: true, ok64: true } } }); companionAddons = () => [];', context);
  const event = { sender: { send() {} } };

  // No prefix: the install is no longer refused before it starts, and the
  // runner it carries is the one that gives up only when the setup is reached.
  assert.equal((await handlers.get('install')(event, game, target.path, 'native', 'dxgi')).ok, true);
  await assert.rejects(async () => configs.at(-1).setupRunner('ReShade_Setup.exe', [target.path], () => {}), { code: 'errProtonRequired' });

  // With a prefix the game gets a runner that actually launches Proton: a
  // missing setup comes back as a failed run, not as a refusal to try.
  const steamRoot = path.join(root, 'Steam');
  const prefix = path.join(steamRoot, 'steamapps', 'compatdata', '123', 'pfx');
  fs.mkdirSync(prefix, { recursive: true });
  fs.mkdirSync(path.join(steamRoot, 'steamapps', 'common', 'Proton 9.0'), { recursive: true });
  fs.writeFileSync(path.join(steamRoot, 'steamapps', 'common', 'Proton 9.0', 'proton'), '');
  steamGames = [{ launcher: 'Steam', id: '123', name: 'Example Game', dir: game, steamRoot, protonPrefix: prefix }];

  assert.equal((await handlers.get('install')(event, game, target.path, 'native', 'dxgi')).ok, true);
  const attempt = await configs.at(-1).setupRunner('ReShade_Setup.exe', [target.path], () => {});
  assert.equal(attempt.code, -1, 'the runner tried to spawn Proton rather than refusing');
});

test('the Feeder route is refused on Linux, and OptiScaler is left open', linuxOnly, async (t) => {
  const vm = require('vm');
  const { createRequire } = require('module');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-vulkan-route-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const game = path.join(root, 'game');
  fs.mkdirSync(game, { recursive: true });
  const target = { path: path.join(game, 'Game.exe'), rel: 'Game.exe', bitness: 64, api: 'vulkan', apiLabel: 'Vulkan' };

  const main = path.resolve(__dirname, '../main.js');
  const realRequire = createRequire(main);
  const handlers = new Map();
  const configs = [];
  let reshade = { installed: false, file: null, kind: null, version: null, addonSupport: false };
  const stubs = {
    electron: { app: { setAppUserModelId() {}, whenReady: () => ({ then() {} }), on() {}, getPath: () => root },
      BrowserWindow: { fromWebContents: () => ({ isDestroyed: () => false, getContentSize: () => [1280, 860] }) },
      Menu: { buildFromTemplate: () => ({ popup() {} }) },
      ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
      dialog: { showMessageBox: async () => ({ response: 0 }) }, clipboard: { writeText() {} } },
    './src/library': { ...realRequire('./src/library'), steam: () => [], heroic: () => [], lutris: () => [] },
    './src/core/scan.js': { scanGame: async () => ({ chosen: target, exeCandidates: [target], hasNativeDlss: true, reshade }) },
    './src/core/compatibility': { assertSafeTarget() {}, hasAntiCheat: () => false },
    './src/core/install-guards': { assertGameClosed: async () => {}, antiCheatPresent: () => false, gpuInfo: async () => [{ name: 'NVIDIA GeForce RTX 5090', driver: '616.56' }], gpuSupported: () => true },
    './src/shared/install-routes': { nativeDlssPresent: () => true, routesFor: () => ['feeder', 'optiscaler'], recommendedRoute: () => 'feeder' },
    './src/core/runtime-components.js': { missingVCRuntime: () => [], ensureLumenite: async () => null },
    './src/core/optiscaler': { checkConflicts() {}, ensureOptiScaler: async () => root, RELEASE: { version: 'fixture' } },
    './src/core/backend-manager': {
      readManifest: () => null,
      install: async (config) => {
        configs.push(config);
        return { version: 1, date: new Date().toISOString(), route: config.route, game: { dir: game, exe: 'Game.exe', api: 'vulkan' }, replaced: [], added: [] };
      },
      restore: async () => true
    }
  };
  const context = vm.createContext({ require: (name) => stubs[name] || realRequire(name), __dirname: path.dirname(main), process, Buffer, console });
  vm.runInContext(fs.readFileSync(main, 'utf8'), context, { filename: main });
  vm.runInContext('payload = () => ({ source: { feeder: { ok32: true, ok64: true } } }); companionAddons = () => [];', context);
  const event = { sender: { send() {} } };

  // The Feeder is refused whatever the renderer: it can leave a Proton game
  // unable to start, which is not something an API check would catch.
  for (const api of ['vulkan', 'dxgi']) {
    const feeder = await handlers.get('install')(event, game, target.path, 'feeder', api);
    assert.equal(feeder.ok, false);
    assert.equal(feeder.code, 'errLinuxFeederUnsupported');
  }

  // OptiScaler puts a proxy DLL in the game folder and never registers a
  // layer, so nothing about it depends on the Windows registry.
  const opti = await handlers.get('install')(event, game, target.path, 'optiscaler', 'vulkan');
  assert.equal(opti.ok, true);
  assert.equal(configs.at(-1).route, 'optiscaler');
  assert.equal(configs.at(-1).api, 'vulkan');

  // A proxy that is already there may belong to another mod; replacing it
  // crashed otherwise healthy games.
  reshade = { installed: true, file: 'dxgi.dll', kind: 'proxy', version: '6.0.0', addonSupport: false };
  const blocked = await handlers.get('install')(event, game, target.path, 'optiscaler', 'vulkan');
  assert.equal(blocked.code, 'errExistingReShade');
});

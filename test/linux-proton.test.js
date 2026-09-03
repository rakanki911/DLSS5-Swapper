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

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createOverlayLibrary } = require('../src/overlays');
const gameOverlay = require('../src/game-overlay');

// realpathSync only answers for a directory that exists, and the library
// resolves install targets the same way.
function realDir(...parts) {
  const dir = path.join(...parts);
  fs.mkdirSync(dir, { recursive: true });
  return fs.realpathSync(dir);
}

// readNative only reads the DOS and COFF headers, so a handful of fields is a
// complete binary as far as the library is concerned. `filler` makes two
// otherwise identical builds hash differently, which is what an update looks
// like from here.
function minimalPe(file, { dll, filler }) {
  const buf = Buffer.alloc(512, filler);
  buf.writeUInt16LE(0x5a4d, 0);
  buf.writeUInt32LE(0x80, 0x3c);
  buf.writeUInt32LE(0x00004550, 0x80);
  buf.writeUInt16LE(0x8664, 0x84);
  buf.writeUInt16LE(dll ? 0x2022 : 0x0022, 0x96);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  return file;
}

test('an updated overlay build replaces the copy the previous one installed', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-overlay-update-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const gameDir = realDir(root, 'game');
  const exe = minimalPe(path.join(gameDir, 'Game.exe'), { dll: false, filler: 1 });
  const oldBuild = minimalPe(path.join(root, 'old', 'overlay.addon64'), { dll: true, filler: 2 });
  const newBuild = minimalPe(path.join(root, 'new', 'overlay.addon64'), { dll: true, filler: 3 });

  const library = build => createOverlayLibrary(path.join(root, 'library'), build);
  const target = { path: exe, bitness: 64, api: 'dxgi', apiLabel: 'DirectX 12' };

  const installed = library(oldBuild).install('builtin', exe);
  assert.ok(fs.existsSync(installed.file));

  // Without the replacement step the older copy blocks the new build outright.
  assert.throws(() => gameOverlay.prepare({ library: library(newBuild), target, route: 'native' }),
    /Remove the previous test overlay/);

  gameOverlay.replaceOutdated(library(newBuild), gameDir);
  assert.equal(fs.existsSync(installed.file), false, 'the previous build was left in the game folder');
  assert.deepEqual(library(newBuild).list().installations, []);

  const plan = gameOverlay.prepare({ library: library(newBuild), target, route: 'native' });
  assert.equal(plan.alreadyPresent, false);
  assert.notEqual(plan.file, installed.file);
});

test('a current overlay installation survives the replacement check', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-overlay-keep-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const gameDir = realDir(root, 'game');
  const exe = minimalPe(path.join(gameDir, 'Game.exe'), { dll: false, filler: 1 });
  const build = minimalPe(path.join(root, 'build', 'overlay.addon64'), { dll: true, filler: 2 });
  const library = () => createOverlayLibrary(path.join(root, 'library'), build);

  const installed = library().install('builtin', exe);
  gameOverlay.replaceOutdated(library(), gameDir);
  assert.ok(fs.existsSync(installed.file), 'the matching build must not be removed');
  assert.equal(library().list().installations.length, 1);
});

test('another game keeps its overlay when this one is updated', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-overlay-other-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const first = realDir(root, 'first');
  const second = realDir(root, 'second');
  const exeOne = minimalPe(path.join(first, 'One.exe'), { dll: false, filler: 1 });
  const exeTwo = minimalPe(path.join(second, 'Two.exe'), { dll: false, filler: 1 });
  const oldBuild = minimalPe(path.join(root, 'old', 'overlay.addon64'), { dll: true, filler: 2 });
  const newBuild = minimalPe(path.join(root, 'new', 'overlay.addon64'), { dll: true, filler: 3 });
  const library = b => createOverlayLibrary(path.join(root, 'library'), b);

  library(oldBuild).install('builtin', exeOne);
  const untouched = library(oldBuild).install('builtin', exeTwo);

  gameOverlay.replaceOutdated(library(newBuild), first);
  assert.ok(fs.existsSync(untouched.file), 'only the game being installed into is updated');
  assert.deepEqual(library(newBuild).list().installations.map(r => r.directory), [second]);
});

test('a protected Xbox executable uses the architecture found by the game scanner', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-overlay-xbox-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const gameDir = realDir(root, 'XboxGame', 'Content');
  const exe = path.join(gameDir, 'Game.exe');
  fs.writeFileSync(exe, 'encrypted executable placeholder');
  const build = minimalPe(path.join(root, 'build', 'overlay.addon64'), { dll: true, filler: 2 });
  const library = createOverlayLibrary(path.join(root, 'library'), build);
  const target = { path: exe, bitness: 64, api: 'dxgi', apiLabel: 'DirectX 12' };
  const plan = gameOverlay.prepare({ library, target, route: 'native' });
  const manifest = { added: [] };

  assert.throws(() => library.install('builtin', exe), /Invalid Windows PE binary/);
  const installed = await gameOverlay.attach({
    library, target, gameDir, manifest, plan,
    saveManifest: async () => {}
  });

  assert.equal(fs.existsSync(installed.file), true);
  assert.deepEqual(manifest.added, [path.basename(installed.file)]);
  assert.equal(manifest.labOverlay.architecture, 64);
});

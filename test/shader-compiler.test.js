'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const compatibility = require('../src/core/compatibility');
const { retireOldShaderCompiler, beginManifest, restoreFiles, originalPath } = require('../src/core/apply');

// Numbers read off a real machine: Spider-Man Remastered ships
// D3DCompiler_47.dll 6.3.9600.16384, dated 2013, next to its executable, while
// Windows itself carries 10.0.26100.9168. Windows loads the game-local copy
// first, and one from before the Windows 10 SDK cannot compile the neural pass
// (cs_5_1) - so the pass produces nothing while the install, the add-on and the
// frame counter all report success.
const OLD = '6.3.9600.16384';
const CURRENT = '10.0.26100.9168';

function folder(t, version) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shader-compiler-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  if (version !== null) fs.writeFileSync(path.join(dir, 'D3DCompiler_47.dll'), 'dll');
  return [dir, () => version];
}

test('a compiler from before the Windows 10 SDK is reported', (t) => {
  const [dir, version] = folder(t, OLD);
  const stale = compatibility.oldShaderCompiler(dir, version);
  assert.equal(stale.version, OLD);
  assert.equal(path.basename(stale.file), 'D3DCompiler_47.dll');
});

test('a current compiler beside the game is not worth mentioning', (t) => {
  const [dir, version] = folder(t, CURRENT);
  assert.equal(compatibility.oldShaderCompiler(dir, version), null);
  const [older, ok] = folder(t, '10.0.19041.1');
  assert.equal(compatibility.oldShaderCompiler(older, ok), null,
    'Assassin\u2019s Creed Mirage ships this one and compiles the pass fine');
});

test('no compiler in the game folder is the normal case', (t) => {
  const [dir, version] = folder(t, null);
  assert.equal(compatibility.oldShaderCompiler(dir, version), null);
});

test('an unreadable version resource never speaks up', (t) => {
  const [dir] = folder(t, OLD);
  assert.equal(compatibility.oldShaderCompiler(dir, () => null), null);
  assert.equal(compatibility.oldShaderCompiler(dir, () => { throw new Error('locked'); }), null);
});

test('Windows own copy is current, so the check is quiet on a clean machine', () => {
  const system32 = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32');
  if (!fs.existsSync(path.join(system32, 'D3DCompiler_47.dll'))) return;
  assert.equal(compatibility.oldShaderCompiler(system32), null);
});

// The install has to act on this, not only mention it: nobody can be expected
// to know what a shader model is. The file goes into the backup like any other
// replaced file, and Restore hands it back.
function game(t) {
  const gameDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shader-retire-'));
  t.after(() => fs.rmSync(gameDir, { recursive: true, force: true }));
  const exePath = path.join(gameDir, 'Spider-Man.exe');
  fs.writeFileSync(exePath, 'exe');
  const compiler = path.join(gameDir, 'D3DCompiler_47.dll');
  fs.writeFileSync(compiler, 'the compiler the game shipped');
  const manifest = beginManifest(gameDir, exePath, 'dxgi');
  manifest.route = 'feeder';
  // Old beside the game, current in Windows - what the real machine looks like.
  const version = (file) => path.dirname(file) === gameDir ? OLD : CURRENT;
  return { gameDir, exePath, compiler, manifest, version };
}

test('the install retires the stale compiler and Restore gives it back', async (t) => {
  const { gameDir, compiler, manifest, version } = game(t);
  const said = [];
  const acted = await retireOldShaderCompiler(manifest, gameDir, gameDir,
    (code, params) => said.push([code, params]), version);

  assert.equal(acted, true);
  assert.equal(fs.existsSync(compiler), false, 'the game now loads the copy in System32');
  assert.deepEqual(said, [['oldShaderCompiler', { rel: 'D3DCompiler_47.dll', version: OLD }]]);
  assert.deepEqual(manifest.replaced.map(row => [row.rel, row.oldVersion, row.kind]),
    [['D3DCompiler_47.dll', OLD, 'shaderCompiler']]);
  assert.equal(fs.readFileSync(originalPath(gameDir, manifest, 'D3DCompiler_47.dll'), 'utf8'), 'the compiler the game shipped');

  await restoreFiles(gameDir, manifest);
  assert.equal(fs.readFileSync(compiler, 'utf8'), 'the compiler the game shipped');
});

test('a current compiler beside the game is left exactly where it is', async (t) => {
  const { gameDir, compiler, manifest } = game(t);
  const acted = await retireOldShaderCompiler(manifest, gameDir, gameDir, () => {}, () => CURRENT);
  assert.equal(acted, false);
  assert.equal(fs.existsSync(compiler), true);
  assert.deepEqual(manifest.replaced, []);
});

// Removing the game's own copy is only safe because Windows has a better one.
test('without a usable copy in Windows the game keeps its own', async (t) => {
  const { gameDir, compiler, manifest } = game(t);
  const acted = await retireOldShaderCompiler(manifest, gameDir, gameDir, () => {}, () => OLD);
  assert.equal(acted, false, 'System32 reads as old too, so there is nothing better to fall back on');
  assert.equal(fs.existsSync(compiler), true);
  assert.deepEqual(manifest.replaced, []);
});

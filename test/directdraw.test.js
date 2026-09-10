'use strict';
// #150: Gens, Kega Fusion and the other pre-Direct3D emulators draw through
// ddraw.dll, and the scanner looked for eight names, none of them that one.
// Every such game answered "No 3D executable found" - true from the app's side,
// useless from the person's. dgVoodoo, which this app already downloads for DX8
// and DX9, translates DirectDraw too; it just was not being asked.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { writePe } = require('./fixtures/pe');
const { scanGame } = require('../src/core/scan.js');
const routes = require('../src/shared/install-routes');
const apis = require('../src/shared/rendering-api');

const temp = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swapper-ddraw-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};

test('a DirectDraw emulator is recognised instead of being called "no 3D"', async (t) => {
  const dir = temp(t);
  const exe = writePe(path.join(dir, 'Gens.exe'), { bitness: 32, text: 'DirectDrawCreateEx' });
  const scan = await scanGame(dir);
  assert.equal(scan.chosen && scan.chosen.path, exe);
  assert.equal(scan.chosen.api, 'ddraw');
  assert.equal(scan.chosen.apiLabel, 'DirectDraw');
});

test('DirectDraw is 32-bit only, because dgVoodoo ships DDraw.dll only for x86', () => {
  const target = (bitness) => ({ bitness, api: 'ddraw', apiLabel: 'DirectDraw' });
  assert.deepEqual(routes.routesFor(target(32)), ['feeder'], 'the Feeder route, like DX8');
  assert.deepEqual(routes.routesFor(target(64)), [], 'and nothing at all at 64-bit');
});

test('DirectDraw can be chosen by hand as a rendering API', () => {
  const values = apis.choices.map((c) => c.value);
  assert.ok(values.includes('ddraw'), 'it is in the override list');
  const choice = apis.choices.find((c) => c.value === 'ddraw');
  assert.equal(choice.api, 'ddraw');
  assert.equal(choice.label, 'DirectDraw');
});

test('a second ReShade hooked as ddraw.dll is now caught, not walked past', (t) => {
  const dir = temp(t);
  const compat = require('../src/core/compatibility');
  writePe(path.join(dir, 'Fusion.exe'), { bitness: 32, text: 'DirectDrawCreate' });
  // The file list that assertLoaderCompatible walks used to skip any name it
  // did not know, and ddraw.dll was not on it - so a rival hook under that
  // name was invisible to a check whose whole job is to see it.
  const names = fs.readdirSync(dir);
  const watched = /^(dxgi|ddraw|d3d8|d3d9|d3d10|d3d10core|d3d11|d3d12|opengl32)\.dll$/i;
  writePe(path.join(dir, 'ddraw.dll'), { bitness: 32 });
  assert.ok(watched.test('ddraw.dll'), 'ddraw.dll is on the watched list now');
  assert.ok(typeof compat.assertLoaderCompatible === 'function', 'and the walk that uses it is still exported');
  assert.ok(!names.includes('ddraw.dll'), 'the fixture starts without one, so the check is about the list');
});

// #232, #199, #150: "No 3D executable" came out for two entirely different
// folders - one with no game in it, and one whose engine loads its renderer
// with LoadLibrary so the executable imports no Direct3D. One message, two
// causes, and no way for the person to tell which they had.
test('a folder whose renderer lives in a DLL says so, and an empty one still says no 3D', async (t) => {
  const engine = temp(t);
  writePe(path.join(engine, 'xrEngine.exe'), { bitness: 32 });
  writePe(path.join(engine, 'xrRender_R2.dll'), { bitness: 32, text: 'Direct3DCreate9' });
  // Not in the engine-module allow list under this name, so detection still
  // fails - but the reason is now the honest one.
  const found = await scanGame(engine);
  if (!found.chosen) assert.equal(found.emptyReason, 'renderer-in-dll', 'the renderer was found, just not in the exe');

  const bare = temp(t);
  writePe(path.join(bare, 'Launcher.exe'), { bitness: 64 });
  const empty = await scanGame(bare);
  assert.equal(empty.chosen, null);
  assert.equal(empty.emptyReason, 'no-graphics-exe', 'nothing anywhere: the old answer is still the right one');
});

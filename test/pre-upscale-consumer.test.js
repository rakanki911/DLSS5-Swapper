'use strict';

// Every add-on here creates NGX feature 18 for itself, and two of them in one
// folder is a broken install rather than a rich one. Switching route already
// restores the previous install first, so the routes cannot leave two behind.
// A copy no route put there can - one added on the Add-ons page, one another
// installer left - and these cover that, plus the restore fault that switching
// back and forth exposed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { writePe } = require('./fixtures/pe');
const neuralUpstream = require('../src/core/neural-upstream');
const installRoutes = require('../src/shared/install-routes');

const RENODX = 'renodx-dlss5.addon64';
const PRE = neuralUpstream.ADDON_NAME;

// One folder, one payload, and a scan module replaced for the duration.
function stage(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-preupscale-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const gameDir = path.join(root, 'Game');
  const sourceDir = path.join(root, 'Payload');
  fs.mkdirSync(gameDir, { recursive: true });
  fs.mkdirSync(sourceDir, { recursive: true });

  const exePath = path.join(gameDir, 'game.exe');
  fs.writeFileSync(exePath, 'fake executable');
  const sourceNr = path.join(sourceDir, 'nvngx_dlssnr.dll');
  writePe(sourceNr, { text: 'neural runtime' });
  const renodxSource = path.join(sourceDir, RENODX);
  fs.writeFileSync(renodxSource, 'renodx build');
  const preSource = path.join(sourceDir, PRE);
  fs.writeFileSync(preSource, 'pre-upscale build');

  const scanPath = require.resolve('../src/core/scan');
  const applyPath = require.resolve('../src/core/apply');
  const originalScan = require.cache[scanPath];
  t.after(() => {
    delete require.cache[applyPath];
    if (originalScan) require.cache[scanPath] = originalScan;
    else delete require.cache[scanPath];
  });
  const reshade = { installed: true, file: 'dxgi.dll', kind: 'proxy', version: '6.8.0', addonSupport: true };
  require.cache[scanPath] = {
    id: scanPath, filename: scanPath, loaded: true,
    exports: {
      inspectReShade: () => reshade,
      scanGame: async () => ({ dlssFiles: [], streamlineFiles: [], reshade })
    }
  };

  const apply = require('../src/core/apply');
  const source = {
    hasNeuralRendering: true,
    addon: renodxSource,
    payload: [{ name: 'nvngx_dlssnr.dll', path: sourceNr, version: '310.8.0.0' }]
  };
  const install = (route) => apply.applySwap({
    gameDir, exePath, api: 'dxgi', bitness: 64, source, route,
    preUpscaleAddon: preSource,
    reshadeSetup: null, installReShade: true, addMissingDlss: false,
    addStreamline: false, upgradeReShade: false
  });
  const consumersInFolder = () => fs.readdirSync(gameDir).filter(neuralUpstream.isConsumer).sort();
  return { apply, gameDir, install, consumersInFolder };
}

test('the pre-upscale route retires a consumer it finds, and Restore brings it back', async (t) => {
  const { apply, gameDir, install, consumersInFolder } = stage(t);

  // Not ours and not any route's: a build the person installed themselves.
  fs.writeFileSync(path.join(gameDir, RENODX), 'the build they already had');

  const manifest = await install('preupscale');

  assert.equal(manifest.route, 'preupscale');
  assert.deepEqual(consumersInFolder(), [PRE], 'exactly one consumer is left behind');
  assert.equal(fs.readFileSync(path.join(gameDir, PRE), 'utf8'), 'pre-upscale build');
  assert.ok(manifest.replaced.some((row) => row.rel === RENODX && row.kind === 'consumer'),
    'the retired build is recorded as replaced, not as one of ours to delete');

  await apply.restore(gameDir);
  assert.equal(fs.readFileSync(path.join(gameDir, RENODX), 'utf8'), 'the build they already had');
  assert.equal(fs.existsSync(path.join(gameDir, PRE)), false);
});

test('the ordinary route retires the pre-upscale add-on the same way', async (t) => {
  const { gameDir, install, consumersInFolder } = stage(t);

  await install('preupscale');
  assert.deepEqual(consumersInFolder(), [PRE]);

  const manifest = await install('native');
  assert.equal(manifest.route, 'native');
  assert.deepEqual(consumersInFolder(), [RENODX], 'the folder never holds both');
});

test('switching back and forth gives their own add-on back, rather than deleting it', async (t) => {
  const { apply, gameDir, install, consumersInFolder } = stage(t);

  fs.writeFileSync(path.join(gameDir, RENODX), 'the build they already had');

  // Retired by the first install, written again by the second while nothing was
  // at that path, retired once more by the third. Without the guard in
  // rememberAdded that path is both a replacement and one of ours to delete,
  // and Restore hands their file back and removes it a moment later.
  await install('preupscale');
  await install('native');
  const manifest = await install('preupscale');

  assert.equal(manifest.added.includes(RENODX), false,
    'a path we hold an original for is never ours to delete');

  await apply.restore(gameDir);
  assert.equal(fs.readFileSync(path.join(gameDir, RENODX), 'utf8'), 'the build they already had');
  assert.deepEqual(consumersInFolder(), [RENODX]);
});

test('a read-only copy left by an earlier install is still moved out of the way', async (t) => {
  const { gameDir, install, consumersInFolder } = stage(t);

  const rival = path.join(gameDir, RENODX);
  fs.writeFileSync(rival, 'locked build');
  fs.chmodSync(rival, 0o444);

  await install('preupscale');
  assert.deepEqual(consumersInFolder(), [PRE]);
});

test('the route refuses rather than installing the wrong add-on', async (t) => {
  const { gameDir, install } = stage(t);
  const apply = require('../src/core/apply');
  await assert.rejects(
    () => apply.applySwap({
      gameDir, exePath: path.join(gameDir, 'game.exe'), api: 'dxgi', bitness: 64,
      route: 'preupscale', preUpscaleAddon: null,
      source: { hasNeuralRendering: true, addon: null, payload: [] },
      reshadeSetup: null, installReShade: true, addMissingDlss: false,
      addStreamline: false, upgradeReShade: false
    }),
    (error) => error.code === 'errNoNeuralUpstream'
  );
  void install;
});

test('the file name is the whole reason it works, so it is not a preference', () => {
  // The DLSS-NR snippet tests the calling module's own path for the substring
  // "nvngx.dll" and refuses anything else with 0xBAD00002. Renaming the add-on
  // does not rename a setting, it turns the feature off.
  assert.equal(PRE, 'nvngx.dll.addon64');
  assert.ok(PRE.toLowerCase().includes('nvngx.dll'));
  assert.ok(neuralUpstream.RELEASE.url.endsWith('/' + PRE),
    'the release asset is downloaded under the only name that works');
  assert.equal(neuralUpstream.CONSUMERS[PRE], 'pre');
});

test('the route is offered only where there is an upscale to run ahead of', () => {
  const dx12 = { bitness: 64, api: 'dxgi', apiLabel: 'DirectX 12', hasNativeDlss: true };
  assert.ok(installRoutes.routesFor(dx12).includes('preupscale'));
  assert.equal(installRoutes.routesFor({ ...dx12, hasNativeDlss: false }).includes('preupscale'), false,
    'a game reached through the Feeder renders at native');
  assert.equal(installRoutes.routesFor({ ...dx12, apiLabel: 'DirectX 11' }).includes('preupscale'), false);
  assert.equal(installRoutes.routesFor({ ...dx12, bitness: 32 }).includes('preupscale'), false);
  assert.equal(installRoutes.routesFor({ ...dx12, emulator: { key: 'pcsx2' } }).includes('preupscale'), false);
});

test('the route can keep its own settings, like every other route', () => {
  // profileFile names the profile after the route and refuses any route not on
  // its list, and the comment above it says what that costs: an install that
  // fails with nothing but "Invalid route".
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'backend-manager.js'), 'utf8');
  assert.match(source, /\[[^\]]*'preupscale'[^\]]*\]\.includes\(route\)/);
});

test('what counts as a consumer is a closed list, not a guess about file names', () => {
  assert.ok(neuralUpstream.isConsumer('RenoDX-DLSS5.Addon64'), 'the match ignores case');
  assert.ok(neuralUpstream.isConsumer('renodx-dlss.addon64'), 'ShortFuse’s DLSS Tool counts too');
  assert.equal(neuralUpstream.isConsumer('dlss5-feed.addon64'), false, 'Feeder supplies inputs, it does not create the feature');
  assert.equal(neuralUpstream.isConsumer('dlss5-lab-overlay.addon64'), false);
  assert.equal(neuralUpstream.isConsumer('someone-elses.addon64'), false);
});

test('a missing folder is no rivals, not a crash', () => {
  assert.deepEqual(neuralUpstream.rivalConsumers(path.join(os.tmpdir(), 'no-such-folder-' + Date.now()), PRE), []);
});

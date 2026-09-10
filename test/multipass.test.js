'use strict';
// #251: ShortFuse's DLSS Tool build carries DirectNeuralRenderingPassCount -
// the neural pass run more than once per frame. It is not an add-on somebody
// drops in beside the ordinary one: it REPLACES it, and loading both leaves
// the tickbox saying the pass is on while the picture says otherwise.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { writePe } = require('./fixtures/pe');

const temp = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swapper-multipass-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};

test('the payload knows where the multipass consumer lives', (t) => {
  const root = temp(t);
  const host = path.join(root, 'feeder', 'host64');
  fs.mkdirSync(host, { recursive: true });
  fs.writeFileSync(path.join(host, 'renodx-dlss5.addon64'), 'a');
  fs.writeFileSync(path.join(host, 'renodx-dlss.addon64'), 'b');
  const { scanSource } = require('../src/core/scan.js');
  const source = scanSource(root);
  assert.ok(String(source.feeder.hostAddon).endsWith('renodx-dlss5.addon64'));
  assert.ok(String(source.feeder.multipassAddon).endsWith('renodx-dlss.addon64'),
    'and the new one has its own path, not a guess made at install time');
  assert.notEqual(source.feeder.hostAddon, source.feeder.multipassAddon);
});

test('a payload built without it still describes a working install', (t) => {
  const root = temp(t);
  const host = path.join(root, 'feeder', 'host64');
  fs.mkdirSync(host, { recursive: true });
  fs.writeFileSync(path.join(host, 'renodx-dlss5.addon64'), 'a');
  const { scanSource } = require('../src/core/scan.js');
  const source = scanSource(root);
  assert.ok(source.feeder.multipassAddon, 'the path is always named');
  assert.equal(fs.existsSync(source.feeder.multipassAddon), false,
    'but the file is absent, and the route is offered only when it is there');
});

test('the two consumers have different names, so one can never overwrite the other', () => {
  assert.notEqual('renodx-dlss.addon64', 'renodx-dlss5.addon64');
  const apply = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'apply.js'), 'utf8');
  // One add-on is copied, chosen once, and the same variable is what gets
  // written into ReShade.ini - so the file installed and the file enabled
  // cannot drift apart.
  assert.match(apply, /const addonSource = multipass \? source\.feeder\.multipassAddon : source\.addon;/);
  assert.match(apply, /const addonName = path\.basename\(addonSource\);/);
});

test('the route follows what the add-on says it presents on', () => {
  const routes = require('../src/shared/install-routes');
  // "Present supports D3D9, D3D11, and D3D12 presentation. D3D9 and D3D11 use
  // a same-adapter, device-only D3D12 endpoint." - so both DXGI labels, and
  // DX11 especially: that is where the games with no DLSS of their own are.
  for (const label of ['DirectX 12', 'DirectX 11']) {
    const list = routes.routesFor({ bitness: 64, api: 'dxgi', apiLabel: label, hasNativeDlss: true });
    assert.ok(list.includes('renodx'), label + ': ' + list);
  }
  assert.ok(routes.routesFor({ bitness: 64, api: 'd3d9', apiLabel: 'DirectX 9' }).includes('renodx'),
    'and D3D9, which it presents on through its own D3D12 endpoint');

  // And nowhere it cannot go: the add-on is 64-bit, emulators are excluded as
  // they are for the native route, DX10 has no route at all, and D3D9 reaches
  // modern hardware through dgVoodoo here rather than through this.
  for (const target of [
    { bitness: 32, api: 'dxgi', apiLabel: 'DirectX 12' },
    { bitness: 64, api: 'dxgi', apiLabel: 'DirectX 12', emulator: { name: 'x' } },
    { bitness: 64, api: 'dxgi', apiLabel: 'DirectX 10' },
    { bitness: 32, api: 'd3d9' },
    { bitness: 32, api: 'ddraw' }
  ]) {
    assert.ok(!routes.routesFor(target).includes('renodx'), JSON.stringify(target));
  }
});


// "failed: Invalid route" on a DX11 game. Every route keeps its own settings
// in a file named after it, and the writer refused a name it did not know -
// so a route could be offered, chosen, and then rejected at install with no
// clue why. The list that decides is one line, and it had not been updated.
test('the route can keep its own settings, like every other route', () => {
  const backends = require('../src/core/backend-manager');
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'backend-manager.js'), 'utf8');
  assert.match(source, /\['native', 'feeder', 'optiscaler', 'renodx'\]\.includes\(route\)/,
    'renodx is on the list profileFile checks');
  assert.ok(typeof backends.saveProfile === 'function' && typeof backends.loadProfile === 'function');
});

test('nothing treats the route as OptiScaler, which has a different installer', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'backend-manager.js'), 'utf8');
  // Every optiscaler branch is an equality test, so renodx falls through to
  // applySwap - the same path the native route takes, which is the shape the
  // DLSS Tool installs in.
  assert.doesNotMatch(source, /route !== 'native'/, 'and nothing narrows applySwap to native by name');
  assert.match(source, /config\.route === 'optiscaler'/);
});

// The panel does not attach on this route. It was tried, and driving the DLSS
// Tool through it did not work in a real game; the route itself does, and the
// tool's own page on Home is where its controls live.
test('the panel does not claim this route', () => {
  const overlay = require('../src/game-overlay');
  for (const label of ['DirectX 11', 'DirectX 12']) {
    const list = overlay.routes({ bitness: 64, api: 'dxgi', apiLabel: label });
    assert.ok(!list.includes('renodx'), label + ': ' + list);
    assert.deepEqual(list, ['native', 'feeder'], 'and the routes it does carry are untouched');
  }
});

// Nothing is written into the add-on's own configuration. Every value this app
// set from the outside turned out worse than the one the add-on chose: forcing
// Hook Method to Present stopped the neural pass in a game that has DLSS, and
// forcing Require DLSS off did not help either. It ships as its author shipped
// it, and it writes its own file on first run.
test('the installer never edits the add-on’s settings', () => {
  const apply = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'apply.js'), 'utf8');
  assert.doesNotMatch(apply, /DirectNeuralRendering/, 'not one of its keys');
  assert.doesNotMatch(apply, /RENODX-DLSS/, 'nor its section');
  assert.doesNotMatch(apply, /configureMultipass/, 'and the function that did it is gone');
});

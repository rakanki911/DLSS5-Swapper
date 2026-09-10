'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { routesFor, recommendedRoute } = require('../src/shared/install-routes');

test('SWTOR x64 DX9 always uses Feeder even with old injected DLSS DLLs', () => {
  const chosen = { bitness: 64, api: 'd3d9', apiLabel: 'DirectX 9' };
  // The DLSS Tool joins it here: it presents on D3D9 through its own D3D12
  // endpoint rather than through dgVoodoo. Feeder is still what a DX9 game
  // gets recommended, and still the only route with the translation layer.
  assert.deepEqual(routesFor(chosen), ['feeder', 'renodx']);
  assert.equal(recommendedRoute({ chosen, primaryDlss: { rel: 'nvngx_dlss.dll' }, install: { route: 'native' } }), 'feeder');
});
test('DX8 x86 and DX11 use Feeder; native DX10 is not falsely supported', () => {
  assert.deepEqual(routesFor({ bitness: 32, api: 'd3d8' }), ['feeder']);
  assert.deepEqual(routesFor({ bitness: 64, api: 'd3d8' }), []);
  assert.deepEqual(routesFor({ bitness: 64, api: 'dxgi', apiLabel: 'DirectX 11' }), ['feeder', 'renodx']);
  for (const bitness of [32, 64]) {
    assert.deepEqual(routesFor({ bitness, api: 'd3d10' }), []);
    assert.deepEqual(routesFor({ bitness, api: 'dxgi', apiLabel: 'DirectX 10' }), []);
  }
});
test('real native DX12 stays available; injected DLLs never select native by themselves', () => {
  const chosen = { bitness: 64, api: 'dxgi', apiLabel: 'DirectX 12' };
  const primaryDlss = { rel: 'Engine\\nvngx_dlss.dll' };
  assert.deepEqual(routesFor(chosen), ['native', 'feeder', 'renodx']);
  assert.equal(recommendedRoute({ chosen, primaryDlss }), 'native');
  assert.equal(recommendedRoute({ chosen, primaryDlss, install: { added: ['engine/nvngx_dlss.dll'] } }), 'feeder');
  assert.deepEqual(routesFor({ ...chosen, emulator: { key: 'xenia' } }), ['feeder']);
});

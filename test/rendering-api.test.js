'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const api = require('../src/shared/rendering-api');
const routes = require('../src/shared/install-routes');
const compatibility = require('../src/core/compatibility');
const { projectUrl } = require('../src/core/project-links');
const { writePe } = require('./fixtures/pe');

test('automatic uses detection, not the first advertised API or an installed backend', () => {
  const target = { api: 'opengl', apiLabel: 'OpenGL', bitness: 32,
    apiChoices: [{ api: 'd3d9', label: 'DirectX 9' }] };
  assert.deepEqual(api.resolve(target), { api: 'opengl', label: 'OpenGL' });
  const wow = api.effective(target, 'd3d9');
  assert.deepEqual(routes.routesFor(wow), ['feeder']);
  assert.equal(wow.apiLabel, 'DirectX 9');
  assert.equal(target.api, 'opengl', 'manual override never changes detection');
  assert.equal(api.effective(target, 'auto').api, 'opengl');
});

test('manual DX11/DX12 use dxgi but route eligibility follows the selected label', () => {
  for (const detected of ['OpenGL', 'DirectX 10', 'DirectX 12']) {
    const target = { api: detected === 'OpenGL' ? 'opengl' : 'dxgi', apiLabel: detected, bitness: 64, hasNativeDlss: true };
    const dx11 = api.effective(target, 'd3d11');
    const dx12 = api.effective(target, 'd3d12');
    assert.equal(dx11.api, 'dxgi');
    assert.equal(dx12.api, 'dxgi');
    assert.deepEqual(routes.routesFor(dx11), ['feeder', 'optiscaler', 'renodx']);
    assert.deepEqual(routes.routesFor(dx12), ['native', 'feeder', 'optiscaler', 'renodx']);
    assert.deepEqual(routes.routesFor(api.effective(target, 'd3d10')), []);
    assert.deepEqual(routes.routesFor(api.effective(target, 'vulkan')), ['feeder', 'optiscaler']);
  }
  assert.deepEqual(routes.routesFor(api.effective({ bitness: 32 }, 'd3d12')), ['feeder']);
  assert.deepEqual(routes.routesFor(api.effective({ bitness: 64, emulator: {} }, 'd3d12')), ['feeder']);
});

test('selection is an allowlist; all displayed choices resolve and unknown values fail', () => {
  for (const choice of api.choices) {
    assert.equal(api.valid(choice.value), true);
    assert.deepEqual(api.resolve({}, choice.value), { api: choice.api, label: choice.label });
  }
  for (const invalid of ['', 'DX12', {}, 12, '../vulkan', '__proto__']) {
    assert.equal(api.valid(invalid), false);
    assert.throws(() => api.resolve({}, invalid), { code: 'errApiChoice' });
  }
  assert.equal(api.valid('auto'), true);
});

test('Vulkan keeps identified DXVK proxies while unknown, wrong-bitness and DirectX conflicts remain blocked', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swapper-vulkan-wrapper-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const bitness of [32, 64]) {
    const dir = path.join(root, String(bitness));
    const exePath = writePe(path.join(dir, 'Game.exe'), { bitness });
    const wrappers = ['d3d9.dll', 'dxgi.dll', 'd3d10core.dll'].map(name =>
      writePe(path.join(dir, name), { bitness, text: 'DXVK vkGetInstanceProcAddr' }));
    const before = wrappers.map(file => fs.readFileSync(file));
    const config = { gameDir: dir, exePath, bitness, route: 'feeder', api: 'vulkan' };
    assert.doesNotThrow(() => compatibility.assertLoaderCompatible(config));
    assert.throws(() => compatibility.assertLoaderCompatible({ ...config, api: 'd3d9' }), { code: 'errLoaderConflict' });
    wrappers.forEach((file, i) => assert.deepEqual(fs.readFileSync(file), before[i]));
    for (const options of [{ bitness, text: 'unknown wrapper' }, { bitness: bitness === 64 ? 32 : 64, text: 'DXVK vkGetInstanceProcAddr' }, { bitness, text: 'ReShade DXVK vkGetInstanceProcAddr' }]) {
      writePe(wrappers[0], options);
      assert.throws(() => compatibility.assertLoaderCompatible(config), { code: 'errLoaderConflict' });
    }
  }
});

test('About links only open the project and its latest releases', () => {
  assert.equal(projectUrl('github'), 'https://github.com/rakanki911/DLSS5-Swapper');
  assert.equal(projectUrl('releases'), 'https://github.com/rakanki911/DLSS5-Swapper/releases/latest');
  for (const key of ['__proto__', 'constructor', 'file:///C:/Windows', 'javascript:alert(1)', 'https://example.com', null, {}]) assert.equal(projectUrl(key), null);
});

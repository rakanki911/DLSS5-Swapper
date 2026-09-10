'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const scan = require('../src/core/scan');
const routes = require('../src/shared/install-routes');
const renderingApi = require('../src/shared/rendering-api');

function settings(dir, api) {
  const file = path.join(dir, 'system.xml');
  fs.writeFileSync(file, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rage__fwuiGraphicsConfig>',
    '  <version value="13"/>',
    api === null ? '  <!-- no API element -->' : `  <API>${api}</API>`,
    '  <screenWidth value="3440"/>',
    '</rage__fwuiGraphicsConfig>'
  ].join('\r\n'));
  return file;
}

test('RDR2 is reported as Vulkan when the game itself is set to Vulkan', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rdr2-settings-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const vulkan = settings(dir, 'kSettingAPI_Vulkan');
  assert.deepEqual(scan.rdr2Renderer([vulkan]), { api: 'vulkan', label: 'Vulkan' });

  const dx12 = settings(dir, 'kSettingAPI_DX12');
  assert.deepEqual(scan.rdr2Renderer([dx12]), { api: 'dxgi', label: 'DirectX 12' });
});

test('an unreadable, absent or unfamiliar RDR2 setting keeps DirectX 12', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rdr2-fallback-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const dx12 = { api: 'dxgi', label: 'DirectX 12' };
  assert.deepEqual(scan.rdr2Renderer([path.join(dir, 'missing.xml')]), dx12);
  assert.deepEqual(scan.rdr2Renderer([settings(dir, null)]), dx12);
  assert.deepEqual(scan.rdr2Renderer([settings(dir, 'kSettingAPI_Something')]), dx12);
  // A directory in place of the file must not throw either.
  assert.deepEqual(scan.rdr2Renderer([dir]), dx12);
  assert.deepEqual(scan.rdr2Renderer([]), dx12);
});

test('the Vulkan renderer reaches the profile, the routes and the API override', () => {
  const vulkan = () => ({ api: 'vulkan', label: 'Vulkan' });
  const profile = scan.gameApiProfile('D:/Games/RDR2/RDR2.exe', vulkan);
  assert.equal(profile.detected.api, 'vulkan');
  assert.equal(profile.detected.via, 'game-profile');
  // Both renderers stay selectable whichever one the game is set to, so the
  // choice is never taken away from the person.
  assert.deepEqual(profile.choices.map(c => c.label), ['DirectX 12', 'Vulkan']);
  assert.equal(scan.gameApiProfile('D:/Games/Other/Other.exe', vulkan), null);

  const target = { path: 'D:/Games/RDR2/RDR2.exe', bitness: 64, api: profile.detected.api, apiLabel: profile.detected.label };
  assert.deepEqual(routes.routesFor(target), ['feeder']);
  // Automatic follows the game; an explicit choice still wins over it.
  assert.equal(renderingApi.effective(target, 'auto').apiLabel, 'Vulkan');
  assert.equal(renderingApi.effective(target, 'd3d12').apiLabel, 'DirectX 12');
  assert.deepEqual(routes.routesFor(renderingApi.effective(target, 'd3d12')), ['native', 'feeder', 'renodx']);
});

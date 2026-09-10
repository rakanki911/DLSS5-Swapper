'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { scanGame } = require('../src/core/scan');
const routes = require('../src/shared/install-routes');
const { writePe } = require('./fixtures/pe');

function game(t, name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), name));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('a game running through DXVK is reported as Vulkan, not DirectX', async (t) => {
  const dir = game(t, 'scan-dxvk-');
  writePe(path.join(dir, 'Game.exe'), { bitness: 64, text: 'Direct3DCreate9', imports: ['d3d9.dll'] });
  writePe(path.join(dir, 'd3d9.dll'), { bitness: 64, dll: true, text: 'DXVK vkGetInstanceProcAddr' });
  writePe(path.join(dir, 'nvngx_dlss.dll'), { bitness: 64, dll: true });

  const scan = await scanGame(dir);
  assert.equal(scan.chosen.apiLabel, 'Vulkan');
  assert.equal(scan.chosen.api, 'vulkan');
  assert.equal(scan.chosen.via, 'vulkan-wrapper');
  assert.equal(scan.chosen.dx12, false);
  // The renderer the executable itself names stays selectable, for a wrapper
  // that is present but not in use.
  assert.deepEqual(scan.chosen.apiChoices.map(c => c.label), ['Vulkan', 'DirectX 9']);
  assert.deepEqual(routes.routesFor(scan.chosen), ['feeder']);
});

test('the same game without the wrapper stays DirectX', async (t) => {
  const dir = game(t, 'scan-plain-d3d9-');
  writePe(path.join(dir, 'Game.exe'), { bitness: 64, text: 'Direct3DCreate9', imports: ['d3d9.dll'] });
  writePe(path.join(dir, 'nvngx_dlss.dll'), { bitness: 64, dll: true });

  const scan = await scanGame(dir);
  assert.equal(scan.chosen.apiLabel, 'DirectX 9');
  assert.notEqual(scan.chosen.via, 'vulkan-wrapper');
});

test("ReShade's own proxy of the same name is not mistaken for a wrapper", async (t) => {
  const dir = game(t, 'scan-reshade-proxy-');
  writePe(path.join(dir, 'Game.exe'), { bitness: 64, text: 'D3D12CreateDevice', imports: ['d3d12.dll'] });
  // ReShade installed as dxgi.dll: it mentions Vulkan entry points too, and
  // reading it as a wrapper would move an installed game to the wrong route.
  writePe(path.join(dir, 'dxgi.dll'), { bitness: 64, dll: true, text: 'ReShade DXVK vkGetInstanceProcAddr' });

  const scan = await scanGame(dir);
  assert.equal(scan.chosen.apiLabel, 'DirectX 12');
  assert.equal(scan.chosen.dx12, true);
});

test('a 32-bit wrapper beside a 64-bit game is not the wrapper for it', async (t) => {
  const dir = game(t, 'scan-mixed-bitness-');
  writePe(path.join(dir, 'Game.exe'), { bitness: 64, text: 'Direct3DCreate9', imports: ['d3d9.dll'] });
  writePe(path.join(dir, 'd3d9.dll'), { bitness: 32, dll: true, text: 'DXVK vkGetInstanceProcAddr' });

  const scan = await scanGame(dir);
  assert.equal(scan.chosen.apiLabel, 'DirectX 9');
});

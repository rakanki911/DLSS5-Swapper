'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const opti = require('../src/core/optiscaler');
const routes = require('../src/shared/install-routes');
const guards = require('../src/core/install-guards');
const ini = require('../src/core/feeder-config');

test('OptiScaler is optional, gated by real DLSS, architecture and API', () => {
  const target = { bitness: 64, api: 'dxgi', apiLabel: 'DirectX 12', hasNativeDlss: true };
  assert.deepEqual(routes.routesFor(target), ['native', 'feeder', 'optiscaler', 'renodx', 'preupscale']);
  assert.equal(routes.recommendedRoute({ chosen: target, primaryDlss: { rel: 'nvngx_dlss.dll' } }), 'native');
  for (const delta of [{ bitness: 32 }, { hasNativeDlss: false }, { emulator: { key: 'xenia' } }, { api: 'd3d9' }, { api: 'd3d8' }, { api: 'opengl' }, { apiLabel: 'DirectX 10' }]) {
    assert.equal(routes.routesFor({ ...target, ...delta }).includes('optiscaler'), false);
  }
  assert.equal(routes.routesFor({ ...target, apiLabel: 'DirectX 11' }).includes('optiscaler'), true);
  assert.equal(routes.routesFor({ ...target, api: 'vulkan' }).includes('optiscaler'), true);
  assert.equal(routes.nativeDlssPresent({ primaryDlss: { rel: 'nvngx_dlss.dll' }, install: { added: ['NVNGX_DLSS.DLL'] } }), false);
});

test('OptiScaler configuration arms NR but preserves unrelated preferences', () => {
  const text = '[DlssNr]\nEnabled=false\nIntensity=0.65\n[FrameGen]\nEnabled=false\n[Upscalers]\nDx11Upscaler=dlss\n[Other]\nSetting=keep\n';
  const target = { exePath: 'C:\\Games\\Actual Game.exe', api: 'dxgi', apiLabel: 'DirectX 11' };
  const configured = opti.configure(text, target);
  assert.equal(ini.getIni(configured, 'DlssNr', 'Enabled'), 'true');
  assert.equal(ini.getIni(configured, 'DlssNr', 'Intensity'), '0.65');
  assert.equal(ini.getIni(configured, 'Upscalers', 'Dx11Upscaler'), 'ffx_12');
  assert.equal(ini.getIni(configured, 'FrameGen', 'Enabled'), 'false');
  assert.equal(ini.getIni(configured, 'Other', 'Setting'), 'keep');
  assert.equal(ini.getIni(configured, 'Plugins', 'LoadAsiPlugins'), 'false');
  assert.equal(opti.configure(configured, target), configured);
  assert.equal(ini.getIni(opti.configure('', { ...target, api: 'vulkan' }), 'Upscalers', 'VulkanUpscaler'), 'ffx_12');
  assert.equal(ini.getIni(opti.configure('', { ...target, apiLabel: 'DirectX 12' }), 'Upscalers', 'Dx12Upscaler'), 'dlss');
});

test('GPU requirements and process guards reject known unsupported/running targets', async () => {
  assert.equal(guards.gpuSupported([{ name: 'NVIDIA GeForce RTX 5090', driver: '616.56' }]), true);
  assert.equal(guards.gpuSupported([{ name: 'NVIDIA GeForce RTX 5090 Laptop GPU', driver: '617.00' }]), true);
  assert.equal(guards.gpuSupported([{ name: 'NVIDIA GeForce RTX 4090', driver: '617.00' }]), false);
  assert.equal(guards.gpuSupported([{ name: 'NVIDIA GeForce RTX 5090', driver: '616.55' }]), false);
  // The card is refused; an older driver is only a warning, so the install path
  // asks these two separately.
  assert.equal(guards.gpuModelSupported([{ name: 'NVIDIA GeForce RTX 5090', driver: '610.00' }]), true);
  assert.equal(guards.driverSupported([{ name: 'NVIDIA GeForce RTX 5090', driver: '610.00' }]), false);
  assert.equal(guards.gpuModelSupported([{ name: 'NVIDIA GeForce RTX 4090', driver: '617.00' }]), false);
  assert.equal(guards.driverSupported([{ name: 'NVIDIA GeForce RTX 5080', driver: '617.00' }]), true);
  // The driver range upstream measured faulting inside NVIDIA's neural runtime
  // is a warning of its own, independent of the OptiScaler requirements.
  assert.equal(guards.driverNeuralFault([{ name: 'NVIDIA GeForce RTX 5090', driver: '616.56' }]), false);
  assert.equal(guards.driverNeuralFault([{ name: 'NVIDIA GeForce RTX 5090', driver: '616.64' }]), true);
  assert.equal(guards.driverNeuralFault([{ name: 'NVIDIA GeForce RTX 4070', driver: '616.86' }]), true);
  assert.equal(guards.driverNeuralFault([{ name: 'NVIDIA GeForce RTX 5090', driver: '610.00' }]), false);
  assert.equal(guards.driverNeuralFault(null), false);
  assert.equal(guards.driverNames([{ name: 'RTX 5090', driver: '616.64' }]), 'RTX 5090 - 616.64');
  // Blackwell is the requirement, not the name: the professional boards report
  // themselves as "RTX PRO 6000 Blackwell" and were refused for not being 50xx.
  assert.equal(guards.gpuModelSupported([{ name: 'NVIDIA RTX PRO 6000 Blackwell Workstation Edition', driver: '616.56' }]), true);
  assert.equal(guards.gpuModelSupported([{ name: 'NVIDIA RTX PRO 5000 Blackwell', driver: '616.56' }]), true);
  assert.equal(guards.driverSupported([{ name: 'NVIDIA RTX PRO 6000 Blackwell', driver: '616.56' }]), true);
  // An older professional card of the same family name is still refused.
  assert.equal(guards.gpuModelSupported([{ name: 'NVIDIA RTX PRO 6000 Ada Generation', driver: '617.00' }]), false);
  assert.equal(guards.gpuModelSupported([{ name: 'NVIDIA RTX A6000', driver: '617.00' }]), false);
  const root = path.resolve('test-fixture-game');
  const game = path.join(root, 'Game.exe');
  const rows = [{ Name: 'Game.exe', ExecutablePath: game, ProcessId: -1 }, { Name: 'Game.exe', ExecutablePath: null, ProcessId: -2 }, { Name: 'Other.exe', ExecutablePath: path.resolve('elsewhere', 'Other.exe'), ProcessId: -3 }];
  assert.equal(guards.matchingProcesses(rows, root, game).length, 2);
  await assert.rejects(guards.assertGameClosed(root, game, async () => JSON.stringify(rows)), { code: 'errGameRunning' });
  // When the process list cannot be read - PowerShell restricted, a cold WMI
  // call past its timeout - the executable itself is asked instead. A file
  // that opens for writing is not a running game, and the install proceeds;
  // refusing there is what stopped people with a closed game from installing.
  const unavailable = async () => { throw new Error('Access denied'); };
  await guards.assertGameClosed(root, game, unavailable, () => false);
  await assert.rejects(guards.assertGameClosed(root, game, unavailable, () => true), { code: 'errGameRunning' });
  await guards.assertGameClosed(root, game, async () => '[]');
});

test('unmanaged proxies and ASI loaders are refused; anti-cheat detection remains available for warnings', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opti-guard-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'dxgi.dll'), 'another mod');
  assert.throws(() => opti.checkConflicts(dir, path.join(dir, 'Game.exe'), null, 'dxgi'), { code: 'errOptiConflict' });
  assert.equal(fs.readFileSync(path.join(dir, 'dxgi.dll'), 'utf8'), 'another mod');
  fs.unlinkSync(path.join(dir, 'dxgi.dll'));
  fs.writeFileSync(path.join(dir, 'OtherMod.asi'), 'user loader');
  assert.throws(() => opti.checkConflicts(dir, path.join(dir, 'Game.exe'), null, 'dxgi'), { code: 'errOptiConflict' });
  fs.mkdirSync(path.join(dir, 'EasyAntiCheat'));
  assert.equal(guards.antiCheatPresent(dir), true);
});

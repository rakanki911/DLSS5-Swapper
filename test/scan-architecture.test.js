'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pe = require('../src/core/pe');
const { scanGame } = require('../src/core/scan');
const { recommendedRoute } = require('../src/shared/install-routes');

function minimalPe(file, { bitness = 32, marker = null } = {}) {
  const buf = Buffer.alloc(marker ? 300 * 1024 : 64 * 1024);
  buf.writeUInt16LE(0x5a4d, 0); // MZ
  buf.writeUInt32LE(0x80, 0x3c);
  buf.writeUInt32LE(0x00004550, 0x80); // PE\0\0
  buf.writeUInt16LE(bitness === 64 ? 0x8664 : 0x014c, 0x84);
  buf.writeUInt16LE(0, 0x86); // sections
  buf.writeUInt16LE(bitness === 64 ? 240 : 224, 0x94);
  buf.writeUInt16LE(bitness === 64 ? 0x20b : 0x10b, 0x98);
  if (marker) buf.write(marker, 0x1000, 'ascii');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
}

function minimalPe32(file, marker = null) {
  minimalPe(file, { bitness: 32, marker });
}

test('DX8 games, SWTOR x64 DX9 and unsupported DX10 retain their real API', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-legacy-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [name, bitness, marker, api] of [
    ['LegacyDX8', 32, 'Direct3DCreate8', 'd3d8'],
    ['swtor', 64, 'Direct3DCreate9', 'd3d9'],
    ['LegacyDX10', 32, 'D3D10CreateDevice', 'd3d10']
  ]) {
    const dir = path.join(root, name);
    minimalPe(path.join(dir, name + '.exe'), { bitness, marker });
    const scan = await scanGame(dir);
    assert.equal(scan.chosen.api, api);
    assert.equal(scan.chosen.bitness, bitness);
  }
});

test('Far Cry 3-style D3D11 executable is found and identified as 32-bit', async (t) => {
  const gameDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-fc3-'));
  t.after(() => fs.rmSync(gameDir, { recursive: true, force: true }));

  const exe = path.join(gameDir, 'farcry3_d3d11.exe');
  minimalPe32(exe);

  assert.equal(pe.getBitness(exe), 32);
  const scan = await scanGame(gameDir);
  assert.ok(scan.chosen);
  assert.equal(scan.chosen.path, exe);
  assert.equal(scan.chosen.api, 'dxgi');
  assert.equal(scan.chosen.apiLabel, 'DirectX 11');
  assert.equal(scan.chosen.via, 'filename');
  assert.equal(scan.chosen.bitness, 32);
});

test('explicit legacy renderer suffixes preserve DX8 and unsupported DX10', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-api-suffix-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const api of ['d3d8', 'd3d10']) {
    const dir = path.join(root, api);
    minimalPe32(path.join(dir, `game_${api}.exe`));
    const scan = await scanGame(dir);
    assert.equal(scan.chosen.api, api);
    assert.equal(scan.chosen.via, 'filename');
  }
});

test('scanning keeps injected DLL provenance for route recommendation', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-injected-route-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  minimalPe(path.join(dir, 'game.exe'), { bitness: 64, marker: 'D3D12CreateDevice' });
  minimalPe(path.join(dir, 'nvngx_dlss.dll'), { bitness: 64 });
  fs.mkdirSync(path.join(dir, '_DLSS5_Backup'));
  fs.writeFileSync(path.join(dir, '_DLSS5_Backup', 'manifest.json'), JSON.stringify({
    route: 'native', added: ['nvngx_dlss.dll', null], game: { bitness: 64, api: 'dxgi' }
  }));
  const scan = await scanGame(dir);
  assert.deepEqual(scan.install.added, ['nvngx_dlss.dll']);
  assert.equal(recommendedRoute(scan), 'feeder');
});

test('Deus Ex Human Revolution DX11 executable enters the 32-bit feeder route', async (t) => {
  const gameDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-dxhr-'));
  t.after(() => fs.rmSync(gameDir, { recursive: true, force: true }));

  const exe = path.join(gameDir, 'DXHRDC.exe');
  minimalPe32(exe, 'D3D11CreateDevice');
  const scan = await scanGame(gameDir);

  assert.ok(scan.chosen);
  assert.equal(scan.chosen.path, exe);
  assert.equal(scan.chosen.api, 'dxgi');
  assert.equal(scan.chosen.apiLabel, 'DirectX 11');
  assert.equal(scan.chosen.bitness, 32);
});

test('Batman and Dishonored executables are detected as 32-bit game targets', async (t) => {
  const fixtures = [
    {
      title: 'Batman Arkham Asylum',
      rel: path.join('Batman Arkham Asylum GOTY', 'Binaries', 'ShippingPC-BmGame.exe'),
      marker: 'Direct3DCreate9', api: 'd3d9', label: 'DirectX 9'
    },
    {
      title: 'Batman Arkham Origins',
      rel: path.join('Batman Arkham Origins', 'SinglePlayer', 'Binaries', 'Win32', 'BatmanOrigins.exe'),
      marker: 'D3D11CreateDevice', api: 'dxgi', label: 'DirectX 11'
    },
    {
      title: 'Dishonored',
      rel: path.join('Dishonored', 'Binaries', 'Win32', 'Dishonored.exe'),
      marker: 'Direct3DCreate9', api: 'd3d9', label: 'DirectX 9'
    }
  ];

  for (const fixture of fixtures) {
    await t.test(fixture.title, async (tt) => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-x86-game-'));
      tt.after(() => fs.rmSync(root, { recursive: true, force: true }));
      const gameDir = path.join(root, fixture.rel.split(path.sep)[0]);
      const exe = path.join(root, fixture.rel);
      minimalPe32(exe, fixture.marker);

      const scan = await scanGame(gameDir);
      assert.ok(scan.chosen);
      assert.equal(scan.chosen.path, exe);
      assert.equal(scan.chosen.bitness, 32);
      assert.equal(scan.chosen.api, fixture.api);
      assert.equal(scan.chosen.apiLabel, fixture.label);
    });
  }
});

test('Dying Light The Beast Agility SDK executable is found in its deep x64 path', async (t) => {
  const gameDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-dltb-'));
  t.after(() => fs.rmSync(gameDir, { recursive: true, force: true }));
  const exe = path.join(
    gameDir, 'ph_ft', 'work', 'bin', 'x64',
    'DyingLightGame_TheBeast_x64_rwdi.exe'
  );
  minimalPe(exe, { bitness: 64, marker: 'D3D12SDKPath' });

  const scan = await scanGame(gameDir);
  assert.ok(scan.chosen);
  assert.equal(scan.chosen.path, exe);
  assert.equal(scan.chosen.bitness, 64);
  assert.equal(scan.chosen.api, 'dxgi');
  assert.equal(scan.chosen.apiLabel, 'DirectX 12');
  assert.equal(scan.chosen.via, 'strings');
});

test('RDR2 ignores its legacy D3D9 marker and Rockstar redistributable launcher', async (t) => {
  const gameDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-rdr2-'));
  t.after(() => fs.rmSync(gameDir, { recursive: true, force: true }));

  const gameExe = path.join(gameDir, 'RDR2.exe');
  const launcher = path.join(gameDir, 'Redistributables', 'Rockstar-Games-Launcher.exe');
  minimalPe(gameExe, { bitness: 64, marker: 'Direct3DCreate9' });
  minimalPe(launcher, { bitness: 64, marker: 'D3D12CreateDevice' });

  const scan = await scanGame(gameDir);

  assert.equal(scan.exeCandidates.length, 1);
  assert.equal(scan.chosen.path, gameExe);
  assert.equal(scan.chosen.api, 'dxgi');
  assert.equal(scan.chosen.apiLabel, 'DirectX 12');
  assert.equal(scan.chosen.via, 'game-profile');
  assert.deepEqual(scan.chosen.apiChoices, [
    { api: 'dxgi', label: 'DirectX 12' },
    { api: 'vulkan', label: 'Vulkan' }
  ]);
});

test('Assassins Creed Black Flag selects the 32-bit single-player executable', async (t) => {
  const gameDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-ac4-'));
  t.after(() => fs.rmSync(gameDir, { recursive: true, force: true }));
  const singlePlayer = path.join(gameDir, 'AC4BFSP.exe');
  const multiplayer = path.join(gameDir, 'AC4BFMP.exe');
  minimalPe32(singlePlayer, 'D3D11CreateDevice');
  minimalPe32(multiplayer, 'D3D11CreateDevice');

  const scan = await scanGame(gameDir);
  assert.equal(scan.exeCandidates.length, 2);
  assert.equal(scan.chosen.path, singlePlayer);
  assert.equal(scan.chosen.bitness, 32);
  assert.equal(scan.chosen.api, 'dxgi');
  assert.equal(scan.chosen.apiLabel, 'DirectX 11');
});

// A name that ends in "launcher" is one too. The Feeder patching these instead
// of the game is what left Proton titles unable to start.
// Found by Febsho — https://github.com/Febsho/DLSS5-Swapper-Linux
test('launcher-suffixed executables are never selected as game targets', async (t) => {
  const gameDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-launcher-'));
  t.after(() => fs.rmSync(gameDir, { recursive: true, force: true }));
  const launcher = path.join(gameDir, 'Game', 'Launcher', 'MassEffectLauncher.exe');
  const game = path.join(gameDir, 'Game', 'ME1', 'Binaries', 'Win64', 'MassEffect1.exe');
  minimalPe(launcher, { bitness: 64, marker: 'D3D12CreateDevice' });
  minimalPe(game, { bitness: 64, marker: 'D3D12CreateDevice' });

  const scan = await scanGame(gameDir);
  assert.equal(scan.exeCandidates.some((item) => item.path === launcher), false);
  assert.equal(scan.chosen.path, game);
});

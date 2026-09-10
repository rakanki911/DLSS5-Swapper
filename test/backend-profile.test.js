'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const manager = require('../src/core/backend-manager');

// The profile is addressed by a hash of the executable's relative path and the
// API, the same way the app addresses it.
function writeProfile(gameDir, exePath, api, route, files) {
  const id = crypto.createHash('sha256')
    .update(`${path.relative(gameDir, exePath).toLowerCase()}|${api}`).digest('hex').slice(0, 24);
  const file = path.join(gameDir, '_DLSS5_Backup', '.profiles', `${id}-${route}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ version: 1, files }));
  return file;
}

function game(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'backend-profile-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const exe = path.join(dir, 'Phoenix', 'Binaries', 'Win64', 'Game.exe');
  fs.mkdirSync(path.dirname(exe), { recursive: true });
  fs.writeFileSync(exe, 'exe');
  return { dir, exe, config: { gameDir: dir, exePath: exe, api: 'dxgi', route: 'native' } };
}

// ReShade lets a preset be named anything, and mod packs ship them as .txt.
// The writer saved those and the reader refused them, so the game could not be
// installed again at all until the profile was deleted by hand.
test('a preset saved as .txt does not make the game uninstallable', (t) => {
  const { dir, exe, config } = game(t);
  writeProfile(dir, exe, 'dxgi', 'native', {
    'Phoenix\\Binaries\\Win64\\ReShade.ini': '[GENERAL]\r\nPresetPath=..\\..\\..\\preset.txt\r\n',
    '!!! Realism Overhaul Reshade.txt': '[DisplayDepth.fx]\r\nRESHADE_DEPTH_INPUT_IS_REVERSED=1\r\n'
  });

  const files = manager.loadProfile(config);
  assert.deepEqual(Object.keys(files).sort(),
    ['!!! Realism Overhaul Reshade.txt', 'Phoenix\\Binaries\\Win64\\ReShade.ini'].sort());
});

test('a file that is not a settings file is left out rather than refused', (t) => {
  const { dir, exe, config } = game(t);
  writeProfile(dir, exe, 'dxgi', 'native', {
    'Phoenix\\Binaries\\Win64\\ReShade.ini': '[GENERAL]\r\n',
    'something.dll': 'not a setting'
  });

  const files = manager.loadProfile(config);
  assert.deepEqual(Object.keys(files), ['Phoenix\\Binaries\\Win64\\ReShade.ini'],
    'the game still installs, and only the settings file is restored');
});

test('a tampered profile is still refused outright', (t) => {
  const { dir, exe, config } = game(t);

  writeProfile(dir, exe, 'dxgi', 'native', { '_DLSS5_Backup\\originals\\ReShade.ini': '[GENERAL]\r\n' });
  assert.throws(() => manager.loadProfile(config), /Invalid backend profile/, 'aimed at the backup folder');

  writeProfile(dir, exe, 'dxgi', 'native', { 'ReShade.ini': 12345 });
  assert.throws(() => manager.loadProfile(config), /Invalid backend profile/, 'not text');

  writeProfile(dir, exe, 'dxgi', 'native', { 'ReShade.ini': 'x'.repeat(4 * 1024 * 1024 + 1) });
  assert.throws(() => manager.loadProfile(config), /Invalid backend profile/, 'oversized');

  writeProfile(dir, exe, 'dxgi', 'native', { '..\\..\\Windows\\System32\\evil.ini': '[GENERAL]\r\n' });
  assert.throws(() => manager.loadProfile(config), 'a path escaping the game folder');
});

test('no profile at all is not an error', (t) => {
  const { config } = game(t);
  assert.deepEqual(manager.loadProfile(config), {});
});

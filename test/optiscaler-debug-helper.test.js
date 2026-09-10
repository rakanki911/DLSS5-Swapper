'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const optiscaler = require('../src/core/optiscaler');

// dbghelp.dll and dbgcore.dll are on the conflict list because Ultimate ASI
// Loader ships under those names. They are also ordinary Windows components a
// game may carry for its own crash reporting - Cyberpunk 2077 carries both -
// and every OptiScaler install there was refused as "another loader/mod is
// present", with no way past it.
const SYSTEM32 = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32');

function game(t, files) {
  const gameDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opti-dbg-'));
  t.after(() => fs.rmSync(gameDir, { recursive: true, force: true }));
  const exeDir = path.join(gameDir, 'bin', 'x64');
  fs.mkdirSync(exeDir, { recursive: true });
  const exePath = path.join(exeDir, 'Cyberpunk2077.exe');
  fs.writeFileSync(exePath, 'exe');
  for (const [name, source] of Object.entries(files)) {
    if (source) fs.copyFileSync(source, path.join(exeDir, name));
    else fs.writeFileSync(path.join(exeDir, name), 'a mod, not Windows');
  }
  return { gameDir, exePath };
}

test('a game shipping Windows own debug helpers can still install OptiScaler', (t) => {
  for (const name of ['dbghelp.dll', 'dbgcore.dll']) {
    if (!fs.existsSync(path.join(SYSTEM32, name))) return;
  }
  const { gameDir, exePath } = game(t, {
    'dbghelp.dll': path.join(SYSTEM32, 'dbghelp.dll'),
    'dbgcore.dll': path.join(SYSTEM32, 'dbgcore.dll')
  });

  assert.doesNotThrow(() => optiscaler.checkConflicts(gameDir, exePath, null, 'dxgi'));
});

// The reason the names are watched at all has not gone away.
test('an ASI loader under the same name is still refused', (t) => {
  const { gameDir, exePath } = game(t, { 'dbghelp.dll': null });

  assert.throws(() => optiscaler.checkConflicts(gameDir, exePath, null, 'dxgi'),
    /Conflicting pre-existing file/);
});

test('a real mod beside the genuine helpers is still caught', (t) => {
  if (!fs.existsSync(path.join(SYSTEM32, 'dbghelp.dll'))) return;
  const { gameDir, exePath } = game(t, {
    'dbghelp.dll': path.join(SYSTEM32, 'dbghelp.dll'),
    'winmm.dll': null
  });

  assert.throws(() => optiscaler.checkConflicts(gameDir, exePath, null, 'dxgi'),
    /winmm\.dll/, 'the helper is excused; the loader beside it is not');
});

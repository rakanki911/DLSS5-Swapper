'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const core = require('../src/core/apply.js');

// Windows carries the read-only attribute across a file copy, and everything
// this app installs comes from a payload that sits inside the installed
// application - where files are read-only. A read-only ReShade.ini is what the
// game means by "Unable to save configuration"; a read-only DLL breaks the
// next install and the restore that follows it.
function writable(file) {
  try { fs.accessSync(file, fs.constants.W_OK); return true; } catch { return false; }
}

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swapper-readonly-'));
  t.after(() => {
    for (const file of fs.readdirSync(root, { recursive: true, withFileTypes: true })) {
      if (file.isFile()) { try { fs.chmodSync(path.join(file.parentPath || file.path, file.name), 0o666); } catch {} }
    }
    fs.rmSync(root, { recursive: true, force: true });
  });
  const game = path.join(root, 'game');
  fs.mkdirSync(game, { recursive: true });
  fs.writeFileSync(path.join(game, 'Game.exe'), 'exe');
  return { root, game, manifest: core.beginManifest(game, path.join(game, 'Game.exe'), 'dxgi') };
}

test('a read-only payload file arrives writable in the game folder', async (t) => {
  const { root, game, manifest } = fixture(t);
  const source = path.join(root, 'payload', 'ReShade64.dll');
  fs.mkdirSync(path.dirname(source), { recursive: true });
  fs.writeFileSync(source, 'payload bytes');
  fs.chmodSync(source, 0o444);
  assert.equal(writable(source), false, 'the fixture source really is read-only');

  const dest = path.join(game, 'dxgi.dll');
  await core.copyTracked(manifest, game, source, dest, { kind: 'reshade' });
  assert.equal(fs.readFileSync(dest, 'utf8'), 'payload bytes');
  assert.equal(writable(dest), true, 'the game must be able to overwrite what we installed');
});

test('a configuration file left read-only by an earlier install is still rewritten', async (t) => {
  const { game, manifest } = fixture(t);
  const ini = path.join(game, 'ReShade.ini');
  fs.writeFileSync(ini, '[GENERAL]\r\nOld=1\r\n');
  fs.chmodSync(ini, 0o444);
  assert.equal(writable(ini), false);

  await core.writeTracked(manifest, game, ini, '[GENERAL]\r\nNew=1\r\n', { kind: 'config' });
  assert.match(fs.readFileSync(ini, 'utf8'), /New=1/);
  assert.equal(writable(ini), true, 'and it stays writable for ReShade itself');
});

'use strict';
// #155: ReShade covers the game with an error banner it cannot dismiss when it
// cannot write its own ini. The 2.2.2 fix cleared the attribute during an
// install - but somebody who updates the app and simply launches the game
// never runs an install, so the read-only file from the older install sits
// there and the banner is still on their screen. Opening the game clears it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { makeReShadeConfigWritable } = require('../src/core/apply.js');

const temp = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swapper-ro-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};

test('a read-only ReShade.ini is made writable, contents untouched', async (t) => {
  const dir = temp(t);
  const ini = path.join(dir, 'ReShade.ini');
  const preset = path.join(dir, 'ReShadePreset.ini');
  fs.writeFileSync(ini, '[GENERAL]\nPresetPath=.\ReShadePreset.ini\n');
  fs.writeFileSync(preset, '[EFFECT]\n');
  fs.chmodSync(ini, 0o444);
  fs.chmodSync(preset, 0o444);

  const cleared = await makeReShadeConfigWritable(dir);
  assert.deepEqual(cleared.sort(), ['ReShade.ini', 'ReShadePreset.ini']);
  assert.ok(fs.statSync(ini).mode & 0o200, 'the ini can be written again');
  assert.ok(fs.statSync(preset).mode & 0o200);
  assert.match(fs.readFileSync(ini, 'utf8'), /PresetPath/, 'and it still says what it said');
});

test('a file that is already writable is left alone, and a missing one is not an error', async (t) => {
  const dir = temp(t);
  fs.writeFileSync(path.join(dir, 'ReShade.ini'), 'x');
  assert.deepEqual(await makeReShadeConfigWritable(dir), [], 'nothing to clear, nothing reported');
  assert.deepEqual(await makeReShadeConfigWritable(path.join(dir, 'nope')), [], 'no game folder, no throw');
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const diagnostics = require('../src/core/diagnostics');

// Every report worth answering has needed the same files, asked for one at a
// time: the game's dlss5-feed.log, its ReShade.log, the install manifest, and
// which driver the person is on. This gathers them into one attachable file.
function game(t, files = {}) {
  const gameDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diagnostics-'));
  t.after(() => fs.rmSync(gameDir, { recursive: true, force: true }));
  const exeDir = path.join(gameDir, 'bin');
  fs.mkdirSync(path.join(exeDir, 'host64'), { recursive: true });
  for (const [rel, body] of Object.entries(files)) {
    const file = path.join(gameDir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
  }
  return { gameDir, exeDir };
}

test('the logs a report needs are found and named', (t) => {
  const { gameDir, exeDir } = game(t, {
    'bin/dlss5-feed.log': 'feature ready: 3840x2160 DLAA',
    'bin/ReShade.log': 'Initializing crosire’s ReShade',
    'bin/host64/dlss5-feed-host.log': 'host started',
    '_DLSS5_Backup/manifest.json': '{"version":1,"route":"feeder"}'
  });

  const found = diagnostics.sources({ gameDir, exeDir });
  const labels = found.map(item => item.label);
  assert.ok(labels.includes('game: dlss5-feed.log'));
  assert.ok(labels.includes('game: ReShade.log'));
  assert.ok(labels.includes(`game: ${path.join('host64', 'dlss5-feed-host.log')}`));
  assert.ok(labels.includes('install manifest'));
});

test('every file found is in the report, with what the caller knew', (t) => {
  const { gameDir, exeDir } = game(t, {
    'bin/dlss5-feed.log': 'NGX feature 18 -> the query itself failed 0xBAD0000C',
    'bin/ReShade.log': 'loaded from bin\\\\dxgi.dll'
  });

  const { text, sources } = diagnostics.report({
    gameDir, exeDir,
    facts: { app: '2.2.3', gpu: 'NVIDIA GeForce RTX 5090 - 616.64', empty: null }
  });

  assert.equal(sources.length, 2);
  assert.match(text, /app: 2\.2\.3/);
  assert.match(text, /gpu: NVIDIA GeForce RTX 5090 - 616\.64/);
  assert.doesNotMatch(text, /empty/, 'a fact the caller did not have is left out, not printed as null');
  assert.match(text, /0xBAD0000C/, 'the feeder log is carried in full');
  assert.match(text, /dxgi\.dll/, 'so is the ReShade log');
});

// A ReShade log from a long session runs to megabytes and the useful part is
// the end - where the crash is.
test('a huge log is cut from the front, and says where it was cut', (t) => {
  const big = 'x'.repeat(diagnostics.TAIL_BYTES * 3) + 'THE-END-OF-THE-FILE';
  const { gameDir, exeDir } = game(t, { 'bin/ReShade.log': big });

  const { text } = diagnostics.report({ gameDir, exeDir });
  assert.match(text, /THE-END-OF-THE-FILE/, 'the end is kept');
  assert.match(text, /the first \d+ bytes are omitted/);
  assert.ok(text.length < big.length / 2, 'the report is a fraction of the log it read');
});

test('a game with no logs yet says so instead of producing an empty file', (t) => {
  const { gameDir, exeDir } = game(t);
  const { text, sources } = diagnostics.report({ gameDir, exeDir });
  assert.deepEqual(sources, []);
  assert.match(text, /No log files were found/);
  assert.match(text, /Run the install once, launch the game/);
});

// Nothing may be collected that the person is not shown first.
test('what would be gathered can be listed without reading any of it', (t) => {
  const { gameDir, exeDir } = game(t, { 'bin/dlss5-feed.log': 'secret-looking content' });
  const found = diagnostics.sources({ gameDir, exeDir });
  assert.equal(found.length, 1);
  assert.equal(found[0].bytes, 'secret-looking content'.length);
  assert.ok(!JSON.stringify(found).includes('secret-looking'), 'the listing carries paths and sizes, not contents');
});

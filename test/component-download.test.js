'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const components = require('../src/core/runtime-components');

const bytes = Buffer.from('official component payload');
const sha = crypto.createHash('sha256').update(bytes).digest('hex');

function tempFile(t, name = 'component.zip') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'component-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return path.join(dir, name);
}

test('a verified component is written and reported as cached afterwards', async (t) => {
  const file = tempFile(t);
  await components.fetchVerified('https://example.invalid/x.zip', sha, file,
    { fetchBytes: async () => bytes });
  assert.deepEqual(fs.readFileSync(file), bytes);
  assert.equal(components.cached(file, sha), true);
  // The .part file must not be left behind.
  assert.equal(fs.existsSync(file + '.part'), false);
});

test('a failed transfer is reported as a network problem, not a bad file', async (t) => {
  const file = tempFile(t);
  await assert.rejects(
    components.fetchVerified('https://example.invalid/x.zip', sha, file,
      { fetchBytes: async () => { throw new Error('Download failed (503)'); } }),
    (error) => error.code === 'componentNetwork' && /503/.test(error.message));
  assert.equal(fs.existsSync(file), false, 'nothing may be written when the download fails');
});

test('bytes that do not match the pinned checksum never reach the disk', async (t) => {
  const file = tempFile(t);
  await assert.rejects(
    components.fetchVerified('https://example.invalid/x.zip', sha, file,
      { fetchBytes: async () => Buffer.from('something else entirely') }),
    (error) => error.code === 'componentChecksum' && error.message.includes(sha));
  assert.equal(fs.existsSync(file), false);
  assert.equal(fs.existsSync(file + '.part'), false);
});

// What antivirus quarantine looks like from here: the download is fine and
// matches, and then the file is not there any more.
test('a component removed right after it verified is reported as quarantine', async (t) => {
  const file = tempFile(t);
  await assert.rejects(
    components.fetchVerified('https://example.invalid/x.zip', sha, file, {
      fetchBytes: async () => bytes,
      digest: () => { throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); }
    }),
    (error) => error.code === 'componentRemoved' && error.message === path.dirname(file));
});

test('cached() treats a missing or altered component as not cached', (t) => {
  const file = tempFile(t);
  assert.equal(components.cached(file, sha), false, 'missing file');
  fs.writeFileSync(file, 'tampered');
  assert.equal(components.cached(file, sha), false, 'wrong bytes');
  fs.writeFileSync(file, bytes);
  assert.equal(components.cached(file, sha), true);
});

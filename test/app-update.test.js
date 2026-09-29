'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const update = require('../src/core/app-update');
const pkg = require('../package.json');

function fromTemplate(template, version = '2.2.8') {
  return String(template).replace(/\$\{version\}/g, version);
}

const setup = {
  name: 'DLSS5-Swapper-Setup-2.2.8.exe',
  size: 12,
  digest: 'sha256:' + crypto.createHash('sha256').update('installer-bytes').digest('hex'),
  browser_download_url: 'https://example.invalid/setup.exe'
};
const portable = {
  name: 'DLSS5-Swapper-2.2.8-portable.exe',
  size: 8,
  browser_download_url: 'https://example.invalid/portable.exe'
};
const release = { tag_name: 'v2.2.8', assets: [setup, portable] };

test('a packaged Windows copy picks the installer, a portable copy picks the other exe', () => {
  assert.equal(fromTemplate(pkg.build.nsis.artifactName), setup.name);
  assert.equal(fromTemplate(pkg.build.portable.artifactName), portable.name);
  assert.equal(update.updateChannel({ packaged: true, portable: false, platform: 'win32' }), 'nsis');
  assert.equal(update.updateChannel({ packaged: true, portable: true, platform: 'win32' }), 'portable');
  assert.equal(update.updateChannel({ packaged: false, portable: false, platform: 'win32' }), 'link');
  assert.equal(update.updateChannel({ packaged: true, portable: false, platform: 'linux' }), 'link');
  assert.equal(update.pickAsset(release, 'nsis').name, setup.name);
  assert.equal(update.pickAsset(release, 'portable').name, portable.name);
  assert.equal(update.pickAsset(release, 'link'), null);
});

test('a missing digest is accepted when the size matches, a wrong size is not', () => {
  const got = { bytes: 8, sha256: 'abc', sha512: 'x' };
  update.verifyDownload(got, { name: portable.name, size: 8 });
  assert.throws(
    () => update.verifyDownload(got, { name: portable.name, size: 9 }),
    (error) => error.code === 'updateChecksum' && /size mismatch/.test(error.message)
  );
});

test('a GitHub digest that does not match is refused', () => {
  const bytes = Buffer.from('installer-bytes');
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const asset = { ...setup, size: bytes.length };
  update.verifyDownload({ bytes: bytes.length, sha256, sha512: 'x' }, asset);
  assert.throws(
    () => update.verifyDownload({ bytes: bytes.length, sha256: '0'.repeat(64), sha512: 'x' }, asset),
    (error) => error.code === 'updateChecksum' && /sha256 mismatch/.test(error.message)
  );
});

test('SHA256SUMS and latest.yml hashes are used when they name the file, and ignored when absent', () => {
  const sha256 = 'a'.repeat(64);
  const sums = update.parseSums(`${sha256}  ${setup.name}\n`);
  assert.equal(sums[setup.name.toLowerCase()], sha256);
  const yml = update.parseLatestYml([
    'version: 2.2.0',
    'files:',
    `  - url: ${setup.name}`,
    '    sha512: abc+def==',
    '    size: 1',
    `path: ${setup.name}`,
    'sha512: abc+def=='
  ].join('\n'));
  assert.equal(yml[setup.name.toLowerCase()], 'abc+def==');
  update.verifyDownload({ bytes: 12, sha256, sha512: 'abc+def==' }, { name: setup.name, size: 12 }, { sha256: sums, sha512: yml });
  assert.throws(
    () => update.verifyDownload({ bytes: 12, sha256: 'b'.repeat(64), sha512: 'abc+def==' }, { name: setup.name, size: 12 }, { sha256: sums }),
    (error) => error.code === 'updateChecksum'
  );
});

test('a missing SHA256SUMS sidecar is not a reason to refuse', async () => {
  const sidecars = await update.loadSidecars(release.assets, async () => { throw new Error('no sidecar'); });
  assert.deepEqual(sidecars, { sha256: {}, sha512: {} });
  update.verifyDownload({ bytes: 8, sha256: 'abc', sha512: 'x' }, { name: portable.name, size: 8 }, sidecars);
});

test('newerRelease still compares the first three numbers', () => {
  assert.equal(update.newerRelease('2.2.1', 'v2.2.2'), true);
  assert.equal(update.newerRelease('2.2.1', '2.2.1'), false);
  assert.equal(update.newerRelease('2.2.1', '2.2.0'), false);
  assert.equal(update.newerRelease('2.2.1', 'v2.10.0'), true);
});

test('a streamed download is hashed, sized, and leaves no .part file', async (t) => {
  const bytes = Buffer.from('installer-bytes');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swapper-update-dl-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const dest = path.join(dir, setup.name);
  const progress = [];
  const got = await update.downloadTo('https://example.invalid/setup.exe', dest, {
    fetch: async () => ({
      ok: true,
      status: 200,
      headers: { get: (name) => name.toLowerCase() === 'content-length' ? String(bytes.length) : null },
      arrayBuffer: async () => bytes
    }),
    onProgress: (info) => progress.push(info)
  });
  assert.equal(fs.readFileSync(dest, 'utf8'), 'installer-bytes');
  assert.equal(fs.existsSync(dest + '.part'), false);
  assert.equal(got.bytes, bytes.length);
  assert.equal(got.sha256, crypto.createHash('sha256').update(bytes).digest('hex'));
  assert.deepEqual(progress, [{ received: bytes.length, total: bytes.length }]);
  update.verifyDownload(got, { ...setup, size: bytes.length });
});

test('a failed transfer never leaves the destination behind', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swapper-update-fail-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const dest = path.join(dir, setup.name);
  await assert.rejects(
    update.downloadTo('https://example.invalid/setup.exe', dest, {
      fetch: async () => ({ ok: false, status: 403, headers: { get: () => null } })
    }),
    (error) => error.code === 'updateNetwork'
  );
  assert.equal(fs.existsSync(dest), false);
  assert.equal(fs.existsSync(dest + '.part'), false);
});

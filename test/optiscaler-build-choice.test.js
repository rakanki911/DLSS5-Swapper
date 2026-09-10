'use strict';
// #238: 2.2.1 shipped OptiScaler 0.1.1.5 and 2.2.2 shipped 0.2.0-patch1. No
// Man's Sky runs on the first and crashes on the second, and the only way back
// was to keep an old copy of the whole app. A game can name the older build
// now - but only from the list this app pins, so nothing unverified becomes
// installable and the guarantee #191 relies on is untouched.
const test = require('node:test');
const assert = require('node:assert/strict');
const opti = require('../src/core/optiscaler');

test('every pinned build carries a URL and a digest, exactly as the single one did', () => {
  assert.ok(opti.RELEASES.length >= 2, 'more than one to choose between');
  for (const release of opti.RELEASES) {
    assert.match(release.version, /^\d/, release.version);
    assert.match(release.url, /^https:\/\/github\.com\/.+\.zip$/, release.version);
    assert.match(release.sha256, /^[0-9a-f]{64}$/, release.version);
    assert.match(release.licenseHash, /^[0-9a-f]{64}$/, release.version);
  }
  assert.equal(opti.RELEASE, opti.RELEASES[0], 'the first is the default');
});

test('a game names a build, and anything else falls back to the current one', () => {
  assert.equal(opti.releaseFor('0.1.1.5-dlssnr').version, '0.1.1.5-dlssnr');
  assert.equal(opti.releaseFor('0.2.0-patch1').version, '0.2.0-patch1');
  for (const junk of [undefined, null, '', 'nonsense', '../../etc/passwd', 42, {}]) {
    assert.equal(opti.releaseFor(junk).version, opti.RELEASE.version, String(junk));
  }
});

test('the two builds are kept apart on disk, so choosing one cannot corrupt the other', () => {
  const versions = opti.RELEASES.map((r) => r.version);
  assert.equal(new Set(versions).size, versions.length, 'distinct version names');
  const digests = opti.RELEASES.map((r) => r.sha256);
  assert.equal(new Set(digests).size, digests.length, 'and distinct archives');
});

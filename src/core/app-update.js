'use strict';

// In-app updates download the GitHub asset that matches how this copy was
// launched. Kept out of main.js so picking, hashing and the Windows restart
// command can be tested without Electron. SHA256SUMS.txt is optional: newer
// releases dropped it, so a missing sidecar is not a reason to refuse.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { once } = require('node:events');
const { finished } = require('node:stream/promises');

const RELEASE_TAG = /^v?(\d+)\.(\d+)\.(\d+)/;

// Packed package.json has no `build` block. Keep these in lockstep with
// package.json nsis/portable.artifactName.
const ARTIFACTS = {
  nsis: /^DLSS5-Swapper-Setup-[^\\/]+\.exe$/i,
  portable: /^DLSS5-Swapper-[^\\/]+-portable\.exe$/i
};

function newerRelease(current, latest) {
  const a = RELEASE_TAG.exec(current), b = RELEASE_TAG.exec(latest);
  if (!a || !b) return false;
  for (let i = 1; i <= 3; i++) {
    if (Number(b[i]) > Number(a[i])) return true;
    if (Number(b[i]) < Number(a[i])) return false;
  }
  return false;
}

function updateChannel({ packaged, portable, platform }) {
  if (!packaged || platform !== 'win32') return 'link';
  return portable ? 'portable' : 'nsis';
}

function pickAsset(release, channel) {
  const pattern = ARTIFACTS[channel];
  if (!pattern) return null;
  const assets = Array.isArray(release && release.assets) ? release.assets : [];
  return assets.find((asset) => pattern.test(asset.name)) || null;
}

function parseGitHubDigest(digest) {
  const match = String(digest || '').match(/^sha256:([a-fA-F0-9]{64})$/);
  return match ? match[1].toLowerCase() : null;
}

function parseSums(text) {
  const map = {};
  for (const line of String(text || '').split(/\r?\n/)) {
    const match = line.match(/^\s*([a-fA-F0-9]{64})\s+\*?(.+?)\s*$/);
    if (!match) continue;
    map[path.basename(match[2]).toLowerCase()] = match[1].toLowerCase();
  }
  return map;
}

function parseLatestYml(text) {
  const map = {};
  let current = null;
  for (const line of String(text || '').split(/\r?\n/)) {
    const file = line.match(/^\s+-\s+url:\s+(\S+)/);
    if (file) { current = path.basename(file[1]).toLowerCase(); continue; }
    const nested = line.match(/^\s+sha512:\s+(\S+)/);
    if (nested && current) { map[current] = nested[1]; continue; }
    const rootFile = line.match(/^path:\s+(\S+)/);
    if (rootFile) current = path.basename(rootFile[1]).toLowerCase();
    const rootHash = line.match(/^sha512:\s+(\S+)/);
    if (rootHash && current && map[current] === undefined) map[current] = rootHash[1];
  }
  return map;
}

function expectedHashes(asset, sidecars = {}) {
  const name = String(asset && asset.name || '').toLowerCase();
  return {
    sha256: parseGitHubDigest(asset && asset.digest) || (sidecars.sha256 && sidecars.sha256[name]) || null,
    sha512: (sidecars.sha512 && sidecars.sha512[name]) || null
  };
}

async function loadSidecars(assets, fetchFn, headers = {}) {
  const sidecars = { sha256: {}, sha512: {} };
  const read = async (url) => {
    const response = await fetchFn(url, { headers, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(String(response.status));
    return response.text();
  };
  for (const asset of assets || []) {
    if (!asset.browser_download_url) continue;
    try {
      if (/^SHA256SUMS/i.test(asset.name)) Object.assign(sidecars.sha256, parseSums(await read(asset.browser_download_url)));
      if (/^latest\.yml$/i.test(asset.name)) Object.assign(sidecars.sha512, parseLatestYml(await read(asset.browser_download_url)));
    } catch { /* a missing sidecar must not block an update that already has size or digest */ }
  }
  return sidecars;
}

function verifyDownload(got, asset, sidecars = {}) {
  const size = asset && asset.size;
  if (Number.isFinite(size) && got.bytes !== size) {
    throw Object.assign(new Error(`size mismatch: expected ${size}, received ${got.bytes}`), { code: 'updateChecksum' });
  }
  const want = expectedHashes(asset, sidecars);
  if (want.sha256 && got.sha256 !== want.sha256) {
    throw Object.assign(new Error(`sha256 mismatch: expected ${want.sha256}, received ${got.sha256}`), { code: 'updateChecksum' });
  }
  if (want.sha512 && got.sha512 !== want.sha512) {
    throw Object.assign(new Error(`sha512 mismatch: expected ${want.sha512}`), { code: 'updateChecksum' });
  }
}

async function* bodyChunks(response) {
  if (response.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } else {
    yield Buffer.from(await response.arrayBuffer());
  }
}

async function downloadTo(url, dest, options = {}) {
  const fetchFn = options.fetch || fetch;
  const response = await fetchFn(url, {
    headers: options.headers || {},
    signal: options.signal
  });
  if (!response.ok) {
    throw Object.assign(new Error(`Download failed (${response.status})`), { code: 'updateNetwork' });
  }
  const total = Number(response.headers.get('content-length')) || 0;
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  const temp = dest + '.part';
  const out = fs.createWriteStream(temp);
  const sha256 = crypto.createHash('sha256');
  const sha512 = crypto.createHash('sha512');
  let received = 0;
  try {
    for await (const value of bodyChunks(response)) {
      const chunk = Buffer.from(value);
      received += chunk.length;
      sha256.update(chunk);
      sha512.update(chunk);
      if (!out.write(chunk)) await once(out, 'drain');
      if (options.onProgress) options.onProgress({ received, total });
    }
    out.end();
    await finished(out);
  } catch (error) {
    out.destroy();
    try { await fs.promises.unlink(temp); } catch { /* leftover part file is harmless */ }
    throw error;
  }
  await fs.promises.rename(temp, dest);
  return {
    bytes: received,
    sha256: sha256.digest('hex'),
    sha512: sha512.digest('base64')
  };
}

module.exports = {
  newerRelease, updateChannel, pickAsset, parseGitHubDigest, parseSums, parseLatestYml,
  expectedHashes, loadSidecars, verifyDownload, downloadTo
};

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const DEFAULT_REPO = 'rakanki911/DLSS5-Swapper';

/**
 * Strips leading 'v' / 'V' and trims whitespace.
 */
function cleanVersion(v) {
  if (typeof v !== 'string') return '0.0.0';
  return v.trim().replace(/^[vV]/, '');
}

/**
 * Parses a semver-like string into major, minor, patch and prerelease.
 */
function parseVersion(v) {
  const cleaned = cleanVersion(v);
  const [core, ...preParts] = cleaned.split('-');
  const prerelease = preParts.length ? preParts.join('-') : null;
  const parts = core.split('.').map(n => parseInt(n, 10) || 0);
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
    prerelease
  };
}

/**
 * Compares two semver version strings.
 * Returns 1 if v1 > v2, -1 if v1 < v2, 0 if v1 === v2.
 */
function compareVersions(v1, v2) {
  const p1 = parseVersion(v1);
  const p2 = parseVersion(v2);

  if (p1.major !== p2.major) return p1.major > p2.major ? 1 : -1;
  if (p1.minor !== p2.minor) return p1.minor > p2.minor ? 1 : -1;
  if (p1.patch !== p2.patch) return p1.patch > p2.patch ? 1 : -1;

  // Prerelease comparison: version without prerelease is higher than one with prerelease.
  if (!p1.prerelease && p2.prerelease) return 1;
  if (p1.prerelease && !p2.prerelease) return -1;
  if (p1.prerelease && p2.prerelease) {
    return p1.prerelease.localeCompare(p2.prerelease);
  }

  return 0;
}

/**
 * Parses SHA256SUMS.txt file content.
 * Format: "<hash>  <filename>" or "<hash> *<filename>"
 * Returns a Map of lowercase filename -> lowercase hash.
 */
function parseSha256Sums(text) {
  const map = new Map();
  if (typeof text !== 'string') return map;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([a-fA-F0-9]{64})\s+[*]?(.+)$/);
    if (match) {
      map.set(match[2].trim().toLowerCase(), match[1].toLowerCase());
    }
  }
  return map;
}

/**
 * Chooses the best asset for the running environment (portable vs installer).
 */
function chooseAsset(assets, isPortable = false) {
  if (!Array.isArray(assets) || !assets.length) return null;

  const exeAssets = assets.filter(a => typeof a.name === 'string' && a.name.toLowerCase().endsWith('.exe'));
  if (!exeAssets.length) return null;

  let selected = null;
  if (isPortable) {
    selected = exeAssets.find(a => a.name.toLowerCase().includes('portable'));
  } else {
    selected = exeAssets.find(a => /setup.*\.exe$/i.test(a.name) || !a.name.toLowerCase().includes('portable'));
  }

  // Fallback to any executable asset if specific variant wasn't found
  if (!selected) selected = exeAssets[0];

  return {
    name: selected.name,
    size: selected.size || 0,
    downloadUrl: selected.browser_download_url || selected.url
  };
}

/**
 * Queries GitHub Releases for the latest version.
 */
async function checkForUpdates({
  currentVersion = '0.0.0',
  repo = DEFAULT_REPO,
  endpoint,
  isPortable = false,
  fetchFn = globalThis.fetch
} = {}) {
  const url = endpoint || `https://api.github.com/repos/${repo}/releases/latest`;
  const res = await fetchFn(url, {
    headers: {
      'User-Agent': `DLSS5-Swapper/${cleanVersion(currentVersion)}`,
      'Accept': 'application/vnd.github.v3+json'
    },
    signal: AbortSignal.timeout(15000)
  });

  if (!res.ok) {
    throw new Error(`Failed to check updates from GitHub (${res.status} ${res.statusText})`);
  }

  const data = await res.json();
  const latestTag = data.tag_name || '';
  const latestVersion = cleanVersion(latestTag);
  const curVersion = cleanVersion(currentVersion);
  const isAvailable = compareVersions(latestVersion, curVersion) > 0;

  let asset = chooseAsset(data.assets, isPortable);

  // If SHA256SUMS.txt asset exists, try fetching and parsing it
  if (asset && Array.isArray(data.assets)) {
    const sumsAsset = data.assets.find(a => /^sha256sums\.txt$/i.test(a.name));
    if (sumsAsset && (sumsAsset.browser_download_url || sumsAsset.url)) {
      try {
        const sumsRes = await fetchFn(sumsAsset.browser_download_url || sumsAsset.url, {
          headers: { 'User-Agent': `DLSS5-Swapper/${cleanVersion(currentVersion)}` },
          signal: AbortSignal.timeout(10000)
        });
        if (sumsRes.ok) {
          const sumsText = await sumsRes.text();
          const hashes = parseSha256Sums(sumsText);
          const hash = hashes.get(asset.name.toLowerCase());
          if (hash) asset.sha256 = hash;
        }
      } catch {
        // Optional checksum fetch failure is non-fatal; download will still proceed
      }
    }
  }

  return {
    available: isAvailable,
    currentVersion: curVersion,
    version: latestVersion,
    tag: latestTag,
    releaseName: data.name || latestTag,
    notes: data.body || '',
    publishedAt: data.published_at || null,
    releaseUrl: data.html_url || `https://github.com/${repo}/releases/latest`,
    asset
  };
}

/**
 * Computes SHA-256 of a file on disk.
 */
async function computeFileSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex').toLowerCase()));
  });
}

/**
 * Downloads the update asset with streaming progress tracking and checksum verification.
 */
async function downloadUpdate({
  asset,
  updatesDir,
  onProgress,
  fetchFn = globalThis.fetch,
  abortSignal
}) {
  if (!asset || !asset.downloadUrl) {
    throw new Error('No valid update asset URL provided');
  }

  await fs.promises.mkdir(updatesDir, { recursive: true });
  const destFile = path.join(updatesDir, asset.name);
  const partFile = destFile + '.part';

  const res = await fetchFn(asset.downloadUrl, {
    headers: { 'User-Agent': 'DLSS5-Swapper-Updater' },
    signal: abortSignal
  });

  if (!res.ok) {
    throw new Error(`Download failed (${res.status} ${res.statusText})`);
  }

  const contentLength = parseInt(res.headers.get('content-length') || '0', 10) || asset.size || 0;
  let transferred = 0;
  let lastTime = Date.now();
  let lastTransferred = 0;
  let currentSpeed = 0;

  const fileStream = fs.createWriteStream(partFile);

  try {
    if (res.body && typeof res.body.getReader === 'function') {
      const reader = res.body.getReader();
      while (true) {
        if (abortSignal?.aborted) {
          reader.cancel().catch(() => {});
          throw new Error('Download aborted');
        }
        const { done, value } = await reader.read();
        if (done) break;

        fileStream.write(Buffer.from(value));
        transferred += value.length;

        const now = Date.now();
        const delta = (now - lastTime) / 1000;
        if (delta >= 0.25) {
          currentSpeed = (transferred - lastTransferred) / delta;
          lastTime = now;
          lastTransferred = transferred;

          if (typeof onProgress === 'function') {
            const percent = contentLength > 0 ? Math.min(100, Math.round((transferred / contentLength) * 100)) : 0;
            onProgress({
              percent,
              transferred,
              total: contentLength,
              speed: currentSpeed,
              bytesPerSecond: currentSpeed
            });
          }
        }
      }
    } else {
      // Fallback for Node Readable stream
      const buffer = Buffer.from(await res.arrayBuffer());
      fileStream.write(buffer);
      transferred = buffer.length;
    }

    await new Promise((resolve, reject) => {
      fileStream.end(err => (err ? reject(err) : resolve()));
    });

    // Final 100% progress notification
    if (typeof onProgress === 'function') {
      onProgress({
        percent: 100,
        transferred,
        total: contentLength || transferred,
        speed: 0,
        bytesPerSecond: 0
      });
    }

    // Atomically rename part file
    await fs.promises.rename(partFile, destFile);

    // Verify SHA-256 if available
    const actualHash = await computeFileSha256(destFile);
    if (asset.sha256) {
      if (actualHash.toLowerCase() !== asset.sha256.toLowerCase()) {
        try { await fs.promises.unlink(destFile); } catch {}
        throw new Error(`SHA-256 verification failed (expected ${asset.sha256}, got ${actualHash})`);
      }
    }

    return {
      ok: true,
      filePath: destFile,
      size: transferred,
      sha256: actualHash
    };
  } catch (error) {
    fileStream.destroy();
    try { await fs.promises.unlink(partFile); } catch {}
    throw error;
  }
}

/**
 * Applies the update.
 * In packaged mode, spawns installer/executable detached and quits.
 * In development mode, reveals the downloaded installer in folder.
 */
function applyUpdate({
  filePath,
  isPortable = false,
  isPackaged = false,
  spawnFn = spawn,
  quitFn,
  showInFolderFn
}) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Update file not found: ${filePath}`);
  }

  if (!isPackaged) {
    if (typeof showInFolderFn === 'function') {
      showInFolderFn(filePath);
    }
    return {
      ok: true,
      mode: 'dev',
      message: 'Running in development mode. The update file was opened in Explorer.'
    };
  }

  // Windows installer / executable spawn
  const args = isPortable ? [] : []; // Default interactive NSIS run
  const child = spawnFn(filePath, args, {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();

  if (typeof quitFn === 'function') {
    setTimeout(() => quitFn(), 300);
  }

  return { ok: true, mode: 'packaged' };
}

module.exports = {
  cleanVersion,
  parseVersion,
  compareVersions,
  parseSha256Sums,
  chooseAsset,
  checkForUpdates,
  computeFileSha256,
  downloadUpdate,
  applyUpdate,
  DEFAULT_REPO
};

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const updater = require('../src/core/updater');

test('cleanVersion handles v prefixes, whitespace and invalid input', () => {
  assert.equal(updater.cleanVersion('v2.2.1'), '2.2.1');
  assert.equal(updater.cleanVersion('V1.0.0 '), '1.0.0');
  assert.equal(updater.cleanVersion('  3.4.5  '), '3.4.5');
  assert.equal(updater.cleanVersion(null), '0.0.0');
});

test('compareVersions handles major, minor, patch and prerelease correctly', () => {
  assert.equal(updater.compareVersions('2.2.1', '2.2.1'), 0);
  assert.equal(updater.compareVersions('v2.2.1', '2.2.1'), 0);
  assert.equal(updater.compareVersions('2.3.0', '2.2.1'), 1);
  assert.equal(updater.compareVersions('2.2.0', '2.2.1'), -1);
  assert.equal(updater.compareVersions('3.0.0', '2.9.9'), 1);
  assert.equal(updater.compareVersions('2.10.0', '2.9.0'), 1);
  assert.equal(updater.compareVersions('2.2.2', '2.2.1.9'), 1);

  // Prerelease comparison
  assert.equal(updater.compareVersions('2.3.0', '2.3.0-beta.1'), 1);
  assert.equal(updater.compareVersions('2.3.0-beta.1', '2.3.0'), -1);
  assert.equal(updater.compareVersions('2.3.0-alpha', '2.3.0-beta'), -1);
});

test('parseSha256Sums parses standard and binary hash lists', () => {
  const sample = `
# Checksums
756eb594cd2e0ae98ea886e02c84a0ef67fa4943f1b3deb5639eb4bb1da79807  DLSS5-Swapper-Setup-2.2.1.exe
10c2e7877039ab5227cca3502dd85fcf561f3cdcaf2c311a7b3c6a768e99db13 *DLSS5-Swapper-2.2.1-portable.exe
`;
  const parsed = updater.parseSha256Sums(sample);
  assert.equal(parsed.get('dlss5-swapper-setup-2.2.1.exe'), '756eb594cd2e0ae98ea886e02c84a0ef67fa4943f1b3deb5639eb4bb1da79807');
  assert.equal(parsed.get('dlss5-swapper-2.2.1-portable.exe'), '10c2e7877039ab5227cca3502dd85fcf561f3cdcaf2c311a7b3c6a768e99db13');
  assert.equal(parsed.has('missing.exe'), false);
});

test('chooseAsset distinguishes installer and portable targets', () => {
  const assets = [
    { name: 'DLSS5-Swapper-2.3.0-portable.exe', size: 1000, browser_download_url: 'http://example.com/portable' },
    { name: 'DLSS5-Swapper-Setup-2.3.0.exe', size: 1200, browser_download_url: 'http://example.com/setup' },
    { name: 'SHA256SUMS.txt', size: 100, browser_download_url: 'http://example.com/sums' }
  ];

  const installerChoice = updater.chooseAsset(assets, false);
  assert.equal(installerChoice.name, 'DLSS5-Swapper-Setup-2.3.0.exe');
  assert.equal(installerChoice.downloadUrl, 'http://example.com/setup');

  const portableChoice = updater.chooseAsset(assets, true);
  assert.equal(portableChoice.name, 'DLSS5-Swapper-2.3.0-portable.exe');
  assert.equal(portableChoice.downloadUrl, 'http://example.com/portable');
});

test('checkForUpdates queries release API and identifies updates and checksums', async () => {
  const mockRelease = {
    tag_name: 'v2.3.0',
    name: 'DLSS 5 Swapper v2.3.0 — Fast Updates',
    body: '## Improvements\n- In-app update support',
    published_at: '2026-09-04T12:00:00Z',
    html_url: 'https://github.com/rakanki911/DLSS5-Swapper/releases/tag/v2.3.0',
    assets: [
      { name: 'DLSS5-Swapper-Setup-2.3.0.exe', size: 5000, browser_download_url: 'https://mock/setup.exe' },
      { name: 'SHA256SUMS.txt', size: 100, browser_download_url: 'https://mock/sums.txt' }
    ]
  };

  const mockSums = 'abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234  DLSS5-Swapper-Setup-2.3.0.exe';

  const mockFetch = async (url) => {
    if (url.includes('/releases/latest')) {
      return {
        ok: true,
        json: async () => mockRelease
      };
    }
    if (url.includes('sums.txt')) {
      return {
        ok: true,
        text: async () => mockSums
      };
    }
    return { ok: false, status: 404 };
  };

  const result = await updater.checkForUpdates({
    currentVersion: '2.2.1',
    fetchFn: mockFetch
  });

  assert.equal(result.available, true);
  assert.equal(result.version, '2.3.0');
  assert.equal(result.currentVersion, '2.2.1');
  assert.equal(result.asset.name, 'DLSS5-Swapper-Setup-2.3.0.exe');
  assert.equal(result.asset.sha256, 'abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234');

  // Test when already up to date
  const upToDate = await updater.checkForUpdates({
    currentVersion: '2.3.0',
    fetchFn: mockFetch
  });
  assert.equal(upToDate.available, false);
});

test('downloadUpdate streams file, verifies SHA-256 and handles mismatch', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'updater-test-'));
  try {
    const payloadContent = 'Hello DLSS 5 Update Payload!';
    const expectedHash = crypto.createHash('sha256').update(payloadContent).digest('hex');

    const mockFetch = async () => ({
      ok: true,
      headers: new Map([['content-length', String(payloadContent.length)]]),
      arrayBuffer: async () => Buffer.from(payloadContent)
    });

    let lastProgress = null;
    const res = await updater.downloadUpdate({
      asset: {
        name: 'test-update.exe',
        downloadUrl: 'https://mock/test-update.exe',
        sha256: expectedHash,
        size: payloadContent.length
      },
      updatesDir: tmpDir,
      onProgress: (p) => { lastProgress = p; },
      fetchFn: mockFetch
    });

    assert.equal(res.ok, true);
    assert.equal(fs.existsSync(res.filePath), true);
    assert.equal(res.sha256, expectedHash);
    assert.equal(lastProgress.percent, 100);

    // Test hash mismatch
    await assert.rejects(async () => {
      await updater.downloadUpdate({
        asset: {
          name: 'bad-update.exe',
          downloadUrl: 'https://mock/bad-update.exe',
          sha256: '0000000000000000000000000000000000000000000000000000000000000000',
          size: payloadContent.length
        },
        updatesDir: tmpDir,
        fetchFn: mockFetch
      });
    }, /SHA-256 verification failed/);

    assert.equal(fs.existsSync(path.join(tmpDir, 'bad-update.exe')), false, 'corrupt file was deleted');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('applyUpdate behaves according to packaged vs dev environment', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'updater-apply-test-'));
  try {
    const targetFile = path.join(tmpDir, 'Setup.exe');
    fs.writeFileSync(targetFile, 'mock-installer');

    // Dev mode
    let openedPath = null;
    const devRes = updater.applyUpdate({
      filePath: targetFile,
      isPackaged: false,
      showInFolderFn: (p) => { openedPath = p; }
    });
    assert.equal(devRes.ok, true);
    assert.equal(devRes.mode, 'dev');
    assert.equal(openedPath, targetFile);

    // Packaged mode
    let spawnedCmd = null;
    let quitCalled = false;
    const pkgRes = updater.applyUpdate({
      filePath: targetFile,
      isPackaged: true,
      spawnFn: (cmd) => {
        spawnedCmd = cmd;
        return { unref() {} };
      },
      quitFn: () => { quitCalled = true; }
    });
    assert.equal(pkgRes.ok, true);
    assert.equal(pkgRes.mode, 'packaged');
    assert.equal(spawnedCmd, targetFile);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('updater IPC handlers expose status, settings toggle and check workflow', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'updater-ipc-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const handlers = new Map();
  const main = path.resolve(__dirname, '../main.js');
  const realRequire = require('node:module').createRequire(main);
  const stubs = {
    electron: {
      app: { setAppUserModelId() {}, whenReady: () => ({ then() {} }), on() {}, getPath: () => root, getVersion: () => '2.2.1', isPackaged: false },
      ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
      BrowserWindow: { fromWebContents: () => null },
      shell: { showItemInFolder() {}, openExternal: async () => {} },
      clipboard: { writeText: () => {} }
    },
    './src/core/updater': updater
  };

  const vm = require('node:vm');
  const context = vm.createContext({ require: name => stubs[name] || realRequire(name), __dirname: path.dirname(main), process, Buffer, console });
  vm.runInContext(fs.readFileSync(main, 'utf8'), context, { filename: main });

  const event = { sender: { send() {} } };

  // Settings should return autoCheckUpdates default true
  const settingsHandler = handlers.get('settings');
  assert.ok(settingsHandler);
  const settings = await settingsHandler(event);
  assert.equal(settings.autoCheckUpdates, true);

  // Toggle autoCheckUpdates
  const toggleHandler = handlers.get('set-auto-check-updates');
  assert.ok(toggleHandler);
  const disabled = await toggleHandler(event, false);
  assert.equal(disabled, false);
  const updatedSettings = await settingsHandler(event);
  assert.equal(updatedSettings.autoCheckUpdates, false);

  // Status handler
  const statusHandler = handlers.get('updater-status');
  assert.ok(statusHandler);
  const status = await statusHandler(event);
  assert.equal(status.status, 'idle');

  // Cancel handler
  const cancelHandler = handlers.get('updater-cancel');
  assert.ok(cancelHandler);
  const cancelRes = await cancelHandler(event);
  assert.equal(cancelRes.ok, false); // no active download to cancel
});

'use strict';
// Does the actual work: backs up, swaps the DLLs in place, drops the add-on
// next to the executable, and installs ReShade headlessly.
//
// Nothing here writes user-facing prose. Every step reports a code plus its
// values, and the renderer turns that into whichever language is selected.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const pe = require('./pe');
const { scanGame } = require('./scan');

const BACKUP_DIR = '_DLSS5_Backup';
const MANIFEST = 'manifest.json';

function backupRoot(gameDir) {
  return path.join(gameDir, BACKUP_DIR);
}

function fail(code, params) {
  const error = new Error(code);
  error.code = code;
  error.params = params || {};
  return error;
}

function parseVersion(text) {
  const m = String(text || '').match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? m.slice(1).map(Number) : null;
}

// Positive when a is newer than b.
function compareVersions(a, b) {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) return 0;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

// A game under Program Files needs an elevated app; find that out before
// touching anything rather than half-way through the swap.
function canWrite(dir) {
  const probe = path.join(dir, `.dlss5_write_test_${Date.now()}`);
  try {
    fs.writeFileSync(probe, 'x');
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

async function copyOver(src, dest) {
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  await fs.promises.copyFile(src, dest);
}

function runSetup(setupExe, args, log) {
  return new Promise((resolve) => {
    log('runningSetup', { setup: path.basename(setupExe), args: args.slice(1).join(' ') });
    const child = spawn(setupExe, args, { windowsHide: true });
    let output = '';
    child.stdout.on('data', (d) => { output += d.toString(); });
    child.stderr.on('data', (d) => { output += d.toString(); });
    child.on('error', (err) => resolve({ code: -1, output: err.message }));
    child.on('close', (code) => resolve({ code, output: output.trim() }));
    // The installer is a GUI app in headless mode; it should never take long.
    setTimeout(() => { try { child.kill(); } catch {} }, 120000);
  });
}

// Files the ReShade installer creates on its own. Anything it drops that was
// not there before is ours to clean up on restore.
function listDir(dir) {
  try {
    return new Set(fs.readdirSync(dir));
  } catch {
    return new Set();
  }
}

function newReShadeFiles(dir, known) {
  return fs.readdirSync(dir).filter((f) => !known.has(f) && /^ReShade|^reshade-shaders$/i.test(f));
}

// The installer writes a blank preset at whatever path ReShade.ini names, so a
// preset the user already tuned has to be copied aside first.
async function backupReShadeConfig(gameDir, exeDir, manifest) {
  const ini = path.join(exeDir, 'ReShade.ini');
  const targets = [ini];
  if (fs.existsSync(ini)) {
    const text = fs.readFileSync(ini, 'utf8');
    const preset = (text.match(/^PresetPath=(.+)$/m) || [])[1];
    if (preset) targets.push(path.resolve(exeDir, preset.trim()));
  }
  for (const target of targets) {
    if (!fs.existsSync(target)) continue;
    const rel = path.relative(gameDir, target);
    if (rel.startsWith('..')) continue;
    const backupPath = path.join(backupRoot(gameDir), rel);
    if (!fs.existsSync(backupPath)) await copyOver(target, backupPath);
    if (!manifest.replaced.some((r) => r.rel === rel)) {
      manifest.replaced.push({ rel, kind: 'config' });
    }
  }
}

// Keeps ReShade from starting with our add-on switched off.
function enableAddonInIni(exeDir, addonName, log) {
  const ini = path.join(exeDir, 'ReShade.ini');
  if (!fs.existsSync(ini)) return;
  let text = fs.readFileSync(ini, 'utf8');
  const stem = addonName.replace(/\.addon(64)?$/i, '');
  const match = text.match(/^DisabledAddons=(.*)$/m);
  if (match && match[1].toLowerCase().includes(stem.toLowerCase())) {
    text = text.replace(/^DisabledAddons=.*$/m, 'DisabledAddons=');
    fs.writeFileSync(ini, text, 'utf8');
    log('addonEnabledInIni');
  }
}

async function applySwap(config, onLog) {
  const log = (code, params) => onLog && onLog({ code, params: params || {} });
  const {
    gameDir, exePath, api, source, reshadeSetup,
    installReShade, addMissingDlss, addStreamline, upgradeReShade
  } = config;
  const exeDir = path.dirname(exePath);

  if (!canWrite(exeDir)) throw fail('errNoWriteAccess');
  if (!source.hasNeuralRendering) throw fail('errNoNeuralRuntime');

  const scan = await scanGame(gameDir);
  const manifest = {
    version: 1,
    date: new Date().toISOString(),
    game: { dir: gameDir, exe: path.relative(gameDir, exePath), api },
    replaced: [],
    added: [],
    reshade: { installedByUs: false, file: null, filesAdded: [] }
  };

  const payloadByName = new Map(source.payload.map((f) => [f.name.toLowerCase(), f]));
  const existing = [...scan.dlssFiles, ...scan.streamlineFiles];

  // 1) Upgrade every DLSS/Streamline DLL the game already ships, wherever it
  //    lives - Unreal titles bury them under Engine/Binaries/ThirdParty.
  for (const file of existing) {
    const replacement = payloadByName.get(file.name.toLowerCase());
    if (!replacement) continue;
    if (replacement.version && replacement.version === file.version) {
      log('skipSameVersion', { rel: file.rel, version: file.version });
      continue;
    }
    const backupPath = path.join(backupRoot(gameDir), file.rel);
    if (!fs.existsSync(backupPath)) await copyOver(file.path, backupPath);
    await copyOver(replacement.path, file.path);
    manifest.replaced.push({ rel: file.rel, oldVersion: file.version, newVersion: replacement.version });
    log('replaced', { rel: file.rel, from: file.version, to: replacement.version });
  }

  // 2) Files that have to sit beside the executable no matter what the game
  //    shipped: the add-on, and the neural-rendering runtime it loads.
  const beside = ['nvngx_dlssnr.dll'];
  if (addMissingDlss) beside.push('nvngx_dlss.dll', 'nvngx_dlssg.dll');
  if (addStreamline) {
    for (const f of source.payload) if (/^sl\./i.test(f.name)) beside.push(f.name);
  }

  for (const name of new Set(beside)) {
    const item = payloadByName.get(name.toLowerCase());
    if (!item) continue;
    const dest = path.join(exeDir, name);
    const rel = path.relative(gameDir, dest);
    if (manifest.replaced.some((r) => r.rel.toLowerCase() === rel.toLowerCase())) continue;
    if (fs.existsSync(dest)) {
      const current = pe.getFileVersion(dest);
      if (current === item.version) {
        log('skipSameVersion', { rel, version: current });
        continue;
      }
      const backupPath = path.join(backupRoot(gameDir), rel);
      if (!fs.existsSync(backupPath)) await copyOver(dest, backupPath);
      manifest.replaced.push({ rel, oldVersion: current, newVersion: item.version });
      log('replaced', { rel, from: current, to: item.version });
    } else {
      manifest.added.push(rel);
      log('added', { rel, version: item.version });
    }
    await copyOver(item.path, dest);
  }

  // 3) The RenoDX add-on itself.
  if (source.addon) {
    const addonName = path.basename(source.addon);
    const dest = path.join(exeDir, addonName);
    const rel = path.relative(gameDir, dest);
    if (fs.existsSync(dest)) {
      const backupPath = path.join(backupRoot(gameDir), rel);
      if (!fs.existsSync(backupPath)) await copyOver(dest, backupPath);
      manifest.replaced.push({
        rel,
        oldVersion: pe.getFileVersion(dest),
        newVersion: pe.getFileVersion(source.addon)
      });
    } else {
      manifest.added.push(rel);
    }
    await copyOver(source.addon, dest);
    log('addonInstalled', { name: addonName });
  }

  // 4) ReShade - the add-on is loaded by ReShade, so without it nothing runs.
  const before = scan.reshade;
  const setupVersion = reshadeSetup ? (reshadeSetup.match(/(\d+\.\d+\.\d+)/) || [])[1] : null;
  const setupIsNewer = before.installed && compareVersions(setupVersion, before.version) > 0;
  const haveSetup = reshadeSetup && fs.existsSync(reshadeSetup);
  manifest.reshade.file = before.file;

  // A modded game loads ReShade as an .asi through its own loader. Installing a
  // dxgi.dll proxy on top of that gives the game two ReShades at once, so the
  // only safe move is to upgrade the .asi in place.
  const upgradingAsi = upgradeReShade && before.kind === 'asi' && setupIsNewer;
  const upgradingProxy = upgradeReShade && before.kind === 'proxy' && setupIsNewer;
  const installingFresh = installReShade && (!before.installed || (before.kind === 'proxy' && !before.addonSupport));

  if (!haveSetup && (installingFresh || upgradingAsi || upgradingProxy)) {
    log('reshadeSetupMissing');
  } else if (upgradingAsi) {
    const asiRel = path.relative(gameDir, path.join(exeDir, before.file));
    const asiBackup = path.join(backupRoot(gameDir), asiRel);
    if (!fs.existsSync(asiBackup)) await copyOver(path.join(exeDir, before.file), asiBackup);
    await backupReShadeConfig(gameDir, exeDir, manifest);

    const known = listDir(exeDir);
    const proxyPath = path.join(exeDir, 'dxgi.dll');
    const proxyExisted = fs.existsSync(proxyPath);
    const result = await runSetup(reshadeSetup, [exePath, '--api', api, '--headless'], log);
    manifest.reshade.filesAdded = newReShadeFiles(exeDir, known);
    if (!fs.existsSync(proxyPath)) {
      throw fail('errReShadeExtract', { exit: result.code, output: result.output });
    }
    await copyOver(proxyPath, path.join(exeDir, before.file));
    if (!proxyExisted) await fs.promises.unlink(proxyPath);
    manifest.replaced.push({ rel: asiRel, oldVersion: before.version, newVersion: setupVersion });
    log('asiUpgraded', { file: before.file, from: before.version, to: setupVersion });
  } else if (upgradingProxy) {
    const rel = path.relative(gameDir, path.join(exeDir, before.file));
    const backupPath = path.join(backupRoot(gameDir), rel);
    if (!fs.existsSync(backupPath)) await copyOver(path.join(exeDir, before.file), backupPath);
    await backupReShadeConfig(gameDir, exeDir, manifest);
    const known = listDir(exeDir);
    const result = await runSetup(reshadeSetup, [exePath, '--api', api, '--headless'], log);
    manifest.reshade.filesAdded = newReShadeFiles(exeDir, known);
    const after = (await scanGame(gameDir)).reshade;
    if (!after.installed) throw fail('errReShadeUpgrade', { exit: result.code, output: result.output });
    manifest.replaced.push({ rel, oldVersion: before.version, newVersion: after.version });
    log('proxyUpgraded', { from: before.version, to: after.version });
  } else if (installingFresh) {
    await backupReShadeConfig(gameDir, exeDir, manifest);
    const known = listDir(exeDir);
    const result = await runSetup(reshadeSetup, [exePath, '--api', api, '--headless'], log);
    const after = (await scanGame(gameDir)).reshade;
    if (after.installed && after.addonSupport) {
      manifest.reshade.installedByUs = !before.installed;
      manifest.reshade.file = after.file;
      manifest.reshade.filesAdded = newReShadeFiles(exeDir, known);
      log('reshadeInstalled', { version: after.version, file: after.file });
    } else if (after.installed) {
      log('reshadeNoAddonSupport');
    } else {
      throw fail('errReShadeInstall', { exit: result.code, output: result.output });
    }
  } else if (before.installed) {
    log('reshadeAlreadyThere', {
      version: before.version,
      file: before.file,
      kind: before.kind,
      addonSupport: before.addonSupport
    });
    if (setupIsNewer) log('reshadeNewerAvailable', { version: setupVersion });
  }

  if (source.addon) enableAddonInIni(exeDir, path.basename(source.addon), log);

  await fs.promises.mkdir(backupRoot(gameDir), { recursive: true });
  await fs.promises.writeFile(
    path.join(backupRoot(gameDir), MANIFEST),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );

  log('applyDone');
  return manifest;
}

async function restore(gameDir, onLog) {
  const log = (code, params) => onLog && onLog({ code, params: params || {} });
  const manifestPath = path.join(backupRoot(gameDir), MANIFEST);
  if (!fs.existsSync(manifestPath)) throw fail('errNoBackup');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  for (const item of manifest.replaced) {
    const backupPath = path.join(backupRoot(gameDir), item.rel);
    const target = path.join(gameDir, item.rel);
    if (fs.existsSync(backupPath)) {
      await copyOver(backupPath, target);
      log('restored', { rel: item.rel, version: item.oldVersion || null, kind: item.kind || null });
    }
  }
  for (const rel of manifest.added) {
    const target = path.join(gameDir, rel);
    if (fs.existsSync(target)) {
      await fs.promises.unlink(target);
      log('deleted', { rel });
    }
  }

  const exeDir = path.dirname(path.join(gameDir, manifest.game.exe));
  const leftovers = [...(manifest.reshade.filesAdded || [])];
  // The hook DLL goes only when we were the ones who put it there.
  if (manifest.reshade.installedByUs && manifest.reshade.file) leftovers.push(manifest.reshade.file);
  for (const name of leftovers) {
    const target = path.join(exeDir, name);
    if (!fs.existsSync(target)) continue;
    try {
      await fs.promises.rm(target, { recursive: true, force: true });
      log('deleted', { rel: name });
    } catch {}
  }

  await fs.promises.rename(manifestPath, manifestPath + '.done');
  log('restoreDone');
  return true;
}

module.exports = { applySwap, restore, canWrite, backupRoot, compareVersions };

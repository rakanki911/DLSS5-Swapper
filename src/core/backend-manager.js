'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const journal = require('./file-journal');
const core = require('./apply');
const ini = require('./feeder-config');
const optiscaler = require('./optiscaler');
const compatibility = require('./compatibility');

function readManifest(gameDir) {
  const file = path.join(core.backupRoot(gameDir), 'manifest.json');
  if (!fs.existsSync(file)) return null;
  journal.safePath(gameDir, path.relative(gameDir, file));
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (manifest.version !== 1) throw Object.assign(new Error('errBackupInvalid'), { code: 'errBackupInvalid' });
  return manifest;
}
function profileFile(gameDir, exePath, api, route) {
  // The profile file is named after the route, so this list is what decides
  // whether a route can keep its own settings at all - and a route missing
  // from it fails the install with nothing but "Invalid route".
  if (!['native', 'feeder', 'optiscaler', 'renodx'].includes(route)) throw new Error('Invalid route');
  const id = crypto.createHash('sha256').update(`${path.relative(gameDir, exePath).toLowerCase()}|${api}`).digest('hex').slice(0, 24);
  return journal.safePath(gameDir, `_DLSS5_Backup/.profiles/${id}-${route}.json`);
}
// What a settings file may be called. ReShade lets a preset be named anything,
// and mod packs routinely ship one as .txt - the writer stored those and the
// reader then refused them, which left the game unable to be installed at all
// until someone deleted the profile by hand. One list, used by both.
const CONFIG_FILE = /\.(ini|cfg|txt)$/i;

function configPaths(gameDir, exePath, route) {
  const dir = path.dirname(exePath);
  if (route === 'optiscaler') return [path.join(dir, 'OptiScaler.ini')];
  const reshade = path.join(dir, 'ReShade.ini');
  const preset = ini.presetPath(dir, ini.readText(reshade));
  const files = [reshade, path.join(dir, 'dlss5-feed.cfg'), path.join(dir, 'host64', 'ReShade.ini')];
  const rel = path.relative(gameDir, preset);
  if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) files.push(preset);
  return files.filter(file => CONFIG_FILE.test(file));
}
async function saveProfile(gameDir, old) {
  const exe = journal.safePath(gameDir, old.game.exe);
  const route = old.route || (old.game.bitness === 32 ? 'feeder' : 'native');
  const files = {};
  for (const file of configPaths(gameDir, exe, route)) {
    const rel = path.relative(gameDir, file);
    journal.safePath(gameDir, rel);
    if (fs.existsSync(file) && fs.statSync(file).size < 4 * 1024 * 1024) files[rel] = ini.readText(file);
  }
  const file = profileFile(gameDir, exe, old.game.api, route);
  await journal.capture(gameDir, file);
  await journal.atomicJson(file, { version: 1, files });
}
function loadProfile(config) {
  const file = profileFile(config.gameDir, config.exePath, config.api, config.route);
  if (!fs.existsSync(file)) return {};
  const profile = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (profile.version !== 1 || !profile.files || typeof profile.files !== 'object') throw new Error('Invalid backend profile');
  const files = {};
  for (const [rel, text] of Object.entries(profile.files)) {
    journal.safePath(config.gameDir, rel);
    // A path escaping the game, a non-string, an oversized blob or anything
    // aimed at the backup folder is refused: that is tampering, not a setting.
    if (typeof text !== 'string' || text.length > 4 * 1024 * 1024 || rel.toLowerCase().includes('_dlss5_backup')) {
      throw new Error('Invalid backend profile');
    }
    // Anything that is not a settings file is simply not restored, rather than
    // making the whole install impossible.
    if (CONFIG_FILE.test(rel)) files[rel] = text;
  }
  return files;
}
async function install(config, log = () => {}) {
  compatibility.assertSafeTarget(config.gameDir, config.exePath);
  compatibility.assertAntiCheatConsent(config.gameDir, config.exePath, config.antiCheatAcknowledged);
  const old = readManifest(config.gameDir);
  const changed = old && (old.route !== config.route || old.game.api !== config.api ||
    old.game.exe.toLowerCase() !== path.relative(config.gameDir, config.exePath).toLowerCase());
  // Global Vulkan registration has shared ownership. Until an explicit layer
  // migration is available, require restoring first instead of changing other
  // games' registration or leaving it behind during a failed transaction.
  if (changed && (old.game.api === 'vulkan' || config.api === 'vulkan')) {
    throw Object.assign(new Error('errBackendVulkanSwitch'), { code: 'errBackendVulkanSwitch' });
  }
  // ReShade's global Vulkan registration is not a game-local transaction.
  // Keep its existing recoverable partial manifest on failure instead of
  // rolling that manifest away while leaving a shared layer registered.
  if (config.api === 'vulkan' && config.route === 'feeder') {
    compatibility.assertLoaderCompatible(config, old);
    const profile = !old ? loadProfile(config) : {};
    if (Object.keys(profile).length) {
      const manifest = core.beginManifest(config.gameDir, config.exePath, config.api);
      manifest.route = config.route;
      for (const [rel, text] of Object.entries(profile)) await core.writeTracked(manifest, config.gameDir, journal.safePath(config.gameDir, rel), text, { kind: 'config' });
    }
    return core.applySwap(config, log);
  }
  return journal.transaction(config.gameDir, async () => {
    if (!old && config.route !== 'optiscaler') {
      // Native ReShade may already have an untouched custom preset. Capture
      // its original bytes before the first managed session, while saving
      // subsequent user tuning separately for round-trip backend switches.
      const initial = core.beginManifest(config.gameDir, config.exePath, config.api);
      for (const file of configPaths(config.gameDir, config.exePath, config.route)) {
        if (fs.existsSync(file)) await core.trackBeforeWrite(initial, config.gameDir, file, { kind: 'config' });
      }
      await core.saveActiveManifest(config.gameDir, initial);
    }
    if (changed) {
      log({ code: 'backendSwitching', params: { from: old.route, to: config.route } });
      await saveProfile(config.gameDir, old);
      await core.restoreFiles(config.gameDir, old, log);
    }
    if (config.route !== 'optiscaler') compatibility.assertLoaderCompatible(config, changed ? null : old);
    const profile = changed || !old ? loadProfile(config) : {};
    if (config.route !== 'optiscaler' && Object.keys(profile).length) {
      const manifest = core.beginManifest(config.gameDir, config.exePath, config.api);
      for (const [rel, text] of Object.entries(profile)) {
        await core.writeTracked(manifest, config.gameDir, journal.safePath(config.gameDir, rel), text, { kind: 'config' });
      }
    }
    let manifest;
    if (config.route === 'optiscaler') manifest = await optiscaler.install({ ...config, profile }, log);
    else manifest = await core.applySwap(config, log);
    for (const companion of config.route === 'native' ? (config.companions || []) : []) {
      const dest = path.join(path.dirname(config.exePath), path.basename(companion));
      await core.copyTracked(manifest, config.gameDir, companion, dest, { kind: 'addon' });
      await core.enableAddonInIni(path.dirname(config.exePath), path.basename(companion),
        (code, params) => log({ code, params }), config.gameDir, manifest);
    }
    if (config.route === 'optiscaler' && old && old.route !== 'optiscaler') manifest.previousReShadeRoute = old.route;
    await core.saveActiveManifest(config.gameDir, manifest);
    return manifest;
  });
}
async function restore(gameDir, log = () => {}) {
  const recovered = await journal.recover(gameDir);
  if (recovered) log({ code: 'backendRecovered', params: {} });
  const old = readManifest(gameDir);
  if (!old) return recovered;
  // Keep the last tuning even when the user chooses a complete uninstall.
  try { await saveProfile(gameDir, old); }
  catch (error) { log({ code: 'restoreProfileWarning', params: { error: error.message } }); }
  await core.restore(gameDir, log);
  return true;
}
module.exports = { install, restore, readManifest, saveProfile, loadProfile };

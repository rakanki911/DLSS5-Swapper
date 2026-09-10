'use strict';
// Read-only preflight. Never remove/bypass anti-cheat or overwrite another
// graphics injector to make installation appear successful.
const fs = require('fs');
const path = require('path');
const pe = require('./pe');
const guards = require('./install-guards');
const { inspectReShade, isVulkanWrapper } = require('./scan');
const { safePath } = require('./file-journal');

function problem(code, message) { return Object.assign(new Error(message || code), { code }); }
function hasFile(dir, name) {
  try { return fs.readdirSync(dir).some(item => item.toLowerCase() === name.toLowerCase()); }
  catch { return false; }
}
function managedModRoot(gameDir, exePath) {
  // MO2/Root Builder may deploy and remove hooks at launch. Installing into
  // its Stock Game behind the manager's back would not be persistent/safe.
  let dir = exePath ? path.dirname(exePath) : gameDir;
  for (let depth = 0; depth < 5; depth++) {
    if (hasFile(dir, 'ModOrganizer.exe') && hasFile(dir, 'Stock Game')) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
function hasAntiCheat(gameDir, exePath) {
  const dirs = [gameDir, ...(exePath ? [path.dirname(exePath)] : [])];
  return dirs.some(dir => /(?:^|[\\/])arc[ _-]?raiders(?:[\\/]|$)/i.test(dir)) ||
    dirs.some(dir => guards.antiCheatPresent(dir));
}
function targetIssue(gameDir, exePath) {
  // Anti-cheat is a user-acknowledged risk, not a compatibility hard block.
  // Keep independent mod-manager/file-conflict protections in place.
  if (managedModRoot(gameDir, exePath)) return 'errManagedModpack';
  return null;
}
// Shader Model 5.1 arrived with the Windows 10 SDK, and the neural pass is
// compiled as cs_5_1. A game that ships an older D3DCompiler_47.dll beside
// its executable - Spider-Man Remastered carries 6.3.9600 from Windows 8.1 -
// gets that copy loaded in preference to the current one in System32, and the
// pass then compiles to nothing while everything else reports success.
function oldShaderCompiler(exeDir, readVersion = pe.getFileVersion) {
  const file = path.join(exeDir, 'D3DCompiler_47.dll');
  let version;
  try {
    if (!fs.existsSync(file)) return null;
    version = readVersion(file);
  } catch { return null; }
  // A version that cannot be read says nothing either way, and is left alone.
  const major = /^(\d+)\./.exec(String(version || ''));
  if (!major || Number(major[1]) >= 10) return null;
  return { file, version };
}
function assertSafeTarget(gameDir, exePath) {
  const issue = targetIssue(gameDir, exePath);
  if (issue) throw problem(issue);
}
function assertAntiCheatConsent(gameDir, exePath, acknowledged) {
  if (hasAntiCheat(gameDir, exePath) && acknowledged !== true) throw problem('errAntiCheatConsent');
}
function assertLoaderCompatible(config, manifest) {
  const { gameDir, exePath, api, bitness, route } = config;
  const dir = path.dirname(exePath);
  const legacy = api === 'd3d8' || api === 'd3d9';
  const hook = api === 'opengl' ? 'opengl32.dll' : 'dxgi.dll';
  const owned = new Set([...(manifest?.added || []), ...(manifest?.replaced || []).map(item => item.rel)]
    .filter(item => typeof item === 'string').map(item => item.replace(/\\/g, '/').toLowerCase()));
  const reshade = inspectReShade(dir);
  let reshadeHooks = 0;
  // An external ASI ReShade can be reused by native mode, but Feeder must not
  // install a second copy under DXGI (or silently replace a vanilla ASI).
  if (reshade.installed && reshade.kind === 'asi' && (route === 'feeder' || !reshade.addonSupport)) {
    throw problem('errLoaderConflict', reshade.file);
  }
  for (const name of fs.readdirSync(dir)) {
    if (!/^(dxgi|ddraw|d3d8|d3d9|d3d10|d3d10core|d3d11|d3d12|opengl32)\.dll$/i.test(name)) continue;
    const file = safePath(gameDir, path.relative(gameDir, path.join(dir, name)));
    if (pe.versionMentions(file, 'ReShade') && ++reshadeHooks > 1) throw problem('errLoaderConflict', 'Multiple ReShade hooks: ' + dir);
    const key = path.relative(gameDir, file).replace(/\\/g, '/').toLowerCase();
    if (owned.has(key)) continue;
    // A Vulkan translation layer deliberately retains DirectX DLL names.
    // ReShade's Vulkan route does not replace these files. Recognize the
    // wrapper's contents, not just its name; unrelated injectors stay blocked.
    if (api === 'vulkan' && route === 'feeder' && isVulkanWrapper(file, bitness)) continue;
    // Reuse one compatible add-on ReShade for native mode. Feeder can update
    // the expected hook in place, but not a different hook that would remain
    // loaded alongside it (e.g. a D3D9 ReShade before the DX11 wrapper).
    if (pe.versionMentions(file, 'ReShade') && pe.getBitness(file) === bitness && reshade.kind !== 'asi' &&
        (route === 'native' ? reshade.addonSupport : name.toLowerCase() === hook && api !== 'vulkan')) continue;
    if (legacy && name.toLowerCase() === `${api}.dll` && pe.versionMentions(file, 'dgVoodoo') && pe.getBitness(file) === bitness) continue;
    throw problem('errLoaderConflict', path.relative(gameDir, file));
  }
}
module.exports = { targetIssue, hasAntiCheat, oldShaderCompiler, assertSafeTarget, assertAntiCheatConsent, assertLoaderCompatible, managedModRoot };

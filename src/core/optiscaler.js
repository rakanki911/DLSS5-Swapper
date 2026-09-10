'use strict';

const fs = require('fs');
const path = require('path');
const extractZip = require('extract-zip');
const pe = require('./pe');
const ini = require('./feeder-config');
const { cached, fetchVerified } = require('./runtime-components');
const { safePath } = require('./file-journal');
// More than one pinned build, because upgrading one broke a game and there was
// no way back: No Man's Sky runs on 0.1.1.5 and crashes on 0.2.0-patch1, and
// the only cure anybody had was to keep an old copy of the whole app (#238).
//
// This is not the "put your own DLL in the components folder" that #191 asked
// for and that the folder deliberately refuses. Every entry here is pinned by
// URL and by digest exactly as the single one was; there is simply a second
// one, and a game may name it. Nothing unverified becomes installable.
const RELEASES = Object.freeze([
  Object.freeze({
    version: '0.2.0-patch1',
    url: 'https://github.com/Dagherbou/OptiScaler_DLSSNR/releases/download/v0.2.0-patch1/OptiScaler-DLSSNR-v0.2.0-onimusha-fix.zip',
    sha256: '5db547216fa8a7dbd8ab0a193da1e3bce0ea4bd71f91189afa4ed2ede8bb9561',
    licenseUrl: 'https://raw.githubusercontent.com/Dagherbou/OptiScaler_DLSSNR/393e070/LICENSE',
    licenseHash: '3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986'
  }),
  // What 2.2.1 shipped. Same archive layout, so it satisfies the same
  // validation; kept for the titles the newer build regressed on.
  Object.freeze({
    version: '0.1.1.5-dlssnr',
    url: 'https://github.com/Dagherbou/OptiScaler_DLSSNR/releases/download/v0.1.1.5-dlssnr/OptiScaler-DLSSNR-v0.1.1.5-dlssnr.zip',
    sha256: '735b10b4077bc187ba4d07d607e864349aca386344c6126aba61ced746d27ece',
    licenseUrl: 'https://raw.githubusercontent.com/Dagherbou/OptiScaler_DLSSNR/393e070/LICENSE',
    licenseHash: '3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986'
  })
]);
const RELEASE = RELEASES[0];
// An unknown name resolves to the current build rather than failing: a state
// file naming a version this app no longer carries must not stop an install.
const releaseFor = (version) => RELEASES.find((r) => r.version === version) || RELEASE;
const LIBRARIES = [
  'libxess.dll', 'libxess_dx11.dll', 'libxess_fg.dll', 'libxell.dll',
  'amd_fidelityfx_vk.dll', 'amd_fidelityfx_upscaler_dx12.dll',
  'amd_fidelityfx_loader_dx12.dll', 'amd_fidelityfx_framegeneration_dx12.dll',
  'D3D12_OptiScaler/D3D12Core.dll'
];
const LICENSES = ['DirectX_LICENSE.txt', 'FidelityFX_v2_LICENSE.md', 'RenoDX_ATTRIBUTION.txt', 'XeSS_LICENSE.txt'];
function fail(code, message = code) { return Object.assign(new Error(message), { code }); }
function validatePayload(root) {
  for (const rel of ['OptiScaler.dll', 'nvngx.dll_dlssnr.dll', ...LIBRARIES.map(f => 'OptiScaler/' + f)]) {
    if (pe.getBitness(safePath(root, rel)) !== 64) throw fail('errOptiPayload');
  }
  for (const rel of ['OptiScaler.ini', 'READ ME - DLSS Neural Rendering.txt', ...LICENSES.map(f => 'Licenses/' + f)]) {
    if (!fs.existsSync(safePath(root, rel))) throw fail('errOptiPayload');
  }
}
async function ensureOptiScaler(cacheRoot, version) {
  const release = releaseFor(version);
  const base = path.join(path.resolve(cacheRoot), 'components', `OptiScaler-${release.version}`);
  const archive = base + '.zip';
  if (!cached(archive, release.sha256)) await fetchVerified(release.url, release.sha256, archive);
  // Re-extract verified bytes on every install. The installer below copies an
  // explicit file list, not unknown files that may have appeared in the cache.
  await extractZip(archive, { dir: base });
  const license = path.join(base, 'OptiScaler-GPL-3.0.txt');
  if (!cached(license, release.licenseHash)) await fetchVerified(release.licenseUrl, release.licenseHash, license);
  validatePayload(base);
  return base;
}
function hookFor(api) { return api === 'vulkan' ? 'winmm.dll' : 'dxgi.dll'; }
function configure(text, target) {
  let out = text;
  for (const [section, key, value] of [
    ['DlssNr', 'Enabled', 'true'], ['Log', 'LogToFile', 'true'], ['Log', 'LogLevel', '2'],
    ['Spoofing', 'Dxgi', 'false'], ['Plugins', 'LoadAsiPlugins', 'false'],
    ['ProcessFilter', 'TargetProcessName', path.basename(target.exePath)]
  ]) out = ini.setIni(out, section, key, value);
  // DX11/Vulkan NR needs the documented D3D12 bridge, not native DLSS output.
  // Set defaults for all APIs: games can change renderer via launch arguments
  // without changing their executable's import table or scanner result.
  for (const field of ['Dx12Upscaler', 'Dx11Upscaler', 'VulkanUpscaler']) {
    const current = ini.getIni(out, 'Upscalers', field);
    const bridge = field !== 'Dx12Upscaler';
    if (!current || current === 'auto' || (bridge && !current.endsWith('_12'))) {
      out = ini.setIni(out, 'Upscalers', field, bridge ? 'ffx_12' : 'dlss');
    }
  }
  return out;
}
function copyPlan(root, api) {
  return [
    ['OptiScaler.dll', hookFor(api)], ['nvngx.dll_dlssnr.dll', 'nvngx.dll_dlssnr.dll'],
    ...LIBRARIES.map(f => ['OptiScaler/' + f, 'OptiScaler/' + f]),
    ...LICENSES.map(f => ['Licenses/' + f, 'OptiScaler/licenses/' + f]),
    ['OptiScaler-GPL-3.0.txt', 'OptiScaler/licenses/LICENSE.GPL-3.0.txt'],
    ['READ ME - DLSS Neural Rendering.txt', 'OptiScaler/README-DLSSNR.txt']
  ].map(([from, to]) => ({ from: safePath(root, from), to }));
}
function checkConflicts(gameDir, exePath, manifest, api) {
  // Inspect the baseline too: switching restores it before installing. Never
  // silently clobber another proxy, OptiScaler install or ASI loader.
  const { originalPath } = require('./apply');
  const exeDir = path.dirname(exePath);
  const added = new Set((manifest?.added || []).map(f => f.toLowerCase()));
  const replacements = new Map((manifest?.replaced || []).map(f => [f.rel.toLowerCase(), f]));
  const names = new Set([...fs.readdirSync(exeDir), 'dxgi.dll', 'winmm.dll', 'OptiScaler.ini']);
  const hook = hookFor(api);
  for (const name of names) {
    if (!/^(?:dxgi|winmm|version|dbghelp|dbgcore|d3d12|d3d11|d3d9|opengl32|wininet|winhttp|nvngx|nvapi64|OptiScaler)\.(?:dll|ini|asi)$/i.test(name) && !/\.asi$/i.test(name)) continue;
    const rel = path.relative(gameDir, path.join(exeDir, name));
    if (added.has(rel.toLowerCase())) continue;
    const file = replacements.has(rel.toLowerCase()) ? originalPath(gameDir, manifest, rel) : safePath(gameDir, rel);
    if (!fs.existsSync(file)) continue;
    // A pre-existing ReShade under the selected proxy name can be replaced
    // with a tracked backup. Other proxies require explicit user cleanup.
    if (name.toLowerCase() === hook && pe.versionMentions(file, 'ReShade')) continue;
    // dbghelp/dbgcore are on the list because Ultimate ASI Loader ships under
    // those names - but they are also genuine Windows components that games
    // ship for their own crash reporting. Cyberpunk 2077 carries both, and
    // every OptiScaler install there was refused as "another loader/mod".
    // Microsoft own the real ones; the loaders do not claim to.
    if (/^dbg(?:help|core)\.dll$/i.test(name) && pe.versionMentions(file, 'Microsoft')) continue;
    throw fail('errOptiConflict', `Conflicting pre-existing file: ${path.join(exeDir, name)}. Restore/remove the other mod with its own installer first.`);
  }
  const pluginDir = path.join(exeDir, 'OptiScaler', 'plugins');
  if (fs.existsSync(pluginDir) && fs.readdirSync(pluginDir).some(f => /\.(dll|asi)$/i.test(f))) throw fail('errOptiConflict', 'Existing OptiScaler plugins need to be removed with their original installer first.');
  for (const name of LIBRARIES) {
    const rel = path.relative(gameDir, path.join(exeDir, 'OptiScaler', name));
    if (!added.has(rel.toLowerCase()) && fs.existsSync(safePath(gameDir, rel))) throw fail('errOptiConflict', `Pre-existing OptiScaler component: ${rel}`);
  }
}
async function install(config, log) {
  const { beginManifest, copyTracked, writeTracked, saveActiveManifest } = require('./apply');
  const { gameDir, exePath, api, optiRoot, source } = config;
  validatePayload(optiRoot);
  const nr = source.payload.find(f => f.name.toLowerCase() === 'nvngx_dlssnr.dll');
  if (!nr || pe.getBitness(nr.path) !== 64) throw fail('errNoNeuralRuntime');
  const manifest = beginManifest(gameDir, exePath, api);
  manifest.route = 'optiscaler';
  manifest.game.bitness = 64;
  manifest.game.apiLabel = config.apiLabel;
  manifest.optiscaler = { version: RELEASE.version, hook: hookFor(api) };
  const exeDir = path.dirname(exePath);
  for (const item of copyPlan(optiRoot, api)) {
    const rel = await copyTracked(manifest, gameDir, item.from, path.join(exeDir, item.to), { kind: 'optiscaler' });
    log({ code: 'added', params: { rel } });
  }
  // The model that ships here is NVIDIA's stock one, which runs on Blackwell.
  // Older architectures need a modded build, supplied by the person for their
  // own card, and copying ours over it would quietly break exactly the setup
  // they came here with. An existing model is left alone; ours is installed
  // only when there is none.
  const model = path.join(exeDir, nr.name);
  if (fs.existsSync(model)) {
    log({ code: 'neuralModelKept', params: { rel: path.relative(gameDir, model) } });
  } else {
    await copyTracked(manifest, gameDir, nr.path, model, { kind: 'runtime' });
  }
  const file = path.join(exeDir, 'OptiScaler.ini');
  const prior = config.profile?.[path.relative(gameDir, file)] ?? ini.readText(file);
  await writeTracked(manifest, gameDir, file, configure(prior || ini.readText(path.join(optiRoot, 'OptiScaler.ini')), config), { kind: 'config' });
  await saveActiveManifest(gameDir, manifest);
  return manifest;
}
module.exports = { RELEASE, RELEASES, releaseFor, LIBRARIES, ensureOptiScaler, validatePayload, configure, copyPlan, hookFor, checkConflicts, install };

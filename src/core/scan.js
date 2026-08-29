'use strict';
// Works out everything the swap needs to know about a game folder:
// which executable is the game, which rendering API it uses, where the
// existing DLSS/Streamline files live, and whether ReShade is already there.
const fs = require('fs');
const path = require('path');
const pe = require('./pe');

const SKIP_DIRS = new Set([
  '_dlss5_backup', 'reshade-shaders', 'node_modules', '.git',
  '_redist', 'prerequisites', 'directx', 'redist', '_commonredist', 'dotnet',
  // Shipped installers and vendor helpers keep their own executables around.
  'installer_resources', 'installer', 'installers', 'support', 'vcredist',
  '_support', 'directx_redist', 'eaanticheat', 'easyanticheat', 'battleye',
  // Never touch copies the user (or another tool) parked as a backup.
  'backup', 'backups', '_backup', 'bak', 'old', 'original', 'originals'
]);

// Installers, launchers and anti-cheat helpers are never the game itself.
const NOT_A_GAME = /^(unins|setup|install|vcredist|vc_redist|dxsetup|dxwebsetup|oalinst|uninstall|crashreport|crashhandler|easyanticheat|eac|battleye|be_service|launcher|activation|patch|update|dotnetfx|touchup|rapidcrc|autorun|autoplay|quicksfv|readme|config|benchmark|report|helper|service|cleanup)/i;

const DLSS_FILE = /^(nvngx_dlss[a-z_]*\.dll|nvngx\.dll|_nvngx\.dll)$/i;
const STREAMLINE_FILE = /^sl\.[a-z_]+\.dll$/i;
const RESHADE_HOOKS = ['dxgi.dll', 'd3d12.dll', 'd3d11.dll', 'd3d9.dll', 'opengl32.dll', 'dinput8.dll'];

async function walk(root, onFile, maxDepth = 8) {
  const queue = [{ dir: root, depth: 0 }];
  while (queue.length) {
    const { dir, depth } = queue.shift();
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (depth < maxDepth && !SKIP_DIRS.has(entry.name.toLowerCase())) {
          queue.push({ dir: full, depth: depth + 1 });
        }
      } else if (entry.isFile()) {
        await onFile(full, entry.name, depth);
      }
    }
  }
}

// The version resource of an Addon build looks identical to a plain one, so
// the only honest test is whether the binary carries the add-on loader itself.
function hasAddonSupport(file) {
  try {
    return fs.readFileSync(file).includes(Buffer.from('Searching for add-ons'));
  } catch {
    return false;
  }
}

// ReShade proxies itself as a system DLL, so a d3d12.dll/dxgi.dll sitting next
// to the game is either ReShade or something else entirely — the version
// resource is what tells them apart. Modded games (GTA V with an ASI loader)
// instead run it as ReShade.asi, which must not be doubled up with a proxy.
function inspectReShade(exeDir) {
  let names = [...RESHADE_HOOKS];
  try {
    names = names.concat(fs.readdirSync(exeDir).filter((f) => /\.asi$/i.test(f)));
  } catch {}

  for (const name of names) {
    const file = path.join(exeDir, name);
    if (!fs.existsSync(file)) continue;
    if (pe.versionMentions(file, 'ReShade')) {
      return {
        installed: true,
        file: name,
        kind: /\.asi$/i.test(name) ? 'asi' : 'proxy',
        version: pe.getFileVersion(file),
        addonSupport: hasAddonSupport(file)
      };
    }
  }
  return { installed: false, file: null, kind: null, version: null, addonSupport: false };
}

// Entry points a game asks for by name when it loads Direct3D at runtime.
const API_MARKERS = ['D3D12CreateDevice', 'D3D11CreateDevice', 'CreateDXGIFactory', 'vkCreateInstance', 'wglCreateContext'];

function apiFromNames(imports) {
  const has = (n) => imports.includes(n);
  if (has('d3d12.dll')) return { api: 'dxgi', label: 'DirectX 12' };
  if (has('d3d11.dll')) return { api: 'dxgi', label: 'DirectX 11' };
  if (has('dxgi.dll')) return { api: 'dxgi', label: 'DirectX (DXGI)' };
  if (has('vulkan-1.dll')) return { api: 'vulkan', label: 'Vulkan' };
  if (has('d3d9.dll')) return { api: 'd3d9', label: 'DirectX 9' };
  if (has('opengl32.dll')) return { api: 'opengl', label: 'OpenGL' };
  return null;
}

function apiFromMarkers(file) {
  const markers = pe.findMarkers(file, API_MARKERS);
  if (markers.has('D3D12CreateDevice')) return { api: 'dxgi', label: 'DirectX 12' };
  if (markers.has('D3D11CreateDevice')) return { api: 'dxgi', label: 'DirectX 11' };
  if (markers.has('CreateDXGIFactory')) return { api: 'dxgi', label: 'DirectX (DXGI)' };
  if (markers.has('vkCreateInstance')) return { api: 'vulkan', label: 'Vulkan' };
  if (markers.has('wglCreateContext')) return { api: 'opengl', label: 'OpenGL' };
  return null;
}

// Three ways a game can reach Direct3D, tried in order of certainty:
//   1. it imports the API itself;
//   2. it is a protected build that resolves the API with LoadLibrary, so only
//      the entry-point names survive as strings (GTA V Enhanced);
//   3. the renderer lives in one of the game's own DLLs and the executable just
//      imports that (Control ships d3d_rmdwin10_f.dll, which imports d3d12).
function detectApi(file, imports) {
  const direct = apiFromNames(imports);
  if (direct) return { ...direct, via: 'imports' };

  const dynamic = apiFromMarkers(file);
  if (dynamic) return { ...dynamic, via: 'strings' };

  const dir = path.dirname(file);
  for (const name of imports.slice(0, 80)) {
    const sibling = path.join(dir, name);
    // System DLLs live in System32; only the game's own modules sit here.
    if (!fs.existsSync(sibling)) continue;
    const inner = apiFromNames(pe.getImports(sibling));
    if (inner) return { ...inner, via: 'module:' + name };
  }
  return null;
}

async function scanGame(gameDir) {
  const exeCandidates = [];
  const dlssFiles = [];
  const streamlineFiles = [];
  let addonPresent = null;

  await walk(gameDir, async (full, name, depth) => {
    const lower = name.toLowerCase();
    if (lower.endsWith('.exe')) {
      if (NOT_A_GAME.test(lower)) return;
      let size = 0;
      try { size = (await fs.promises.stat(full)).size; } catch { return; }
      if (size < 256 * 1024) return; // real game binaries are never this small
      const detected = detectApi(full, pe.getImports(full));
      if (!detected) return;
      exeCandidates.push({
        path: full,
        rel: path.relative(gameDir, full),
        name,
        size,
        depth,
        api: detected.api,
        apiLabel: detected.label,
        via: detected.via,
        dynamic: detected.via !== 'imports',
        dx12: detected.label === 'DirectX 12'
      });
    } else if (DLSS_FILE.test(name) || STREAMLINE_FILE.test(name)) {
      const item = {
        path: full,
        rel: path.relative(gameDir, full),
        name,
        version: pe.getFileVersion(full)
      };
      (STREAMLINE_FILE.test(name) ? streamlineFiles : dlssFiles).push(item);
    } else if (lower.endsWith('.addon64') || lower.endsWith('.addon')) {
      addonPresent = path.relative(gameDir, full);
    }
  });

  // A DX12 binary beats DX11, a shallow one beats a buried one, and a bigger
  // one beats a smaller one. Copies of the same executable that a crack or a
  // backup folder left behind are dropped, keeping the shallowest.
  exeCandidates.sort((a, b) => (b.dx12 - a.dx12) || (a.depth - b.depth) || (b.size - a.size));
  const seenNames = new Set();
  const unique = [];
  for (const exe of exeCandidates) {
    const key = exe.name.toLowerCase();
    if (seenNames.has(key)) continue;
    seenNames.add(key);
    unique.push(exe);
  }
  exeCandidates.length = 0;
  exeCandidates.push(...unique);

  const chosen = exeCandidates[0] || null;
  // When nothing turned up, say which kind of folder this actually is instead
  // of leaving the user to guess.
  let emptyReason = null;
  if (!chosen) {
    let top = [];
    try { top = fs.readdirSync(gameDir).map((f) => f.toLowerCase()); } catch {}
    const looksPacked = top.some((f) => /^setup\.exe$/.test(f)) && top.some((f) => /\.(bin|rar|iso|zip|part\d+)$/.test(f));
    if (looksPacked) emptyReason = 'installer';
    else if (!top.some((f) => f.endsWith('.exe'))) emptyReason = 'no-exe';
    else emptyReason = 'no-graphics-exe';
  }
  const reshade = chosen ? inspectReShade(path.dirname(chosen.path)) : inspectReShade(gameDir);

  return {
    gameDir,
    gameName: path.basename(gameDir),
    exeCandidates,
    chosen,
    dlssFiles,
    streamlineFiles,
    addonPresent,
    emptyReason,
    reshade,
    hasBackup: fs.existsSync(path.join(gameDir, '_DLSS5_Backup', 'manifest.json'))
  };
}

// Validates the folder holding the new DLSS 5 payload (streamline\ + addon).
function scanSource(sourceDir) {
  const streamlineDir = fs.existsSync(path.join(sourceDir, 'streamline'))
    ? path.join(sourceDir, 'streamline')
    : sourceDir;

  let files = [];
  try {
    files = fs.readdirSync(streamlineDir).filter((f) => DLSS_FILE.test(f) || STREAMLINE_FILE.test(f));
  } catch {
    return { ok: false, reason: 'sourceMissing' };
  }

  let addon = null;
  for (const dir of [sourceDir, streamlineDir]) {
    try {
      const found = fs.readdirSync(dir).find((f) => /\.addon64$/i.test(f));
      if (found) { addon = path.join(dir, found); break; }
    } catch {}
  }

  const payload = files.map((name) => ({
    name,
    path: path.join(streamlineDir, name),
    version: pe.getFileVersion(path.join(streamlineDir, name))
  }));

  const nr = payload.find((f) => /^nvngx_dlssnr\.dll$/i.test(f.name));
  return {
    ok: payload.length > 0,
    reason: payload.length ? null : 'sourceEmpty',
    dir: streamlineDir,
    addon,
    payload,
    // The add-on refuses to run without nvngx_dlssnr.dll beside it.
    hasNeuralRendering: Boolean(nr),
    dlssVersion: (payload.find((f) => /^nvngx_dlss\.dll$/i.test(f.name)) || {}).version || null
  };
}

module.exports = { scanGame, scanSource, walk };

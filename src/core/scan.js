'use strict';
// Works out everything the swap needs to know about a game folder:
// which executable is the game, which rendering API it uses, where the
// existing DLSS/Streamline files live, and whether ReShade is already there.
const fs = require('fs');
const path = require('path');
const pe = require('./pe');
const emulators = require('./emulators');
const crypto = require('crypto');
const feederRelease = require('./feeder-release');
const { safePath } = require('./file-journal');

const SKIP_DIRS = new Set([
  '_dlss5_backup', 'reshade-shaders', 'host64', 'node_modules', '.git',
  // Asset trees contain tens of thousands of files but never the runtime DLL
  // or executable we need. Skipping them lets packaged Unreal games be scanned
  // deeper without making every library refresh slower.
  'paks', 'movies', 'screenshots', 'saved', 'logs',
  'mods', 'downloads', 'overwrite', 'profiles',
  '_redist', 'prerequisites', 'directx', 'redist', 'redistributable',
  'redistributables', '_commonredist', 'dotnet',
  // Shipped installers and vendor helpers keep their own executables around.
  'installer_resources', 'installer', 'installers', 'support', 'vcredist',
  '_support', 'directx_redist', 'eaanticheat', 'easyanticheat', 'battleye',
  // Never touch copies the user (or another tool) parked as a backup.
  'backup', 'backups', '_backup', 'bak', 'old', 'original', 'originals'
]);
const MAX_SCAN_DEPTH = 12;

// Installers, launchers and anti-cheat helpers are never the game itself.
const NOT_A_GAME = /^(unins|setup|install|vcredist|vc_redist|dxsetup|dxwebsetup|oalinst|uninstall|crashreport|crashhandler|easyanticheat|eac|battleye|be_service|launcher|activation|patch|update|dotnetfx|touchup|rapidcrc|autorun|autoplay|quicksfv|readme|config|benchmark|report|helper|service|cleanup|modorganizer|redlauncher|skse\d*_loader|hlds\b|srcds\b|steamerrorreporter|dgvoodoocpl|reshade_setup)/i;

const DLSS_FILE = /^(nvngx_dlss[a-z_]*\.dll|nvngx\.dll|_nvngx\.dll)$/i;
const STREAMLINE_FILE = /^sl\.[a-z_]+\.dll$/i;
const RESHADE_HOOKS = ['dxgi.dll', 'd3d12.dll', 'd3d11.dll', 'd3d9.dll', 'opengl32.dll', 'dinput8.dll'];

async function walk(root, onFile, maxDepth = 8, options = {}) {
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
        const lower = entry.name.toLowerCase();
        // Unreal's Content tree is assets-only and enormous, but modern Xbox
        // installs put the entire accessible game under <Game>\Content.
        const skipContent = lower === 'content' && !options.includeContent;
        if (depth < maxDepth && !skipContent && !SKIP_DIRS.has(lower)) {
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
const API_MARKERS = [
  // Agility SDK games can export only the SDK path/version from the launcher
  // executable and resolve D3D12 in the engine later. Dying Light: The Beast
  // is one such layout, so those exports are authoritative D3D12 evidence too.
  'D3D12CreateDevice', 'D3D12SDKPath', 'D3D12SDKVersion',
  'D3D11CreateDevice', 'D3D10CreateDevice',
  'Direct3DCreate9', 'Direct3DCreate8', 'CreateDXGIFactory', 'vkCreateInstance', 'wglCreateContext'
];

function apiFromNames(imports) {
  const has = (n) => imports.includes(n);
  if (has('d3d12.dll')) return { api: 'dxgi', label: 'DirectX 12' };
  if (has('d3d11.dll')) return { api: 'dxgi', label: 'DirectX 11' };
  if (has('d3d10.dll') || has('d3d10_1.dll')) return { api: 'd3d10', label: 'DirectX 10' };
  if (has('dxgi.dll')) return { api: 'dxgi', label: 'DirectX (DXGI)' };
  if (has('vulkan-1.dll')) return { api: 'vulkan', label: 'Vulkan' };
  if (has('d3d9.dll')) return { api: 'd3d9', label: 'DirectX 9' };
  if (has('d3d8.dll')) return { api: 'd3d8', label: 'DirectX 8' };
  if (has('opengl32.dll')) return { api: 'opengl', label: 'OpenGL' };
  return null;
}

function apiFromMarkers(file) {
  const markers = pe.findMarkers(file, API_MARKERS);
  if (markers.has('D3D12CreateDevice') || markers.has('D3D12SDKPath') || markers.has('D3D12SDKVersion')) {
    return { api: 'dxgi', label: 'DirectX 12' };
  }
  if (markers.has('D3D11CreateDevice')) return { api: 'dxgi', label: 'DirectX 11' };
  if (markers.has('D3D10CreateDevice')) return { api: 'd3d10', label: 'DirectX 10' };
  if (markers.has('CreateDXGIFactory')) return { api: 'dxgi', label: 'DirectX (DXGI)' };
  if (markers.has('Direct3DCreate9')) return { api: 'd3d9', label: 'DirectX 9' };
  if (markers.has('Direct3DCreate8')) return { api: 'd3d8', label: 'DirectX 8' };
  if (markers.has('vkCreateInstance')) return { api: 'vulkan', label: 'Vulkan' };
  if (markers.has('wglCreateContext')) return { api: 'opengl', label: 'OpenGL' };
  return null;
}

function findCaseInsensitive(dir, wanted) {
  try {
    const name = fs.readdirSync(dir).find((entry) => entry.toLowerCase() === wanted.toLowerCase());
    return name ? path.join(dir, name) : null;
  } catch {
    return null;
  }
}

function xmlAttributes(text) {
  const out = {};
  for (const match of String(text).matchAll(/([\w:.-]+)\s*=\s*(["'])(.*?)\2/g)) {
    out[match[1].toLowerCase()] = match[3];
  }
  return out;
}

// GDK executables may remain encrypted even in a modifiable flat-file install,
// so PE inspection can fail. MicrosoftGame.config is the package's authority
// for the executable path and architecture and remains readable.
function xboxExecutables(gameDir) {
  const configs = [
    findCaseInsensitive(gameDir, 'MicrosoftGame.config'),
    findCaseInsensitive(path.join(gameDir, 'Content'), 'MicrosoftGame.config')
  ].filter(Boolean);
  const found = [];
  for (const config of configs) {
    let text;
    try { text = fs.readFileSync(config, 'utf8'); } catch { continue; }
    for (const match of text.matchAll(/<Executable\b([^>]*)\/?\s*>/gi)) {
      const attrs = xmlAttributes(match[1]);
      if (!attrs.name || /^gamelaunchhelper\.exe$/i.test(path.basename(attrs.name))) continue;
      const full = path.resolve(path.dirname(config), attrs.name.replace(/[\\/]/g, path.sep));
      const rel = path.relative(gameDir, full);
      if (rel.startsWith('..') || path.isAbsolute(rel)) continue;
      const architecture = String(attrs.architecture || '').toLowerCase();
      found.push({
        config,
        path: full,
        rel,
        name: path.basename(full),
        bitness: architecture === 'x64' ? 64 : architecture === 'x86' ? 32 : null,
        arm64: architecture === 'arm64',
        id: attrs.id || null
      });
    }
  }
  return found;
}

// Some games deliberately ship one executable per renderer. Far Cry 3 is a
// common example (farcry3_d3d11.exe), and those small dispatcher binaries may
// not import the graphics API themselves. The explicit renderer suffix is a
// useful final signal, after imports and binary markers have been exhausted.
function apiFromFileName(file) {
  const name = path.basename(file).toLowerCase();
  if (/(?:^|[_-])(?:d3d|dx)12(?:[_-]|\.|$)/.test(name)) return { api: 'dxgi', label: 'DirectX 12' };
  if (/(?:^|[_-])(?:d3d|dx)11(?:[_-]|\.|$)/.test(name)) return { api: 'dxgi', label: 'DirectX 11' };
  if (/(?:^|[_-])(?:d3d|dx)10(?:[_-]|\.|$)/.test(name)) return { api: 'd3d10', label: 'DirectX 10' };
  if (/(?:^|[_-])(?:d3d|dx)9(?:[_-]|\.|$)/.test(name)) return { api: 'd3d9', label: 'DirectX 9' };
  if (/(?:^|[_-])(?:d3d|dx)8(?:[_-]|\.|$)/.test(name)) return { api: 'd3d8', label: 'DirectX 8' };
  if (/(?:^|[_-])vulkan(?:[_-]|\.|$)/.test(name)) return { api: 'vulkan', label: 'Vulkan' };
  if (/(?:^|[_-])(?:ogl|opengl)(?:[_-]|\.|$)/.test(name)) return { api: 'opengl', label: 'OpenGL' };
  return null;
}

// A few engines keep compatibility or launcher code for an API they never use
// to render the game. RDR2 carries a Direct3D 9 marker even though its only PC
// renderers are DX12 and Vulkan, so binary-string guessing is actively wrong
// for this executable. Profiles are intentionally exact-name and expose every
// renderer the user can select instead of pretending the first marker wins.
function gameApiProfile(file) {
  if (/^rdr2\.exe$/i.test(path.basename(file))) {
    return {
      detected: { api: 'dxgi', label: 'DirectX 12', via: 'game-profile' },
      choices: [
        { api: 'dxgi', label: 'DirectX 12' },
        { api: 'vulkan', label: 'Vulkan' }
      ]
    };
  }
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
    if (path.basename(name) !== name || /[\\/:]/.test(name)) continue;
    const sibling = findCaseInsensitive(dir, name);
    // System DLLs live in System32; only the game's own modules sit here.
    if (!sibling || pe.getBitness(sibling) !== pe.getBitness(file)) continue;
    const inner = apiFromNames(pe.getImports(sibling)) || apiFromMarkers(sibling);
    if (inner) return { ...inner, via: 'module:' + name };
  }

  const named = apiFromFileName(file);
  if (named) return { ...named, via: 'filename' };
  return detectEngineApi(file);
}

// Small Source/GoldSrc dispatchers and several Ubisoft/UE2 games load their
// renderer dynamically from a separate module, not the executable's imports.
// Only inspect modules belonging to these entry points, with matching PE
// architecture and actual API evidence. A random DLL beside a tool is not
// evidence that the tool is a game; injected graphics proxies are never used.
function detectEngineApi(file) {
  const modules = {
    'hl.exe': ['hw.dll'],
    'hl2.exe': ['bin/shaderapidx9.dll', 'bin/engine.dll', 'bin/x64/shaderapidx9.dll', 'bin/x64/engine.dll'],
    'left4dead2.exe': ['bin/shaderapidx9.dll', 'bin/engine.dll'],
    'killingfloor.exe': ['D3D9Drv.dll', 'D3DDrv.dll', 'OpenGLDrv.dll'],
    'farcry5.exe': ['FC_m64.dll'],
    'watch_dogs.exe': ['Disrupt_b64.dll'],
    'kingdomcome.exe': ['WHGame.dll']
  }[path.basename(file).toLowerCase()];
  if (!modules) return null;
  const bitness = pe.getBitness(file);
  for (const rel of modules) {
    let module = path.dirname(file);
    for (const part of rel.split('/')) {
      module = findCaseInsensitive(module, part);
      if (!module) break;
    }
    if (!module || pe.getBitness(module) !== bitness) continue;
    const api = apiFromNames(pe.getImports(module)) || apiFromMarkers(module);
    if (api) return { ...api, via: 'engine-module:' + rel };
  }
  return null;
}

function pathDistance(a, b) {
  const left = path.resolve(a).toLowerCase().split(path.sep).filter(Boolean);
  const right = path.resolve(b).toLowerCase().split(path.sep).filter(Boolean);
  let common = 0;
  while (common < left.length && common < right.length && left[common] === right[common]) common++;
  return (left.length - common) + (right.length - common);
}

function selectPrimaryDlss(files, chosen) {
  const exact = files.filter((file) => /^nvngx_dlss\.dll$/i.test(file.name));
  const legacy = files.filter((file) => /^_?nvngx\.dll$/i.test(file.name));
  const candidates = exact.length ? exact : legacy;
  if (!candidates.length) return null;
  const exeDir = chosen ? path.dirname(chosen.path) : null;
  return [...candidates].sort((a, b) => {
    const score = (file) => {
      let value = 0;
      if (file.version) value += 10000;
      if (chosen && file.bitness === chosen.bitness) value += 2000;
      if (chosen && new RegExp(`(?:^|[\\\\/])win${chosen.bitness}(?:[\\\\/]|$)`, 'i').test(file.rel)) value += 500;
      if (exeDir) value -= pathDistance(path.dirname(file.path), exeDir);
      return value;
    };
    return score(b) - score(a) || a.rel.localeCompare(b.rel);
  })[0];
}

// Prefer the executable a player normally launches. Several older games ship
// separate SP and MP/Online programs in the same folder; installing beside the
// multiplayer binary makes ReShade appear missing in the single-player game.
function playableRoleScore(exe) {
  const rel = String(exe.rel || exe.path || '').toLowerCase();
  let score = 0;
  if (/(?:^|[\\/])singleplayer(?:[\\/]|$)/.test(rel)) score += 4;
  if (/sp(?:[_-][^\\/]*)?\.exe$/.test(rel)) score += 2;
  if (/(?:^|[\\/])(?:multiplayer|online)(?:[\\/]|$)/.test(rel)) score -= 4;
  if (/mp(?:[_-][^\\/]*)?\.exe$/.test(rel)) score -= 2;
  return score;
}

async function scanGame(gameDir) {
  const exeCandidates = [];
  const dlssFiles = [];
  const streamlineFiles = [];
  let addonPresent = null;
  const xboxDeclared = xboxExecutables(gameDir);
  const xboxLayout = xboxDeclared.length > 0 || /(?:^|[\\/])xboxgames(?:[\\/]|$)/i.test(path.resolve(gameDir));

  await walk(gameDir, async (full, name, depth) => {
    const lower = name.toLowerCase();
    if (lower.endsWith('.exe')) {
      if (NOT_A_GAME.test(lower)) return;
      let size = 0;
      try { size = (await fs.promises.stat(full)).size; } catch { return; }
      const bitness = pe.getBitness(full);
      if (!bitness) return;
      const emulator = emulators.profileFor(full);
      const gameProfile = emulator ? null : gameApiProfile(full);
      const detected = emulator
        ? { ...emulators.apiChoices(emulator)[0], via: 'emulator-profile' }
        : (gameProfile ? gameProfile.detected : detectApi(full, pe.getImports(full)));
      if (!detected) return;
      // File size is not a game classifier. Genuine engine dispatchers can be
      // only a few KB; retain them when PE/API evidence above is available.
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
        bitness,
        dx12: detected.label === 'DirectX 12',
        emulator: emulator ? {
          key: emulator.key, name: emulator.name, system: emulator.system,
          hint: emulator.hint
        } : null,
        apiChoices: emulator
          ? emulators.apiChoices(emulator)
          : (gameProfile ? gameProfile.choices : [{ api: detected.api, label: detected.label }])
      });
    } else if (DLSS_FILE.test(name) || STREAMLINE_FILE.test(name)) {
      const item = {
        path: full,
        rel: path.relative(gameDir, full),
        name,
        version: pe.getFileVersion(full),
        bitness: pe.getBitness(full),
        depth
      };
      (STREAMLINE_FILE.test(name) ? streamlineFiles : dlssFiles).push(item);
    } else if (lower.endsWith('.addon64') || lower.endsWith('.addon32') || lower.endsWith('.addon')) {
      addonPresent = path.relative(gameDir, full);
    }
  }, MAX_SCAN_DEPTH, { includeContent: xboxLayout });

  // Add manifest-declared executables that could not be inspected as PE files.
  // DXGI is the safe fallback for a GDK PC title when no readable module gives
  // a stronger answer: the same ReShade hook serves DirectX 11 and DirectX 12.
  for (const declared of xboxDeclared) {
    if (!fs.existsSync(declared.path) || declared.arm64) continue;
    if (exeCandidates.some((candidate) => path.resolve(candidate.path).toLowerCase() === path.resolve(declared.path).toLowerCase())) {
      const candidate = exeCandidates.find((item) => path.resolve(item.path).toLowerCase() === path.resolve(declared.path).toLowerCase());
      candidate.declared = true;
      continue;
    }
    let size = 0;
    try { size = fs.statSync(declared.path).size; } catch {}
    const detected = detectApi(declared.path, pe.getImports(declared.path)) || {
      api: 'dxgi', label: 'DirectX 11/12', via: 'MicrosoftGame.config'
    };
    exeCandidates.push({
      ...declared,
      size,
      depth: declared.rel.split(path.sep).length - 1,
      api: detected.api,
      apiLabel: detected.label,
      via: detected.via,
      dynamic: true,
      bitness: pe.getBitness(declared.path) || declared.bitness || 64,
      declared: true,
      encrypted: pe.getBitness(declared.path) === null,
      dx12: detected.label === 'DirectX 12'
    });
  }

  // A DX12 binary beats DX11, a shallow one beats a buried one, and a bigger
  // one beats a smaller one. Copies of the same executable that a crack or a
  // backup folder left behind are dropped, keeping the shallowest.
  exeCandidates.sort((a, b) => ((b.emulator ? 1 : 0) - (a.emulator ? 1 : 0)) ||
    ((b.declared ? 1 : 0) - (a.declared ? 1 : 0)) ||
    (b.dx12 - a.dx12) || (playableRoleScore(b) - playableRoleScore(a)) ||
    (a.depth - b.depth) || (b.size - a.size));
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
  const primaryDlss = selectPrimaryDlss(dlssFiles, chosen);
  // When nothing turned up, say which kind of folder this actually is instead
  // of leaving the user to guess.
  let emptyReason = null;
  if (!chosen) {
    let top = [];
    try { top = fs.readdirSync(gameDir).map((f) => f.toLowerCase()); } catch {}
    const looksPacked = top.some((f) => /^setup\.exe$/.test(f)) && top.some((f) => /\.(bin|rar|iso|zip|part\d+)$/.test(f));
    if (xboxDeclared.length || /(?:^|[\\/])windowsapps(?:[\\/]|$)/i.test(path.resolve(gameDir))) emptyReason = 'xbox-protected';
    else if (looksPacked) emptyReason = 'installer';
    else if (!top.some((f) => f.endsWith('.exe'))) emptyReason = 'no-exe';
    else emptyReason = 'no-graphics-exe';
  }
  let install = null;
  const activeManifest = path.join(gameDir, '_DLSS5_Backup', 'manifest.json');
  if (fs.existsSync(activeManifest)) {
    try {
      const data = JSON.parse(fs.readFileSync(activeManifest, 'utf8'));
      install = {
        route: data.route || (data.game && data.game.bitness === 32 ? 'feeder' : 'native'),
        api: data.game && data.game.api,
        exe: data.game && data.game.exe,
        previousReShadeRoute: data.previousReShadeRoute || null,
        optiscaler: data.route === 'optiscaler' ? data.optiscaler : null,
        added: Array.isArray(data.added) ? data.added.filter(item => typeof item === 'string') : [],
        vulkanLayer: data.vulkanLayer || null
      };
      if (install.optiscaler) {
        const exeDir = path.dirname(safePath(gameDir, data.game.exe));
        const hook = safePath(gameDir, path.relative(gameDir, path.join(exeDir, install.optiscaler.hook)));
        install.optiscaler.installed = pe.versionMentions(hook, 'OptiScaler') &&
          ['nvngx.dll_dlssnr.dll', 'nvngx_dlssnr.dll', 'OptiScaler.ini'].every(name => fs.existsSync(path.join(exeDir, name)));
      }
    } catch {}
  }
  let reshade = chosen ? inspectReShade(path.dirname(chosen.path)) : inspectReShade(gameDir);
  if (!reshade.installed && install && install.vulkanLayer &&
      fs.existsSync(install.vulkanLayer.manifest || '')) {
    reshade = {
      installed: true, file: 'Vulkan layer', kind: 'vulkan-layer',
      version: '6.8.0', addonSupport: true
    };
  }

  return {
    gameDir,
    gameName: path.basename(gameDir),
    exeCandidates,
    chosen,
    emulator: chosen ? chosen.emulator : null,
    dlssFiles,
    primaryDlss,
    streamlineFiles,
    addonPresent,
    emptyReason,
    reshade,
    install,
    hasBackup: fs.existsSync(activeManifest)
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
  const feederDir = path.join(sourceDir, 'feeder');
  const feeder = {
    version: feederRelease.version,
    addon64: path.join(feederDir, 'dlss5-feed.addon64'),
    addon32: path.join(feederDir, 'dlss5-feed.addon32'),
    host64: path.join(feederDir, 'dlss5-feed-host64.exe'),
    feedShader: path.join(feederDir, 'reshade-shaders', 'Shaders', 'DLSS5_Feed.fx'),
    shaderRoot: path.join(feederDir, 'reshade-shaders'),
    hostAddon: path.join(feederDir, 'host64', 'renodx-dlss5.addon64'),
    dgVoodooDir: path.join(feederDir, 'dgvoodoo'),
    vulkanLayerDir: path.join(sourceDir, 'reshade-vulkan')
  };
  feeder.releaseVerified = Object.entries(feederRelease.hashes).every(([rel, expected]) => {
    try {
      return crypto.createHash('sha256').update(fs.readFileSync(path.join(feederDir, rel))).digest('hex') === expected;
    } catch { return false; }
  });
  feeder.ok32 = [feeder.addon32, feeder.host64, feeder.feedShader, feeder.hostAddon]
    .concat([
      path.join(feeder.shaderRoot, 'Shaders', 'vort_Motion.fx'),
      path.join(feeder.shaderRoot, 'Shaders', 'ReShade.fxh'),
      path.join(feeder.shaderRoot, 'Shaders', 'ReShadeUI.fxh'),
      path.join(feeder.shaderRoot, 'Shaders', 'Includes', 'vort_Defs.fxh'),
      path.join(feeder.shaderRoot, 'Textures', 'vort_BlueNoise.png')
    ]).every((file) => fs.existsSync(file));
  feeder.ok64 = [feeder.addon64, feeder.feedShader, feeder.hostAddon]
    .concat([
      path.join(feeder.shaderRoot, 'Shaders', 'vort_Motion.fx'),
      path.join(feeder.shaderRoot, 'Shaders', 'ReShade.fxh'),
      path.join(feeder.shaderRoot, 'Shaders', 'ReShadeUI.fxh')
    ]).every((file) => fs.existsSync(file));
  feeder.vulkanOk = ['ReShade64.dll', 'ReShade64.json', 'ReShade32.dll', 'ReShade32.json']
    .every((name) => fs.existsSync(path.join(feeder.vulkanLayerDir, name)));
  feeder.ok32 = feeder.ok32 && feeder.releaseVerified;
  feeder.ok64 = feeder.ok64 && feeder.releaseVerified;
  feeder.ok = feeder.ok32 && feeder.ok64;
  return {
    ok: payload.length > 0,
    reason: payload.length ? null : 'sourceEmpty',
    dir: streamlineDir,
    addon,
    payload,
    // The add-on refuses to run without nvngx_dlssnr.dll beside it.
    hasNeuralRendering: Boolean(nr),
    feeder,
    dlssVersion: (payload.find((f) => /^nvngx_dlss\.dll$/i.test(f.name)) || {}).version || null
  };
}

module.exports = {
  scanGame, scanSource, walk, selectPrimaryDlss, xboxExecutables, playableRoleScore, inspectReShade
};

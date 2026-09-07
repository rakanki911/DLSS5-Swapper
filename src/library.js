'use strict';
// Builds a games library out of what the launchers already keep on disk.
// Everything here is a read: no network, no accounts, nothing written back to
// any launcher.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

// Entries that are tooling rather than games.
const NOT_A_GAME = /redistributabl|steamworks common|directx|vcredist|proton|steam linux runtime|soundtrack/i;

// Every registry read goes through one place so the discovery below can be
// exercised against a fake registry in the tests.
// stderr is ignored: reg.exe writes "unable to find the specified registry
// key" for every launcher that is not installed, which is the normal case.
let registryRunner = (args) => execFileSync('reg', args,
  { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
const defaultRegistryRunner = registryRunner;
// Passing nothing puts the real reg.exe back, so a test cannot leave the
// registry stubbed out for whatever runs after it.
function setRegistryRunner(runner) { registryRunner = runner || defaultRegistryRunner; }

function reg(key, value) {
  try {
    const out = registryRunner(['query', key, '/v', value]);
    const m = out.match(new RegExp(value + '\\s+REG_\\w+\\s+(.+)'));
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

function regKeys(key) {
  try {
    return registryRunner(['query', key])
      .split('\n').map((l) => l.trim()).filter((l) => l.startsWith('HKEY'));
  } catch {
    return [];
  }
}

// Every value of one name below a key, however deep. reg.exe costs a process
// per call, so a tree that is several keys deep is read in one recursive query
// rather than walked a level at a time.
function regSearch(key, value) {
  try {
    const out = registryRunner(['query', key, '/s', '/v', value]);
    return [...out.matchAll(new RegExp('^\\s+' + value + '\\s+REG_\\w+\\s+(.+)$', 'gim'))]
      .map((m) => m[1].trim());
  } catch {
    return [];
  }
}

// Valve's KeyValues format is regular enough to read with one pattern.
const kv = (text, key) => (text.match(new RegExp(`"${key}"\\s+"([^"]+)"`, 'i')) || [])[1];

// ---------- Steam ----------

// Steam already downloaded the art when the game was installed. The tall
// poster keeps its classic name; everything else in the folder is icons.
function steamPoster(steamRoot, appid) {
  const dir = path.join(steamRoot, 'appcache', 'librarycache', String(appid));
  for (const name of ['library_600x900.jpg', 'header.jpg']) {
    const file = path.join(dir, name);
    if (fs.existsSync(file)) return { file, tall: name.startsWith('library_600x900') };
  }
  // Older clients kept them flat, prefixed with the appid.
  const flat = path.join(steamRoot, 'appcache', 'librarycache');
  for (const name of [`${appid}_library_600x900.jpg`, `${appid}_header.jpg`]) {
    const file = path.join(flat, name);
    if (fs.existsSync(file)) return { file, tall: name.includes('600x900') };
  }
  return null;
}

function linuxSteamRoots(home = os.homedir(), env = process.env) {
  // Steam has used both of these locations over time.  Do not resolve the
  // ~/.steam/steam symlink: its path is also useful to portable installs.
  const dataHome = env.XDG_DATA_HOME || path.join(home, '.local', 'share');
  return [...new Set([
    path.join(dataHome, 'Steam'),
    path.join(home, '.steam', 'steam'),
    // Flatpak keeps its Steam data outside XDG_DATA_HOME.
    path.join(home, '.var', 'app', 'com.valvesoftware.Steam', 'data', 'Steam')
  ])].filter((dir) => fs.existsSync(path.join(dir, 'steamapps')));
}

function steam(options = {}) {
  const platform = options.platform || process.platform;
  const roots = options.roots || (platform === 'linux'
    ? linuxSteamRoots(options.home, options.env)
    : [reg('HKCU\\Software\\Valve\\Steam', 'SteamPath')].filter(Boolean));
  if (!roots.length) return [];

  const games = [];
  for (const root of roots) {
    const base = platform === 'win32' ? root.replace(/\//g, '\\') : root;

    const libraries = new Set([base]);
    try {
      const vdf = fs.readFileSync(path.join(base, 'steamapps', 'libraryfolders.vdf'), 'utf8');
      for (const m of vdf.matchAll(/"path"\s+"([^"]+)"/g)) libraries.add(m[1].replace(/\\\\/g, '\\'));
    } catch {}

    for (const lib of libraries) {
      const appsDir = path.join(lib, 'steamapps');
      let files = [];
      try { files = fs.readdirSync(appsDir).filter((f) => /^appmanifest_\d+\.acf$/.test(f)); } catch { continue; }
      for (const f of files) {
        let text;
        try { text = fs.readFileSync(path.join(appsDir, f), 'utf8'); } catch { continue; }
        const appid = kv(text, 'appid');
        const installdir = kv(text, 'installdir');
        const name = kv(text, 'name') || installdir;
        if (!appid || !installdir || NOT_A_GAME.test(name)) continue;
        const dir = path.join(appsDir, 'common', installdir);
        if (!fs.existsSync(dir)) continue;
        games.push({
          launcher: 'Steam', id: appid, name, dir, poster: steamPoster(base, appid),
          steamRoot: base,
          // A prefix only exists for titles launched through Steam Play. This
          // metadata lets the installer run the Windows ReShade setup in the
          // same Proton bottle as the game instead of invoking a host Wine.
          protonPrefix: platform === 'linux' ? path.join(base, 'steamapps', 'compatdata', appid, 'pfx') : null
        });
      }
    }
  }
  return games;
}

// ---------- Epic ----------
function epic() {
  const dir = 'C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests';
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.item')); } catch { return []; }

  const games = [];
  for (const f of files) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      // A manifest survives an uninstall, so the folder has to be checked.
      if (!j.InstallLocation || !fs.existsSync(j.InstallLocation)) continue;
      if (NOT_A_GAME.test(j.DisplayName || '')) continue;
      games.push({ launcher: 'Epic Games', id: j.AppName, name: j.DisplayName, dir: j.InstallLocation, poster: null });
    } catch {}
  }
  return games;
}

// ---------- GOG ----------
function gog() {
  const games = [];
  for (const key of regKeys('HKLM\\SOFTWARE\\WOW6432Node\\GOG.com\\Games')) {
    const dir = reg(key, 'path');
    if (!dir || !fs.existsSync(dir)) continue;
    const name = reg(key, 'gameName') || path.basename(dir);
    if (NOT_A_GAME.test(name)) continue;
    games.push({ launcher: 'GOG', id: key.split('\\').pop(), name, dir, poster: null });
  }
  return games;
}


// ---------- Ubisoft Connect ----------
// Its installer records every game under one key, with the folder in
// InstallDir - written with forward slashes, which is why it is resolved
// before use. Ubisoft games were simply never looked for before, so they
// only appeared for people who added the folder by hand.
function ubisoft() {
  const games = [];
  for (const key of regKeys('HKLM\\SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher\\Installs')) {
    const raw = reg(key, 'InstallDir');
    if (!raw) continue;
    const dir = path.resolve(raw);
    // The key outlives an uninstall, exactly like the Epic manifests.
    if (!fs.existsSync(dir)) continue;
    const name = path.basename(dir);
    if (NOT_A_GAME.test(name)) continue;
    games.push({ launcher: 'Ubisoft', id: key.split('\\').pop(), name, dir, poster: null });
  }
  return games;
}

// ---------- loose installs on every drive ----------
// The launchers above already record their libraries wherever they sit, so a
// game installed through Steam on E: is found without any of this. What is
// missing is the loose kind: repacks and hand-copied games in a folder someone
// made. Those live in a few shapes - D:\Games\<game>, E:\Repacks\<game>, or a
// game dropped straight on a drive root - so the search stays two levels deep.
// Walking whole disks would cost minutes and turn up mostly applications.
const SYSTEM_DIRS = new Set([
  'windows', 'winnt', 'program files', 'program files (x86)', 'programdata',
  'users', '$recycle.bin', 'system volume information', 'recovery', 'perflogs',
  'config.msi', 'documents and settings', 'msocache', 'intel', 'amd', 'nvidia',
  'drivers', 'temp', 'tmp', '$windows.~bt', '$windows.~ws', 'onedrivetemp',
  'inetpub', 'node_modules'
]);

// Folder names people give a games library. Matched first so a library that
// happens to hold one game is still recognised.
const LIBRARY_NAME = /^(games?|my ?games|steamlibrary|gog ?games|epic ?games|xbox ?games|origin ?games|repacks?|emulation)$/i;
const NOT_A_GAME_EXE = /^(unins|setup|install|vcredist|dxsetup|dotnet|oalinst|crashpad|launcher_installer)/i;

// Fixed disks only. A disconnected network drive would block on every read.
//
// Ask the filesystem first: reading a drive root costs microseconds, while the
// cold WMI call this used to start with routinely takes seconds and froze the
// window on every launch with drive scanning on. PowerShell is still there for
// the case the probe finds nothing at all.
function drives() {
  const list = [];
  for (let c = 67; c <= 90; c++) {
    const root = String.fromCharCode(c) + ':\\';
    try { fs.readdirSync(root); list.push(root); } catch { /* no such drive */ }
  }
  if (list.length) return list;
  try {
    const out = execFileSync('powershell', ['-NoProfile', '-Command',
      'Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object { $_.DeviceID }'
    ], { encoding: 'utf8', timeout: 8000, windowsHide: true });
    const found = out.split(/\r?\n/).map((l) => l.trim()).filter((l) => /^[A-Za-z]:$/.test(l));
    if (found.length) return found.map((d) => d + '\\');
  } catch { /* nothing else to try */ }
  return list;
}

// Folders that sit beside games in a library but are not games: launcher
// plumbing and save data. Cheaper and safer than guessing from the contents -
// steamapps does hold executables, three levels down.
const NOT_A_GAME_DIR = /^(steamapps|gamesave|gamesaves|workshop|downloading|shadercache|temp|tmp|backup|_dlss5_backup|reshade-shaders|saves?|savegames?|redist|_?commonredist|installers?|setup|dlc|mods?|tools?)$/i;

// A game folder holds a runnable file somewhere near its top. Three levels
// covers a repack that buries it - Golf.Gambit.v1.0.5-EA-OFME\Golf Gambit\ -
// and Unreal's Game\Binaries\Win64\ layout.
function holdsGame(dir, depth = 3) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return false; }
  if (entries.some((e) => e.isFile() && /\.exe$/i.test(e.name) && !NOT_A_GAME_EXE.test(e.name))) return true;
  if (depth <= 0) return false;
  return entries.some((e) => e.isDirectory() && holdsGame(path.join(dir, e.name), depth - 1));
}

function autoRoots() {
  const roots = [];
  for (const drive of drives()) {
    let entries = [];
    try { entries = fs.readdirSync(drive, { withFileTypes: true }); } catch { continue; }

    for (const e of entries) {
      if (!e.isDirectory() || SYSTEM_DIRS.has(e.name.toLowerCase())) continue;
      const dir = path.join(drive, e.name);
      if (LIBRARY_NAME.test(e.name)) { roots.push(dir); continue; }

      // Otherwise it earns the name by what it holds: several children that
      // each look like a game. One lone match is more often an application.
      let kids = [];
      try {
        kids = fs.readdirSync(dir, { withFileTypes: true }).filter((k) => k.isDirectory());
      } catch { continue; }
      if (kids.length < 2 || kids.length > 300) continue;
      const gameish = kids.filter((k) => holdsGame(path.join(dir, k.name))).length;
      if (gameish >= 2 && gameish >= kids.length / 2) roots.push(dir);
    }
  }
  return roots;
}

// ---------- plain folders ----------
// `onlyGames` is for roots nobody asked for by hand: a swept-up C:\XboxGames
// also holds GameSave, and a SteamLibrary holds steamapps, neither of which is
// a game. A folder the person added themselves is listed whole, because they
// know what they put there.
function folder(root, label = 'My folders', onlyGames = false) {
  let entries = [];
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return []; }
  return entries
    .filter((e) => e.isDirectory() && !NOT_A_GAME.test(e.name))
    .filter((e) => !onlyGames || (!NOT_A_GAME_DIR.test(e.name) && holdsGame(path.join(root, e.name))))
    .map((e) => ({ launcher: label, id: null, name: e.name, dir: path.join(root, e.name), poster: null }));
}

// ---------- Xbox app / Microsoft Store ----------
// The Xbox app records its library in two places, and both are read because
// each covers a case the other misses. Every drive it installs to carries a
// `.GamingRoot` marker naming the games folder on that drive, usually
// `XboxGames`, whose children are the games. Gaming Services also records each
// package under PackageRepository\Root, pointing into `WindowsApps` - a
// junction back into the same install, which finds a game whose drive marker
// has gone missing.

// "RGBX", a version, then the folder as UTF-16 with a terminating null.
function gamingRootFolder(drive) {
  let buf;
  try { buf = fs.readFileSync(path.join(drive, '.GamingRoot')); } catch { return null; }
  if (buf.length < 10 || buf.toString('latin1', 0, 4) !== 'RGBX') return null;
  const decoded = buf.toString('utf16le', 8);
  const end = decoded.indexOf('\0');
  const relative = (end === -1 ? decoded : decoded.slice(0, end)).trim();
  if (!relative) return null;
  const dir = path.resolve(drive, relative);
  return fs.existsSync(dir) ? dir : null;
}

// A game holds `Content`; its siblings - `GameSave` above all - do not.
function isXboxGameFolder(dir) {
  const content = path.join(dir, 'Content');
  let stat;
  try { stat = fs.statSync(content); } catch { return false; }
  return stat.isDirectory() &&
    (fs.existsSync(path.join(content, 'MicrosoftGame.config')) || holdsGame(content, 1));
}

const CONFIGS = (dir) => [path.join(dir, 'Content', 'MicrosoftGame.config'),
  path.join(dir, 'MicrosoftGame.config')];

function readConfig(dir, pattern) {
  for (const config of CONFIGS(dir)) {
    let text;
    try { text = fs.readFileSync(config, 'utf8'); } catch { continue; }
    const found = (text.match(pattern) || [])[1];
    if (found) return found.trim();
  }
  return null;
}

// The folder has had the characters Windows forbids stripped out of it -
// "Magic- Olden Era" - while the config keeps the title the store shows. A
// name deferred to the package's resource table cannot be read from here.
function xboxDisplayName(dir) {
  const name = readConfig(dir, /DefaultDisplayName\s*=\s*"([^"]+)"/i);
  return name && !/^ms-resource:/i.test(name) ? name : null;
}

// Mintrocket.DaveTheDiver_1.0.145.0_x64__mnyz31d5jqk06 -> Dave The Diver.
const PACKAGE_FOLDER = /^[^_]+_\d[\d.]*_[^_]*__[^_]+$/;
function nameFromPackage(folder) {
  const identity = folder.split('_')[0].split('.').pop() || folder;
  return identity.replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim();
}

// "Mintrocket.DaveTheDiver" - the name both routes agree on. Comparing paths
// cannot tell they reached the same game, because the junction that joins
// those paths is not always resolvable.
function xboxIdentity(dir) {
  const identity = readConfig(dir, /<Identity\b[^>]*\bName\s*=\s*"([^"]+)"/i);
  if (identity) return identity;
  const folder = path.basename(dir);
  return PACKAGE_FOLDER.test(folder) ? folder.split('_')[0] : null;
}

// One recursive read: every package sits at the bottom of the repository.
function xboxPackageRoots() {
  const roots = [];
  for (const raw of regSearch('HKLM\\SOFTWARE\\Microsoft\\GamingServices\\PackageRepository\\Root', 'Root')) {
    // Written as an extended-length path, which nothing else here expects.
    const dir = raw.replace(/^\\\\\?\\/, '').replace(/[\\/]+$/, '');
    if (dir && fs.existsSync(dir)) roots.push(dir);
  }
  return roots;
}

// Out of `WindowsApps` and back to the flat-file install, which is the copy
// that can be written to. A package that is not a junction stays where it is.
function xboxGameDir(packageRoot) {
  let real = packageRoot;
  // Only the native call resolves the path in one go. The JavaScript one
  // walks it with lstat, and lstat on `WindowsApps` itself is EPERM for
  // anyone but an administrator, so on Node 20 it fails outright.
  for (const resolve of [(p) => fs.realpathSync.native(p), (p) => fs.realpathSync(p)]) {
    try { real = resolve(packageRoot); break; } catch { /* try the next one */ }
  }
  if (path.basename(real).toLowerCase() === 'content') {
    const parent = path.dirname(real);
    if (isXboxGameFolder(parent)) return parent;
  }
  return real;
}

function xbox(options = {}) {
  const found = new Map();
  const byIdentity = new Map();

  const add = (dir, id) => {
    const resolved = path.resolve(dir);
    const key = resolved.toLowerCase();
    const identity = (xboxIdentity(resolved) || '').toLowerCase();
    const already = found.get(key) || (identity ? byIdentity.get(identity) : null);
    if (already) {
      // Reached twice; only the registry route knows the package name.
      if (id && !already.id) already.id = id;
      return;
    }
    const folderName = path.basename(resolved);
    const name = xboxDisplayName(resolved) ||
      (PACKAGE_FOLDER.test(folderName) ? nameFromPackage(folderName) : folderName);
    if (NOT_A_GAME.test(name)) return;
    const game = { launcher: 'Xbox', id: id || null, name, dir: resolved, poster: null };
    found.set(key, game);
    if (identity) byIdentity.set(identity, game);
  };

  // The sweep goes first: it lands on the flat-file install, the copy that can
  // be written to. Its drive list is Windows-only, and asking for it anywhere
  // else would pay for the PowerShell fallback inside drives().
  const roots = options.drives || (process.platform === 'win32' ? drives() : []);
  for (const drive of roots) {
    const root = gamingRootFolder(drive);
    if (!root) continue;
    let entries = [];
    try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (!entry.isDirectory() || NOT_A_GAME_DIR.test(entry.name)) continue;
      const dir = path.join(root, entry.name);
      if (isXboxGameFolder(dir)) add(dir);
    }
  }

  for (const packageRoot of xboxPackageRoots()) {
    add(xboxGameDir(packageRoot), path.basename(packageRoot));
  }
  return [...found.values()];
}

// One game can be installed twice - a launcher copy and a loose copy. They are
// different installs, so both are kept; only the exact same folder is merged.
function dedupe(games) {
  const seen = new Map();
  for (const entry of games) {
    const g = canonicalGame(entry);
    const key = path.resolve(g.dir).toLowerCase();
    const existing = seen.get(key);
    // A launcher entry carries a real name and art, so it wins over a folder.
    const dlc = game => /\bdlc\b|phantom liberty/i.test(game.name || '');
    if (!existing || (dlc(existing) && !dlc(g)) ||
        (!dlc(g) && existing.launcher.startsWith('My folders') && !g.launcher.startsWith('My folders'))) {
      seen.set(key, g);
    }
  }
  return [...seen.values()];
}

function canonicalGame(game) {
  // Phantom Liberty can leave its own launcher record pointing at the base
  // game's directory. There is one runnable game, not a second DLC executable.
  // Only canonicalise when the real base-game binary is present at that path.
  if (/cyberpunk|phantom liberty/i.test(game.name || '') &&
      fs.existsSync(path.join(game.dir, 'bin', 'x64', 'Cyberpunk2077.exe'))) {
    return { ...game, name: 'Cyberpunk 2077', ...(game.launcher === 'Steam'
      ? { id: '1091500', poster: game.id === '1091500' ? game.poster : null } : {}) };
  }
  return game;
}

function normalized(file) {
  return path.resolve(file).replace(/[\\/]+$/, '').toLowerCase();
}

function isInside(file, root) {
  const candidate = normalized(file);
  const parent = normalized(root);
  return candidate === parent || candidate.startsWith(parent + path.sep.toLowerCase());
}

function filterExcluded(games, excludedRoots = []) {
  const excluded = excludedRoots.filter(Boolean);
  if (!excluded.length) return games;
  return games.filter((game) => !excluded.some((root) => isInside(game.dir, root)));
}

function discover(extraFolders = [], scanDrives = false, excludedRoots = [], findAutoRoots = autoRoots) {
  const found = [...steam(), ...epic(), ...gog(), ...ubisoft(), ...xbox()];
  const roots = (scanDrives ? findAutoRoots() : [])
    .filter((root) => !excludedRoots.some((excluded) => isInside(root, excluded)));
  for (const dir of roots) found.push(...folder(dir, 'My folders', true));
  // A user-picked scan root can still contain ReShade assets, backups and
  // unrelated folders. Keep only children that actually contain a runnable
  // game or emulator, just like automatically discovered library roots.
  for (const dir of extraFolders) found.push(...folder(dir, 'My folders', true));
  return { games: dedupe(filterExcluded(found, excludedRoots)), roots };
}

module.exports = {
  discover, folder, dedupe, autoRoots, drives, isInside, filterExcluded,
  steam, linuxSteamRoots, gog, ubisoft, xbox, gamingRootFolder, setRegistryRunner
};

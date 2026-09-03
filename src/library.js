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

function reg(key, value) {
  try {
    const out = execFileSync('reg', ['query', key, '/v', value], { encoding: 'utf8', windowsHide: true });
    const m = out.match(new RegExp(value + '\\s+REG_\\w+\\s+(.+)'));
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

function regKeys(key) {
  try {
    return execFileSync('reg', ['query', key], { encoding: 'utf8', windowsHide: true })
      .split('\n').map((l) => l.trim()).filter((l) => l.startsWith('HKEY'));
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

// ---------- Heroic ----------
// Heroic keeps one plain-JSON file per store. Only the installed lists are
// read: the library caches beside them expire and are often missing, and a
// title is not worth a stale file when the folder name will do.
const FLATPAK = { heroic: 'com.heroicgameslauncher.hgl', lutris: 'net.lutris.Lutris' };

// A launcher installed from a distro package and the same one from Flatpak
// keep separate config trees, and people run both.
function xdgRoots(home, env, ...tail) {
  const config = env.XDG_CONFIG_HOME || path.join(home, '.config');
  return [path.join(config, ...tail), path.join(home, '.var', 'app', FLATPAK[tail[0]], 'config', ...tail)]
    .filter((dir) => fs.existsSync(dir));
}

// Lutris is deprecating ~/.config/lutris: when that folder is absent it keeps
// its configuration in the data directory instead, which is where a current
// install puts the per-game files. Downloaded wine runners always live in the
// data directory, so both are needed.
function lutrisRoots(home, env) {
  const config = env.XDG_CONFIG_HOME || path.join(home, '.config');
  const data = env.XDG_DATA_HOME || path.join(home, '.local', 'share');
  const flatpak = path.join(home, '.var', 'app', FLATPAK.lutris);
  return [[config, data], [path.join(flatpak, 'config'), path.join(flatpak, 'data')]]
    .map(([configHome, dataHome]) => {
      const configDir = path.join(configHome, 'lutris');
      const dataDir = path.join(dataHome, 'lutris');
      return {
        games: path.join(fs.existsSync(configDir) ? configDir : dataDir, 'games'),
        wineDir: path.join(dataDir, 'runners', 'wine')
      };
    })
    .filter((root) => fs.existsSync(root.games));
}

const firstOf = (object, ...keys) => keys.map((key) => object && object[key]).find((value) => typeof value === 'string' && value);
const listOf = (data, key) => Array.isArray(data) ? data : (data && Array.isArray(data[key]) ? data[key]
  : (data && typeof data === 'object' ? Object.values(data) : []));

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

// The stores do not agree on their key names and Heroic has moved them
// between versions, so take whichever spelling is present and let the folder
// on disk decide whether the entry is still a real install.
function heroicGame(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const install = entry.install && typeof entry.install === 'object' ? entry.install : entry;
  const dir = firstOf(install, 'install_path', 'install_dir', 'path') || firstOf(entry, 'install_path', 'install_dir', 'path');
  if (!dir || !fs.existsSync(dir)) return null;
  // A native Linux build cannot load the Windows DLSS payload. The platform is
  // not always recorded; when it is, an explicit non-Windows one is skipped.
  const platform = firstOf(install, 'platform') || firstOf(entry, 'platform');
  if (platform && !/^win/i.test(platform)) return null;
  const name = firstOf(entry, 'title', 'name') || path.basename(dir);
  if (NOT_A_GAME.test(name)) return null;
  return { launcher: 'Heroic', id: firstOf(entry, 'app_name', 'appName', 'id') || null, name, dir, poster: null };
}

// Heroic writes one settings file per game, keyed inside by the same app name,
// and falls back to the global defaults for anything the game does not
// override. Both carry the prefix and the wine build the game is launched with.
function heroicWine(root, appName, defaults) {
  const perGame = appName ? readJson(path.join(root, 'GamesConfig', `${appName}.json`)) : null;
  const settings = { ...defaults, ...((perGame && perGame[appName]) || {}) };
  const version = settings.wineVersion || {};
  // A CrossOver bottle is driven by CrossOver's own tooling rather than by
  // running a binary against a prefix.
  if (!settings.winePrefix || !version.bin || version.type === 'crossover') return null;
  return {
    bin: version.bin,
    prefix: settings.winePrefix,
    kind: version.type === 'proton' ? 'proton' : 'wine',
    steamPath: settings.defaultSteamPath || null
  };
}

function heroic(options = {}) {
  const home = options.home || os.homedir();
  const games = [];
  for (const root of options.roots || xdgRoots(home, options.env || process.env, 'heroic')) {
    const global = readJson(path.join(root, 'config.json'));
    const defaults = (global && global.defaultSettings) || {};
    const stores = [
      [path.join(root, 'legendaryConfig', 'legendary', 'installed.json'), null],
      [path.join(root, 'nile_config', 'nile', 'installed.json'), 'installed'],
      [path.join(root, 'gog_store', 'installed.json'), 'installed'],
      [path.join(root, 'sideload_apps', 'library.json'), 'games']
    ];
    for (const [file, key] of stores) {
      for (const entry of listOf(readJson(file), key)) {
        const game = heroicGame(entry);
        if (game) games.push({ ...game, wine: heroicWine(root, game.id, defaults) });
      }
    }
  }
  return games;
}

// ---------- Lutris ----------
// The install directory lives in Lutris' SQLite database, which would need a
// driver this app does not ship, and its CLI takes seconds to answer. The
// per-game config beside the database is plain YAML and holds what matters.
//
// Lutris writes these with PyYAML's block style: one unindented section per
// runner, two-space indented scalars under it. Reading exactly that much is
// enough for the executable and the keys a relative path resolves against;
// anything nested deeper is not a scalar we want anyway.
function yamlSection(text, section) {
  const values = {};
  let inside = false;
  for (const line of text.split('\n')) {
    if (/^\S/.test(line)) { inside = line.startsWith(section + ':'); continue; }
    if (!inside) continue;
    const match = line.match(/^ {2}([A-Za-z_][\w-]*): *(.*)$/);
    if (!match) continue;
    const raw = match[2].trim();
    // A key with nothing after it opens a nested block. An empty string is
    // written as '' and a missing value as null, so neither is lost here.
    if (!raw) continue;
    values[match[1]] = raw.startsWith("'") && raw.endsWith("'") && raw.length > 1
      ? raw.slice(1, -1).replace(/''/g, "'")
      : (raw.startsWith('"') && raw.endsWith('"') && raw.length > 1 ? raw.slice(1, -1) : raw);
  }
  return values;
}

const expandHome = (file, home) => file.startsWith('~/') ? path.join(home, file.slice(2)) : file;

// The handful of versions Lutris resolves to a system install rather than to
// a runner it downloaded itself.
const SYSTEM_WINE = {
  'winehq-devel': '/opt/wine-devel/bin/wine',
  'winehq-staging': '/opt/wine-staging/bin/wine',
  'wine-development': '/usr/lib/wine-development/wine',
  system: 'wine'
};

// A downloaded runner sits at <runners>/wine/<version>/bin/wine. A Proton
// version is launched through umu instead, which is not covered here.
function lutrisWine(config, wineDir, prefix, home) {
  if (!prefix || !config.version || /proton/i.test(config.version)) return null;
  const bin = config.version === 'custom'
    ? config.custom_wine_path
    : (SYSTEM_WINE[config.version] || path.join(wineDir, config.version, 'bin', 'wine'));
  if (!bin) return null;
  const file = expandHome(bin, home);
  // A bare name is left for PATH to resolve; a full path has to be there.
  if (path.isAbsolute(file) && !fs.existsSync(file)) return null;
  return { bin: file, prefix, kind: 'wine' };
}

function lutris(options = {}) {
  const home = options.home || os.homedir();
  const games = [];
  for (const root of options.roots || lutrisRoots(home, options.env || process.env)) {
    let files = [];
    try { files = fs.readdirSync(root.games).filter((file) => file.endsWith('.yml')); } catch { continue; }
    for (const file of files) {
      let text;
      try { text = fs.readFileSync(path.join(root.games, file), 'utf8'); } catch { continue; }
      const game = yamlSection(text, 'game');
      // Native Linux games are listed here too and cannot load the Windows
      // payload, so the executable has to be a Windows one.
      if (!game.exe || !/\.exe$/i.test(game.exe)) continue;
      let exe = expandHome(game.exe, home);
      if (!path.isAbsolute(exe)) exe = path.resolve(expandHome(game.working_dir || game.prefix || '', home), exe);
      const dir = path.dirname(exe);
      if (!fs.existsSync(dir)) continue;
      // The file is named <slug>-<unix time>, and the slug is the only name
      // Lutris keeps outside its database.
      const slug = file.replace(/\.yml$/i, '').replace(/-\d+$/, '');
      const name = slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()).trim();
      if (!name || NOT_A_GAME.test(name)) continue;
      const prefix = game.prefix ? expandHome(game.prefix, home) : null;
      games.push({
        launcher: 'Lutris', id: slug, name, dir, poster: null,
        wine: lutrisWine(yamlSection(text, 'wine'), root.wineDir, prefix, home)
      });
    }
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
function drives() {
  try {
    const out = execFileSync('powershell', ['-NoProfile', '-Command',
      'Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object { $_.DeviceID }'
    ], { encoding: 'utf8', timeout: 8000, windowsHide: true });
    const found = out.split(/\r?\n/).map((l) => l.trim()).filter((l) => /^[A-Za-z]:$/.test(l));
    if (found.length) return found.map((d) => d + '\\');
  } catch {}
  // If that is unavailable, fall back to whatever letters answer a read.
  const list = [];
  for (let c = 67; c <= 90; c++) {
    const root = String.fromCharCode(c) + ':\\';
    try { fs.readdirSync(root); list.push(root); } catch {}
  }
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

// One game can be installed twice - a launcher copy and a loose copy. They are
// different installs, so both are kept; only the exact same folder is merged.
// Two paths can name one folder. Steam keeps its data under ~/.steam/steam and
// ~/.local/share/Steam, one a symlink to the other, and both are searched - so
// resolving the string alone leaves every Steam game in the library twice.
function folderKey(dir) {
  try { return fs.realpathSync(dir).toLowerCase(); } catch { return path.resolve(dir).toLowerCase(); }
}

function dedupe(games) {
  const seen = new Map();
  for (const entry of games) {
    const g = canonicalGame(entry);
    const key = folderKey(g.dir);
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
  const found = [...steam(), ...epic(), ...gog(), ...heroic(), ...lutris()];
  const roots = (scanDrives ? findAutoRoots() : [])
    .filter((root) => !excludedRoots.some((excluded) => isInside(root, excluded)));
  for (const dir of roots) found.push(...folder(dir, 'My folders', true));
  // A user-picked scan root can still contain ReShade assets, backups and
  // unrelated folders. Keep only children that actually contain a runnable
  // game or emulator, just like automatically discovered library roots.
  for (const dir of extraFolders) found.push(...folder(dir, 'My folders', true));
  return { games: dedupe(filterExcluded(found, excludedRoots)), roots };
}

module.exports = { discover, folder, dedupe, autoRoots, drives, isInside, filterExcluded, steam, linuxSteamRoots, heroic, lutris, yamlSection };

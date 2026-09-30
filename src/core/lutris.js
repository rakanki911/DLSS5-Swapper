'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const YAML = require('yaml');

// Read launcher configuration only. Never create a prefix or select an
// unrelated system Wine when the configured runner is missing.
function registrations(options = {}) {
  if ((options.platform || process.platform) !== 'linux') return [];
  const home = options.home || os.homedir();
  const data = options.dataHome || process.env.XDG_DATA_HOME || path.join(home, '.local/share');
  const root = path.join(data, 'lutris');
  const configs = path.join(root, 'games');
  const expand = value => typeof value === 'string' ? value.replace(/^~(?=\/)/, home) : '';
  let names;
  try { names = fs.readdirSync(configs); } catch { return []; }
  const entries = [];
  for (const name of names.filter(n => /\.ya?ml$/.test(n))) {
    let config, prefix;
    try {
      config = YAML.parse(fs.readFileSync(path.join(configs, name), 'utf8'));
      prefix = fs.realpathSync(expand(config?.wine?.prefix));
      if (!fs.existsSync(path.join(prefix, 'system.reg'))) continue;
      if (config.runner && config.runner !== 'wine') continue;
    } catch { continue; }
    entries.push({ config, prefix, root, home, expand, configPath: path.join(configs, name) });
  }
  return entries;
}

function inside(child, parent) {
  const rel = path.relative(parent, child);
  return rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel);
}

function executablePath(entry) {
  const value = entry.expand(entry.config.game?.exe);
  if (!value) return null;
  let file;
  const drive = /^([a-z]):[\\/](.*)$/i.exec(value);
  if (drive) {
    const base = drive[1].toLowerCase() === 'c' ? path.join(entry.prefix, 'drive_c')
      : path.join(entry.prefix, 'dosdevices', drive[1].toLowerCase() + ':');
    file = path.resolve(base, drive[2].replace(/\\/g, '/'));
  } else if (path.isAbsolute(value)) file = value;
  else file = path.resolve(entry.expand(entry.config.game?.working_dir) || entry.prefix, value);
  try { return fs.statSync(file).isFile() ? fs.realpathSync(file) : null; } catch { return null; }
}

function gamesForEntry(entry) {
  const exe = executablePath(entry);
  if (!exe || !/\.exe$/i.test(exe)) return [];
  // Import the registered installation only. The existing scanGame pipeline
  // owns rendering API detection and executable selection; a launcher's sibling
  // games must not be guessed from product names or a sweep of its Wine prefix.
  return [{ dir: path.dirname(exe), exe,
    name: entry.config.name || entry.config.game?.name || path.basename(path.dirname(exe)) }];
}

function lutris(options = {}) {
  const found = new Map();
  for (const entry of registrations(options)) {
    for (const game of gamesForEntry(entry)) {
      if (!found.has(game.dir)) found.set(game.dir, {
        ...game, launcher: 'Lutris', id: null, poster: null,
        lutrisConfig: entry.configPath, winePrefix: entry.prefix
      });
    }
  }
  return [...found.values()];
}

function contextForLutrisGame(dir, options = {}) {
  if ((options.platform || process.platform) !== 'linux') return null;
  const realDir = fs.realpathSync(dir);
  const matches = [];
  const entries = registrations(options);
  const exactEntries = entries.filter(entry => gamesForEntry(entry).some(game => game.dir === realDir));
  // Shared prefixes may contain several games with different per-game env.
  // Prefer the actual registration; prefix containment is a manual-add fallback.
  for (const entry of exactEntries.length ? exactEntries : entries) {
    const { config, prefix, root, expand } = entry;
    let inPrefix = false;
    try { inPrefix = inside(realDir, fs.realpathSync(path.join(prefix, 'drive_c'))); } catch {}
    const exactImport = gamesForEntry(entry).some(game => game.dir === realDir);
    if (!inPrefix && !exactImport) continue;
    const wine = config.wine;
    const env = Object.fromEntries(Object.entries(config.system?.env || {})
      .filter(([, v]) => typeof v === 'string' || typeof v === 'number')
      .map(([k, v]) => [k, String(v)]));
    let command;
    if (wine.version === 'ge-proton') {
      command = [path.join(root, 'runtime/umu/umu-run'), '/usr/bin/umu-run']
        .find(file => fs.existsSync(file));
      env.PROTONPATH ||= 'GE-Proton';
      env.GAMEID ||= 'umu-default';
      env.WINEARCH ||= 'win64';
    } else if (wine.version === 'custom') {
      command = expand(wine.custom_wine_path);
      if (/proton/i.test(command)) throw new Error('Lutris: custom Proton runners require UMU configuration.');
    } else if (wine.version === 'system') {
      command = '/usr/bin/wine';
    } else if (typeof wine.version === 'string' && /^[\w.+-]+$/.test(wine.version) && !/proton/i.test(wine.version)) {
      command = path.join(root, 'runners/wine', wine.version, 'bin/wine');
    }
    if (!command || !path.isAbsolute(command)) throw new Error(`Lutris runner unavailable: ${wine.version}`);
    try { fs.accessSync(command, fs.constants.X_OK); }
    catch { throw new Error(`Lutris runner not executable: ${command}`); }
    matches.push({ command, prefix, env, launcher: 'Lutris', config: entry.configPath });
  }
  if (matches.length > 1 && matches.some(m => m.prefix !== matches[0].prefix || m.command !== matches[0].command || JSON.stringify(m.env) !== JSON.stringify(matches[0].env))) {
    throw new Error('Multiple Lutris configurations match this game with different runners or environments.');
  }
  return matches[0] || null;
}

module.exports = { contextForLutrisGame, lutris };

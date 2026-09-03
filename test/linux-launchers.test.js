'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { heroic, lutris, yamlSection } = require('../src/library');

function tree(root, files) {
  for (const [rel, body] of Object.entries(files)) {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof body === 'string' ? body : JSON.stringify(body));
  }
}

test('Heroic games are read from each store, whichever key names it uses', (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-heroic-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const root = path.join(home, '.config', 'heroic');
  const install = (name) => {
    const dir = path.join(home, 'Games', name);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  };
  const epic = install('Epic Game'), gog = install('GOG Game'), sideload = install('Sideloaded');
  install('Native Game');

  tree(root, {
    // legendary keys its file by app name and nests nothing.
    'legendaryConfig/legendary/installed.json': {
      Ordinal: { app_name: 'Ordinal', title: 'Epic Game', install_path: epic, platform: 'Windows' },
      Gone: { app_name: 'Gone', title: 'Uninstalled', install_path: path.join(home, 'Games', 'Removed') }
    },
    // The GOG store wraps its list, and spells the id differently.
    'gog_store/installed.json': { installed: [
      { appName: '1234', install_path: gog, platform: 'windows' },
      { appName: '5678', install_path: path.join(home, 'Games', 'Native Game'), platform: 'linux' }
    ] },
    // A sideloaded game keeps its paths one level down.
    'sideload_apps/library.json': { games: [
      { app_name: 'side-1', title: 'Sideloaded', install: { install_path: sideload, platform: 'Windows' } }
    ] }
  });

  const games = heroic({ home, env: {} });
  assert.deepEqual(games.map((game) => game.name).sort(), ['Epic Game', 'GOG Game', 'Sideloaded']);
  assert.deepEqual(games.map((game) => game.launcher), ['Heroic', 'Heroic', 'Heroic']);
  // No title anywhere in the GOG store, so the folder names it.
  assert.equal(games.find((game) => game.id === '1234').dir, gog);
  assert.equal(games.find((game) => game.id === 'Ordinal').dir, epic);
});

test('a Flatpak Heroic keeps its own config tree and is read too', (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-heroic-flatpak-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const dir = path.join(home, 'Games', 'Flatpak Game');
  fs.mkdirSync(dir, { recursive: true });
  tree(path.join(home, '.var', 'app', 'com.heroicgameslauncher.hgl', 'config', 'heroic'), {
    'legendaryConfig/legendary/installed.json': { One: { app_name: 'One', title: 'Flatpak Game', install_path: dir } }
  });
  assert.deepEqual(heroic({ home, env: {} }).map((game) => game.name), ['Flatpak Game']);
});

// Written exactly as PyYAML's safe_dump produces it: block style, two-space
// indent, keys sorted, and quoting only where a value needs it.
const LUTRIS_YML = `game:
  arch: win64
  exe: drive_c/GOG Games/Some Game/bin/game.exe
  prefix: PREFIX
  working_dir: ''
system:
  env:
    DXVK_HUD: '1'
wine:
  dxvk: true
  version: wine-ge-8-26
`;

test('Lutris games come from the per-game config, with a relative exe resolved against the prefix', (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-lutris-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const prefix = path.join(home, 'Games', 'some-game');
  const nested = path.join(prefix, 'drive_c', 'GOG Games', 'Some Game', 'bin');
  fs.mkdirSync(nested, { recursive: true });
  const absolute = path.join(home, 'Games', 'Other');
  fs.mkdirSync(absolute, { recursive: true });

  const games = path.join(home, '.config', 'lutris', 'games');
  tree(games, {
    'some-game-1700000000.yml': LUTRIS_YML.replace('PREFIX', prefix),
    'other-game-1700000001.yml': `game:\n  exe: ${path.join(absolute, 'Other.exe')}\n`,
    // A native Linux game is listed here too and cannot take the payload.
    'native-game-1700000002.yml': `game:\n  exe: ${path.join(absolute, 'native.sh')}\n`,
    // The folder is gone but the config outlives it.
    'stale-game-1700000003.yml': `game:\n  exe: ${path.join(home, 'Games', 'Removed', 'x.exe')}\n`
  });

  const found = lutris({ home, env: {} });
  assert.deepEqual(found.map((game) => game.name).sort(), ['Other Game', 'Some Game']);
  assert.equal(found.find((game) => game.id === 'some-game').dir, nested);
  assert.equal(found.find((game) => game.id === 'other-game').dir, absolute);
  assert.equal(found[0].launcher, 'Lutris');
});

test('the config reader takes one section and leaves the rest alone', () => {
  const game = yamlSection(LUTRIS_YML.replace('PREFIX', '~/Games/x'), 'game');
  assert.equal(game.exe, 'drive_c/GOG Games/Some Game/bin/game.exe');
  assert.equal(game.prefix, '~/Games/x');
  assert.equal(game.working_dir, '');
  assert.equal(game.version, undefined, 'the wine section is not merged in');
  assert.equal(yamlSection(LUTRIS_YML, 'wine').version, 'wine-ge-8-26');
  assert.equal(yamlSection(LUTRIS_YML, 'system').env, undefined, 'a nested map is not a scalar');
  // PyYAML escapes a single quote by doubling it inside a quoted scalar.
  assert.equal(yamlSection("game:\n  exe: 'C:\\O''Brien\\game.exe'\n", 'game').exe, "C:\\O'Brien\\game.exe");
});

test('a tilde in a Lutris path is expanded against the home it was found in', (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-lutris-tilde-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const dir = path.join(home, 'Games', 'Tilde', 'bin');
  fs.mkdirSync(dir, { recursive: true });
  tree(path.join(home, '.config', 'lutris', 'games'), {
    'tilde-game-1700000004.yml': 'game:\n  exe: bin/game.exe\n  prefix: ~/Games/Tilde\n'
  });
  assert.equal(lutris({ home, env: {} })[0].dir, dir);
});

const { contextForGame, contextForWineGame, contextForSteamGame, createSetupRunner } = require('../src/core/proton');
const linuxOnly = { skip: process.platform !== 'linux' ? 'Linux only' : false };

test('a wine game is run by pointing its own binary at its own prefix', linuxOnly, (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-wine-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const prefix = path.join(root, 'prefix');
  fs.mkdirSync(prefix, { recursive: true });

  const context = contextForWineGame({ id: 'x', wine: { bin: '/usr/bin/wine', prefix, kind: 'wine' } });
  assert.deepEqual(context, { command: '/usr/bin/wine', lead: [], env: { WINEPREFIX: prefix } });

  // Heroic can be set to Proton instead, and points the compatibility path at
  // the prefix folder it configured rather than at wine's prefix inside it.
  const proton = contextForWineGame({ id: '42', wine: { bin: '/opt/proton/proton', prefix, kind: 'proton', steamPath: '/steam' } });
  assert.deepEqual(proton.lead, ['run']);
  assert.equal(proton.env.WINEPREFIX, path.join(prefix, 'pfx'));
  assert.equal(proton.env.STEAM_COMPAT_DATA_PATH, prefix);
  assert.equal(proton.env.STEAM_COMPAT_CLIENT_INSTALL_PATH, '/steam');

  // A prefix that is not there yet cannot be run against.
  assert.equal(contextForWineGame({ wine: { bin: '/usr/bin/wine', prefix: path.join(root, 'gone'), kind: 'wine' } }), null);
  assert.equal(contextForWineGame({ dir: root }), null);
});

test('a Steam Play prefix is preferred over any wine one on the same game', linuxOnly, (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-both-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const prefix = path.join(root, 'steamapps', 'compatdata', '7', 'pfx');
  fs.mkdirSync(prefix, { recursive: true });
  const proton = path.join(root, 'steamapps', 'common', 'Proton 9.0', 'proton');
  fs.mkdirSync(path.dirname(proton), { recursive: true });
  fs.writeFileSync(proton, '');
  const wine = path.join(root, 'wineprefix');
  fs.mkdirSync(wine);

  const game = { id: '7', steamRoot: root, protonPrefix: prefix, wine: { bin: '/usr/bin/wine', prefix: wine, kind: 'wine' } };
  assert.equal(contextForGame(game).command, proton);
  assert.deepEqual(contextForGame(game), contextForSteamGame(game));
});

test('the setup runner really launches the configured binary inside the prefix', linuxOnly, async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-runner-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const prefix = path.join(root, 'prefix');
  const gameDir = path.join(root, 'game');
  fs.mkdirSync(prefix, { recursive: true });
  fs.mkdirSync(gameDir, { recursive: true });

  // Stands in for wine: reports what it was handed and where it was pointed.
  const fake = path.join(root, 'fake-wine');
  fs.writeFileSync(fake, '#!/bin/sh\necho "prefix=$WINEPREFIX"\necho "argv=$*"\n');
  fs.chmodSync(fake, 0o755);

  const context = contextForWineGame({ wine: { bin: fake, prefix, kind: 'wine' } });
  const logged = [];
  const result = await createSetupRunner(context)('/setup/ReShade_Setup.exe',
    [path.join(gameDir, 'Game.exe'), '--api', 'dxgi', '--headless'], (code) => logged.push(code));

  assert.equal(result.code, 0);
  assert.match(result.output, new RegExp(`prefix=${prefix}$`, 'm'));
  assert.match(result.output, /argv=\/setup\/ReShade_Setup\.exe .*Game\.exe --api dxgi --headless/);
  assert.deepEqual(logged, ['runningSetup']);
});

test('Heroic reads the prefix from the per-game file, falling back to the global defaults', (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-heroic-wine-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const root = path.join(home, '.config', 'heroic');
  const dirs = {};
  for (const name of ['Shared', 'Own', 'Bottled']) {
    dirs[name] = path.join(home, 'Games', name);
    fs.mkdirSync(dirs[name], { recursive: true });
  }
  tree(root, {
    'config.json': { defaultSettings: {
      winePrefix: path.join(home, 'Prefixes', 'shared'),
      defaultSteamPath: path.join(home, '.steam', 'steam'),
      wineVersion: { bin: '/usr/bin/wine', type: 'wine', name: 'wine-11.16' }
    } },
    'legendaryConfig/legendary/installed.json': {
      shared: { app_name: 'shared', title: 'Shared', install_path: dirs.Shared },
      own: { app_name: 'own', title: 'Own', install_path: dirs.Own },
      bottled: { app_name: 'bottled', title: 'Bottled', install_path: dirs.Bottled }
    },
    // This one overrides both the prefix and the wine build.
    'GamesConfig/own.json': { own: {
      winePrefix: path.join(home, 'Prefixes', 'own'),
      wineVersion: { bin: '/opt/proton/proton', type: 'proton' }
    }, version: 'v0' },
    // A CrossOver bottle is not driven by running a binary against a prefix.
    'GamesConfig/bottled.json': { bottled: { winePrefix: path.join(home, 'Bottles', 'x'), wineVersion: { bin: '/x/wine', type: 'crossover' } } }
  });

  const games = heroic({ home, env: {} });
  const of = (name) => games.find((game) => game.name === name).wine;
  assert.deepEqual(of('Shared'), {
    bin: '/usr/bin/wine', prefix: path.join(home, 'Prefixes', 'shared'), kind: 'wine',
    steamPath: path.join(home, '.steam', 'steam')
  });
  assert.equal(of('Own').kind, 'proton');
  assert.equal(of('Own').prefix, path.join(home, 'Prefixes', 'own'));
  assert.equal(of('Bottled'), null);
});

test('Lutris resolves a downloaded runner, a system one, and leaves Proton alone', (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-lutris-wine-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const prefix = path.join(home, 'Games', 'prefix');
  const exeDir = path.join(prefix, 'drive_c', 'Game');
  fs.mkdirSync(exeDir, { recursive: true });
  const runner = path.join(home, '.local', 'share', 'lutris', 'runners', 'wine', 'wine-ge-8-26', 'bin');
  fs.mkdirSync(runner, { recursive: true });
  fs.writeFileSync(path.join(runner, 'wine'), '');

  const yml = (version) => `game:\n  exe: ${path.join(exeDir, 'Game.exe')}\n  prefix: ${prefix}\nwine:\n  version: ${version}\n`;
  // Lutris keeps its configuration in the data directory when ~/.config/lutris
  // is absent, which is where a current install puts it.
  tree(path.join(home, '.local', 'share', 'lutris', 'games'), {
    'downloaded-1.yml': yml('wine-ge-8-26'),
    'system-2.yml': yml('system'),
    'missing-3.yml': yml('wine-ge-9-99'),
    'ge-runner-4.yml': yml('GE-Proton9-20'),
    'no-prefix-5.yml': `game:\n  exe: ${path.join(exeDir, 'Game.exe')}\nwine:\n  version: system\n`
  });

  const games = lutris({ home, env: {} });
  const of = (id) => games.find((game) => game.id === id).wine;
  assert.equal(games.length, 5, 'every game is still listed, prefix or not');
  assert.deepEqual(of('downloaded'), { bin: path.join(runner, 'wine'), prefix, kind: 'wine' });
  assert.deepEqual(of('system'), { bin: 'wine', prefix, kind: 'wine' });
  assert.equal(of('missing'), null, 'a runner that is not downloaded yet');
  assert.equal(of('ge-runner'), null, 'Proton is launched through umu, not covered here');
  assert.equal(of('no-prefix'), null);
});

test('one folder reached by two paths is one game, not two', linuxOnly, (t) => {
  const { dedupe } = require('../src/library');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-dedupe-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  // Steam's two data roots, exactly as they sit in a real home directory.
  const real = path.join(root, '.local', 'share', 'Steam');
  fs.mkdirSync(path.join(real, 'steamapps', 'common', 'A Game'), { recursive: true });
  fs.mkdirSync(path.join(root, '.steam'), { recursive: true });
  fs.symlinkSync(real, path.join(root, '.steam', 'steam'));

  const viaData = path.join(real, 'steamapps', 'common', 'A Game');
  const viaLink = path.join(root, '.steam', 'steam', 'steamapps', 'common', 'A Game');
  assert.notEqual(path.resolve(viaData), path.resolve(viaLink), 'the two paths really are different strings');

  const games = dedupe([
    { launcher: 'Steam', id: '1', name: 'A Game', dir: viaData, poster: null },
    { launcher: 'Steam', id: '1', name: 'A Game', dir: viaLink, poster: null }
  ]);
  assert.equal(games.length, 1);
});

// A DLC's installed.json entry points at the base game's own folder and can
// carry no executable of its own. Found via a real install: Cyberpunk 2077's
// REDmod DLC shares the base game's install_path and precedes it in the
// store's key order, and "REDmod" does not match dedupe's /\bdlc\b/ pattern,
// so without this filter the DLC entry is the one that survives.
test('a DLC entry pointing at the base game\'s folder is skipped', (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-heroic-dlc-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const dir = path.join(home, 'Games', 'BaseGame');
  fs.mkdirSync(dir, { recursive: true });

  tree(path.join(home, '.config', 'heroic'), {
    'legendaryConfig/legendary/installed.json': {
      // Alphabetically first, exactly as in the real installed.json.
      '02855a2f4c044aa1a813b19f8c447fe1': {
        app_name: '02855a2f4c044aa1a813b19f8c447fe1', title: 'Base Game - REDmod',
        install_path: dir, is_dlc: true, executable: '', platform: 'Windows'
      },
      Ginger: {
        app_name: 'Ginger', title: 'Base Game',
        install_path: dir, is_dlc: false, executable: 'game.exe', platform: 'Windows'
      }
    }
  });

  const games = heroic({ home, env: {} });
  assert.equal(games.length, 1, 'the DLC entry does not also produce a game');
  assert.equal(games[0].id, 'Ginger');
  assert.equal(games[0].name, 'Base Game');
});

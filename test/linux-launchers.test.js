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

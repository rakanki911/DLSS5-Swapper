'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const library = require('../src/library.js');

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-xbox-library-'));
  t.after(() => { library.setRegistryRunner(undefined); fs.rmSync(root, { recursive: true, force: true }); });
  return root;
}

// What the Xbox app drops at the root of every drive it installs to: "RGBX",
// a version, then the games folder as UTF-16 with a terminating null.
function gamingRootMarker(relative) {
  return Buffer.concat([
    Buffer.from([0x52, 0x47, 0x42, 0x58, 0x01, 0x00, 0x00, 0x00]),
    Buffer.from(relative + '\0', 'utf16le')
  ]);
}

function config(displayName, identity) {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<Game configVersion="1">',
    '  <Identity',
    `    Name="${identity || 'Publisher.' + displayName.replace(/[^A-Za-z0-9]/g, '')}"`,
    '    Publisher="CN=00000000-0000-0000-0000-000000000000" />',
    '  <ShellVisuals',
    `    DefaultDisplayName="${displayName}"`,
    '    StoreLogo="StoreLogo.png" />',
    '  <ExecutableList>',
    '    <Executable Name="game.exe" Id="Game" Architecture="x64"/>',
    '  </ExecutableList>',
    '</Game>'
  ].join('\r\n');
}

// One game the way the app lays it out: <root>\<Game>\Content\.
function installGame(root, folderName, displayName, identity) {
  const content = path.join(root, folderName, 'Content');
  fs.mkdirSync(content, { recursive: true });
  fs.writeFileSync(path.join(content, 'MicrosoftGame.config'), config(displayName, identity));
  fs.writeFileSync(path.join(content, 'game.exe'), 'test');
  return path.join(root, folderName);
}

// Gaming Services' package repository, as `reg query ... /s /v Root` answers
// it: one block per package, the folder written as an extended-length path.
function fakeRegistry(packages) {
  const repository = 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\GamingServices\\PackageRepository\\Root';
  return (args) => {
    const [, queried, recurse, flag, value] = args;
    // reg.exe takes the short root and answers with the long one.
    const key = queried.replace(/^HKLM\\/, 'HKEY_LOCAL_MACHINE\\');
    if (key !== repository || recurse !== '/s' || flag !== '/v' || value !== 'Root') {
      throw new Error('ERROR: The system was unable to find the specified registry key or value.');
    }
    return Object.entries(packages).map(([family, dir]) =>
      `\r\n${repository}\\${family}\\leaf\r\n    Root    REG_SZ    \\\\?\\${dir}\\\r\n`).join('') + '\r\n';
  };
}

test('games in the folder named by .GamingRoot are found, and save data is not', (t) => {
  const drive = tempRoot(t);
  library.setRegistryRunner(() => { throw new Error('ERROR: no Gaming Services'); });

  const root = path.join(drive, 'XboxGames');
  const dave = installGame(root, 'Dave The Diver', 'Dave The Diver');
  // Windows forbids a colon in a folder name, so the app strips it out. The
  // config beside the game still has the title the store shows.
  const heroes = installGame(root, 'Heroes of Might and Magic- Olden Era', 'Heroes of Might and Magic: Olden Era');
  // Save data sits beside the games and has no Content folder.
  fs.mkdirSync(path.join(root, 'GameSave', 'wgs'), { recursive: true });
  fs.writeFileSync(path.join(drive, '.GamingRoot'), gamingRootMarker('XboxGames'));

  const games = library.xbox({ drives: [drive] });
  assert.equal(games.length, 2, 'both games, and nothing else in the folder');
  assert.ok(games.every((g) => g.launcher === 'Xbox'));

  const byDir = new Map(games.map((g) => [g.dir, g]));
  assert.ok(byDir.has(dave), 'the game folder is the entry, not its Content');
  assert.equal(byDir.get(dave).name, 'Dave The Diver');
  assert.equal(byDir.get(heroes).name, 'Heroes of Might and Magic: Olden Era',
    'the real title beats the folder name Windows allowed');
});

test('a drive with no marker, or a marker naming a folder that is gone, finds nothing', (t) => {
  const drive = tempRoot(t);
  library.setRegistryRunner(() => { throw new Error('ERROR: no Gaming Services'); });

  assert.deepEqual(library.xbox({ drives: [drive] }), [], 'no marker at all');
  assert.equal(library.gamingRootFolder(drive), null);

  fs.writeFileSync(path.join(drive, '.GamingRoot'), gamingRootMarker('XboxGames'));
  assert.deepEqual(library.xbox({ drives: [drive] }), [], 'the folder the marker names is gone');
  assert.equal(library.gamingRootFolder(drive), null);

  // Something else that happens to sit at that name is not a marker.
  fs.writeFileSync(path.join(drive, '.GamingRoot'), 'not a marker');
  assert.equal(library.gamingRootFolder(drive), null);
});

test('a package recorded in WindowsApps is followed back to the writable install', (t) => {
  const root = tempRoot(t);
  const drive = path.join(root, 'drive');
  const gamesFolder = path.join(drive, 'XboxGames');
  const game = installGame(gamesFolder, 'Dave The Diver', 'Dave The Diver');
  fs.writeFileSync(path.join(drive, '.GamingRoot'), gamingRootMarker('XboxGames'));

  // WindowsApps holds a junction back into the flat-file install, which is
  // what the repository records.
  const windowsApps = path.join(root, 'WindowsApps');
  fs.mkdirSync(windowsApps, { recursive: true });
  const pkg = 'Mintrocket.DaveTheDiver_1.0.145.0_x64__mnyz31d5jqk06';
  fs.symlinkSync(path.join(game, 'Content'), path.join(windowsApps, pkg), 'junction');
  library.setRegistryRunner(fakeRegistry({ '{A89ECE52}#{CAC205A6}': path.join(windowsApps, pkg) }));

  const games = library.xbox({ drives: [drive] });
  assert.equal(games.length, 1, 'the same install is not listed twice');
  assert.equal(games[0].dir, game, 'the writable folder, not the protected package');
  assert.equal(games[0].id, pkg, 'the package name is kept');
  assert.equal(games[0].name, 'Dave The Diver');
});

// What the app actually did: on the Node that Electron bundles, resolving the
// junction throws EPERM, because lstat on `Program Files\WindowsApps` itself
// is refused to anyone who is not an administrator. Both routes then reach the
// same game by paths that do not match, and it was listed twice.
test('a game whose junction cannot be followed is still listed once', (t) => {
  const root = tempRoot(t);
  const drive = path.join(root, 'drive');
  const game = installGame(path.join(drive, 'XboxGames'), 'Dave The Diver',
    'Dave The Diver', 'Mintrocket.DaveTheDiver');
  fs.writeFileSync(path.join(drive, '.GamingRoot'), gamingRootMarker('XboxGames'));

  // A stand-in for the package the repository points at, which here cannot be
  // resolved back to the folder above - exactly what EPERM leaves behind.
  const windowsApps = path.join(root, 'WindowsApps');
  const pkg = 'Mintrocket.DaveTheDiver_1.0.145.0_x64__mnyz31d5jqk06';
  fs.mkdirSync(path.join(windowsApps, pkg), { recursive: true });
  fs.writeFileSync(path.join(windowsApps, pkg, 'MicrosoftGame.config'),
    config('Dave The Diver', 'Mintrocket.DaveTheDiver'));
  fs.writeFileSync(path.join(windowsApps, pkg, 'game.exe'), 'test');
  library.setRegistryRunner(fakeRegistry({ '{A89ECE52}#{CAC205A6}': path.join(windowsApps, pkg) }));

  const games = library.xbox({ drives: [drive] });
  assert.equal(games.length, 1, 'one game, not one per path it can be reached by');
  assert.equal(games[0].dir, game, 'the writable copy wins over the protected one');
  assert.equal(games[0].id, pkg, 'and it still picks up the package name');
});

test('a package that is not a junction is still listed, named from its package', (t) => {
  const root = tempRoot(t);
  const windowsApps = path.join(root, 'WindowsApps');
  const pkg = 'Mintrocket.DaveTheDiver_1.0.145.0_x64__mnyz31d5jqk06';
  fs.mkdirSync(path.join(windowsApps, pkg), { recursive: true });
  fs.writeFileSync(path.join(windowsApps, pkg, 'game.exe'), 'test');
  library.setRegistryRunner(fakeRegistry({
    '{A89ECE52}#{CAC205A6}': path.join(windowsApps, pkg),
    // A key left behind after the package was removed.
    '{A89ECE52}#{DEADBEEF}': path.join(windowsApps, 'Gone.Package_1.0.0.0_x64__abcdefghijklm')
  }));

  const games = library.xbox({ drives: [] });
  assert.equal(games.length, 1, 'only the package still on disk');
  assert.equal(games[0].dir, path.join(windowsApps, pkg));
  assert.equal(games[0].name, 'Dave The Diver', 'the package name read as words');
});

test('no Xbox install means no games and no error', (t) => {
  const drive = tempRoot(t);
  library.setRegistryRunner(() => { throw new Error('ERROR: The system was unable to find the specified registry key or value.'); });
  assert.deepEqual(library.xbox({ drives: [drive] }), []);
});

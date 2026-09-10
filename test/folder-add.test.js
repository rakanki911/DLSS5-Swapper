'use strict';
// #253: somebody pointed "Add a folder" at one game's own folder. The scanner
// listed what was inside it, so their library gained "Engine" and "Binaries" as
// two games - and "Engine" then matched the artwork for Wallpaper Engine. The
// game itself was never added, and no button they could find would add it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const library = require('../src/library');

const temp = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swapper-folder-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};
const make = (root, files) => {
  for (const rel of files) {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'x');
  }
  return root;
};

test('one Unreal game folder is added as that one game', (t) => {
  const root = temp(t);
  const game = make(path.join(root, 'Lego Batman'), [
    'Engine/Binaries/Win64/CrashReportClient.exe',
    'Engine/Content/placeholder.uasset',
    'DarkKnight/Binaries/Win64/DarkKnight-Win64-Shipping.exe'
  ]);
  const found = library.folder(game, 'My folders');
  assert.equal(found.length, 1, 'one game, not a shelf of engine folders');
  assert.equal(found[0].name, 'Lego Batman');
  assert.equal(found[0].dir, game);
});

test('a real shelf of games still lists every game on it', (t) => {
  const root = temp(t);
  make(root, ['Game One/GameOne.exe', 'Game Two/Bin/GameTwo.exe']);
  const found = library.folder(root, 'My folders');
  assert.deepEqual(found.map((g) => g.name).sort(), ['Game One', 'Game Two']);
});

test('engine furniture is never offered as a game', (t) => {
  const root = temp(t);
  // No Engine\Binaries here, so this is a shelf rather than one Unreal game -
  // but it still has furniture lying on it that must not be listed.
  make(root, ['Engine/Content/x.uasset', 'Binaries/Win64/other.exe', 'Content/x.pak', 'Real Game/Real.exe']);
  const names = library.folder(root, 'My folders').map((g) => g.name);
  assert.ok(!names.includes('Engine'), 'Engine is not a game');
  assert.ok(!names.includes('Binaries'), 'nor is Binaries');
  assert.ok(!names.includes('Content'), 'nor is Content');
  assert.deepEqual(names, ['Real Game']);
});

test('a folder holding only a game, with nothing game-like inside, adds the folder', (t) => {
  const root = temp(t);
  const game = make(path.join(root, 'Old Game'), ['OldGame.exe', 'Content/data.pak']);
  const found = library.folder(game, 'My folders');
  assert.equal(found.length, 1);
  assert.equal(found[0].name, 'Old Game');
});

// A library root is not a game. D:\SteamLibrary holds only steamapps, which is
// filtered out of a swept-up root by design - and the "add the folder itself"
// fallback then turned the library into a game card called "SteamLibrary".
test('a swept-up library root is never added as a game', (t) => {
  const root = temp(t);
  const library = make(path.join(root, 'SteamLibrary'), [
    'steamapps/common/Some Game/Some Game.exe',
    'steamapps/appmanifest_1.acf'
  ]);
  assert.deepEqual(library ? require('../src/library').folder(library, 'Steam', true) : null, [],
    'the shelf itself is not a game');
  // The same folder chosen by hand is a different question, and still answered.
  const byHand = require('../src/library').folder(library, 'My folders', false).map((g) => g.name);
  assert.deepEqual(byHand, ['steamapps'], 'listed whole, because they know what they put there');
});

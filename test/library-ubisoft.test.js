'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const library = require('../src/library.js');

// A stand-in for reg.exe holding what Ubisoft Connect actually writes: one key
// per game, the folder in InstallDir with forward slashes.
function fakeRegistry(entries) {
  const root = 'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher\\Installs';
  return (args) => {
    const [, key, flag, value] = args;
    if (!/Ubisoft/i.test(key)) throw new Error('ERROR: The system was unable to find the specified registry key or value.');
    if (flag !== '/v') {
      return ['', key, ...Object.keys(entries).map(id => `${root}\\${id}`), ''].join('\r\n');
    }
    const id = key.split('\\').pop();
    if (!entries[id] || value !== 'InstallDir') throw new Error('ERROR: not found');
    return `\r\n${key}\r\n    InstallDir    REG_SZ    ${entries[id]}\r\n\r\n`;
  };
}

test('Ubisoft Connect games are found, and uninstalled ones are not', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ubisoft-'));
  t.after(() => { library.setRegistryRunner(undefined); fs.rmSync(root, { recursive: true, force: true }); });

  const installed = path.join(root, 'Far Cry 5');
  fs.mkdirSync(installed, { recursive: true });
  library.setRegistryRunner(fakeRegistry({
    // Forward slashes, the way the launcher writes them.
    '1234': installed.split(path.sep).join('/'),
    // A key left behind by an uninstall.
    '5678': path.join(root, 'Removed Game'),
    // Tooling that is not a game.
    '9012': path.join(root, 'DirectX')
  }));

  const games = library.ubisoft();
  assert.equal(games.length, 1, 'only the game that is still on disk');
  assert.equal(games[0].name, 'Far Cry 5');
  assert.equal(games[0].launcher, 'Ubisoft');
  assert.equal(games[0].id, '1234');
  assert.equal(games[0].dir, path.resolve(installed), 'the path is normalised for the scanner');
});

test('no Ubisoft install means no games and no error', (t) => {
  t.after(() => library.setRegistryRunner(undefined));
  library.setRegistryRunner(() => { throw new Error('ERROR: The system was unable to find the specified registry key or value.'); });
  assert.deepEqual(library.ubisoft(), []);
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { contextForLutrisGame, lutris } = require('../src/core/lutris');
const { createSetupRunner } = require('../src/core/proton');
const { assertGameClosed } = require('../src/core/install-guards');
const { spawn } = require('child_process');

function fixture(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'swapper-lutris-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const dataHome = path.join(home, 'data');
  const prefix = path.join(home, 'Wine prefix');
  const dir = path.join(prefix, 'drive_c/Program Files/Example Game/bin');
  const configs = path.join(dataHome, 'lutris/games');
  const command = path.join(dataHome, 'lutris/runtime/umu/umu-run');
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(configs, { recursive: true });
  fs.mkdirSync(path.dirname(command), { recursive: true });
  fs.writeFileSync(command, '', { mode: 0o755 });
  fs.writeFileSync(path.join(prefix, 'system.reg'), '');
  fs.writeFileSync(path.join(configs, 'battlenet.yml'), `wine:\n  prefix: ${JSON.stringify(prefix)}\n  version: ge-proton\nsystem:\n  env:\n    TEST_SETTING: preserved\n`);
  return { home, dataHome, prefix, dir, configs, command, platform: 'linux' };
}

test('Lutris maps a nested game folder to existing GE-Proton prefix and UMU', t => {
  const f = fixture(t);
  const ctx = contextForLutrisGame(f.dir, f);
  assert.equal(ctx.prefix, f.prefix);
  assert.equal(ctx.command, f.command);
  assert.equal(ctx.env.PROTONPATH, 'GE-Proton');
  assert.equal(ctx.env.TEST_SETTING, 'preserved');
  assert.equal(contextForLutrisGame(f.home, f), null);
  const escape = path.join(f.dir, 'external');
  fs.symlinkSync(f.home, escape);
  assert.equal(contextForLutrisGame(escape, f), null);
});

test('missing and conflicting Lutris runners fail instead of selecting other Wine', t => {
  const f = fixture(t);
  fs.chmodSync(f.command, 0o644);
  assert.throws(() => contextForLutrisGame(f.dir, f), /not executable/);
  fs.chmodSync(f.command, 0o755);
  fs.writeFileSync(path.join(f.configs, 'other.yml'), `wine:\n  prefix: ${JSON.stringify(f.prefix)}\n  version: ge-proton\nsystem:\n  env:\n    GAMEID: other\n`);
  assert.throws(() => contextForLutrisGame(f.dir, f), /Multiple Lutris/);
});

test('setup runner preserves arguments with spaces and uses selected prefix', async t => {
  const f = fixture(t);
  const script = path.join(f.home, 'fake setup.js');
  fs.writeFileSync(script, 'console.log(JSON.stringify({args:process.argv.slice(2), prefix:process.env.WINEPREFIX, setting:process.env.TEST_SETTING}))');
  const ctx = { ...contextForLutrisGame(f.dir, f), command: process.execPath };
  const args = [path.join(f.dir, 'Game.exe'), '--api', 'dxgi', '--headless'];
  const result = await createSetupRunner(ctx)(script, args, () => {});
  assert.equal(result.code, 0);
  assert.deepEqual(JSON.parse(result.output), { args, prefix: f.prefix, setting: 'preserved' });
});

test('Linux guard refuses a running Wine game even without Windows file locks', { skip: process.platform !== 'linux' }, async t => {
  const f = fixture(t);
  const child = spawn('/bin/bash', ['-c', 'exec -a SwapperTestGame.exe sleep 60']);
  t.after(() => child.kill());
  await new Promise(resolve => setTimeout(resolve, 100));
  await assert.rejects(assertGameClosed(f.dir, path.join(f.dir, 'SwapperTestGame.exe')), { code: 'errGameRunning' });
});

test('imports the registered directory without guessing launcher sibling games', t => {
  const f = fixture(t);
  const launcher = path.join(f.prefix, 'drive_c/Program Files/Battle.net/Battle.net Launcher.exe');
  fs.mkdirSync(path.dirname(launcher), { recursive: true });
  fs.writeFileSync(launcher, '');
  const sibling = path.join(f.prefix, 'drive_c/Program Files/World of Warcraft/_retail_');
  fs.mkdirSync(sibling, { recursive: true });
  fs.writeFileSync(path.join(sibling, 'Wow.exe'), '');
  const config = `wine:\n  prefix: ${JSON.stringify(f.prefix)}\n  version: ge-proton\ngame:\n  exe: ${JSON.stringify(launcher)}\n`;
  fs.writeFileSync(path.join(f.configs, 'battlenet.yml'), config);
  fs.writeFileSync(path.join(f.configs, 'duplicate.yml'), config);
  fs.writeFileSync(path.join(f.configs, 'broken.yml'), '[bad yaml');
  const games = lutris(f);
  assert.equal(games.length, 1);
  assert.equal(games[0].name, 'Battle.net');
  assert.equal(games[0].dir, path.dirname(launcher));
  assert.equal(games[0].winePrefix, f.prefix);
  assert.equal(lutris({ ...f, platform: 'win32' }).length, 0);
});

test('imports an external registered Windows game via Wine drive mapping and reuses its prefix', t => {
  const f = fixture(t);
  const external = path.join(f.home, 'External Games/My Game');
  fs.mkdirSync(external, { recursive: true });
  fs.writeFileSync(path.join(external, 'Game.exe'), '');
  fs.mkdirSync(path.join(f.prefix, 'dosdevices'));
  fs.symlinkSync(path.dirname(external), path.join(f.prefix, 'dosdevices/d:'));
  fs.writeFileSync(path.join(f.configs, 'battlenet.yml'), `name: My Game\nrunner: wine\nwine:\n  prefix: ${JSON.stringify(f.prefix)}\n  version: ge-proton\ngame:\n  exe: 'D:\\My Game\\Game.exe'\n`);
  assert.equal(lutris(f)[0].dir, external);
  assert.equal(contextForLutrisGame(external, f).prefix, f.prefix);
  assert.equal(contextForLutrisGame(path.dirname(external), f), null);
  fs.unlinkSync(path.join(external, 'Game.exe'));
  assert.deepEqual(lutris(f), []);
  assert.equal(contextForLutrisGame(external, f), null);
});

test('generic imports deduplicate real paths and skip non-Wine or missing executables', t => {
  const f = fixture(t);
  const exe = path.join(f.dir, 'Game.exe');
  fs.writeFileSync(exe, '');
  const alias = path.join(f.home, 'linked game');
  fs.symlinkSync(f.dir, alias);
  const config = file => `name: Example Game\nrunner: wine\nwine:\n  prefix: ${JSON.stringify(f.prefix)}\n  version: ge-proton\ngame:\n  exe: ${JSON.stringify(file)}\n`;
  fs.writeFileSync(path.join(f.configs, 'game.yml'), config(exe));
  fs.writeFileSync(path.join(f.configs, 'alias.yaml'), config(path.join(alias, 'Game.exe')));
  fs.writeFileSync(path.join(f.configs, 'missing.yml'), config(path.join(f.home, 'Missing.exe')));
  const nativeDir = path.join(f.home, 'native');
  fs.mkdirSync(nativeDir);
  const nativeExe = path.join(nativeDir, 'Native.exe');
  fs.writeFileSync(nativeExe, '');
  fs.writeFileSync(path.join(f.configs, 'native.yml'), config(nativeExe).replace('runner: wine', 'runner: linux'));
  const games = lutris(f);
  assert.equal(games.length, 1);
  assert.equal(games[0].name, 'Example Game');
  assert.equal(games[0].dir, f.dir);
  assert.equal(contextForLutrisGame(games[0].dir, f).prefix, f.prefix);
});

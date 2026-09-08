'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('node:vm');

const gameOverlay = require('../src/game-overlay');
const registerOverlayIpc = require('../src/overlay-ipc');

// With the overlay switch on and the OptiScaler route chosen, the install
// went through without a word about the overlay: the route was not in the
// supported list, so it was never even attempted, and nothing said so. People
// then looked for the panel in the game, decided the install had gone wrong,
// and reinstalled. The reason has to reach the install log.
test('an unsupported route is passed over out loud, and the reason names ReShade', () => {
  const target = { bitness: 64, api: 'dxgi', apiLabel: 'DirectX 12', path: 'C:\\Game\\Game.exe' };
  assert.deepEqual(gameOverlay.routes(target), ['native', 'feeder'], 'OptiScaler is deliberately not on the list');

  const reason = gameOverlay.unsupported(target, 'optiscaler');
  assert.match(reason, /ReShade/, 'says what actually loads the overlay');
  assert.match(reason, /OptiScaler/, 'and which route is being talked about');
  assert.match(reason, /Native DLSS|Feeder/, 'and where the overlay is available');

  const main = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
  assert.match(main, /gameOverlay\.routes\(target\)\.includes\(route\)[\s\S]{0,400}else \{[\s\S]{0,400}overlaySkipped[\s\S]{0,100}gameOverlay\.unsupported\(target, route\)/,
    'the install handler reports the skip instead of silently moving on');
});

test('prepare refuses the OptiScaler route with that same reason', () => {
  const target = { bitness: 64, api: 'dxgi', apiLabel: 'DirectX 12', path: 'C:\\Game\\Game.exe' };
  assert.throws(() => gameOverlay.prepare({ library: null, target, route: 'optiscaler' }),
    (error) => error.message === gameOverlay.unsupported(target, 'optiscaler'));
});

// "Developer files" opened <app>/overlay, which installed is a folder inside
// app.asar. Explorer cannot open a path inside an archive and said so:
// "Windows cannot find ...\resources\app.asar\overlay".
test('Developer files opens the built add-on folder when installed, never a path inside app.asar', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'overlay-source-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const resources = path.join(root, 'resources');
  fs.mkdirSync(path.join(resources, 'overlay'), { recursive: true });

  const previous = process.resourcesPath;
  process.resourcesPath = resources;
  t.after(() => { process.resourcesPath = previous; });

  const handlers = new Map();
  const opened = [];
  registerOverlayIpc({
    app: { isPackaged: true, getPath: () => path.join(root, 'userData') },
    ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
    dialog: {}, window: () => null,
    shell: { openPath: async (dir) => { opened.push(dir); return ''; }, openExternal: async () => {} }
  });

  const result = await handlers.get('overlay-source')();
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(opened, [path.join(resources, 'overlay')]);
  assert.ok(!opened[0].includes('app.asar'));
});

test('with no add-on folder at all, Developer files goes to the sources online', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'overlay-source-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const previous = process.resourcesPath;
  process.resourcesPath = path.join(root, 'resources');
  t.after(() => { process.resourcesPath = previous; });

  const handlers = new Map();
  const opened = [], external = [];
  registerOverlayIpc({
    app: { isPackaged: true, getPath: () => path.join(root, 'userData') },
    ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
    dialog: {}, window: () => null,
    shell: { openPath: async (dir) => { opened.push(dir); return ''; }, openExternal: async (url) => { external.push(url); } }
  });

  const result = await handlers.get('overlay-source')();
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(opened, []);
  assert.match(external[0], /^https:\/\/github\.com\/rakanki911\/DLSS5-Swapper\/tree\/main\/overlay$/);
});

// The install log ended on "done - 0 replaced, 19 added" and the button went
// back to "Install": a tally, not a verdict. Say it worked, in the person's
// language, and with the right name for what was installed.
test('a finished install is announced in words, for both routes', () => {
  const context = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/renderer/i18n.js'), 'utf8'), context, { filename: 'i18n.js' });
  const ui = context.window.i18n;

  for (const lang of ['en', 'fr', 'ar']) {
    ui.setLang(lang);
    for (const what of ['OptiScaler DLSS-NR', 'DLSS 5']) {
      const line = ui.t('installDone', what);
      assert.ok(line.includes(what), `${lang}: names what was installed`);
      assert.ok(!line.includes('undefined'), `${lang}: no placeholder left unfilled`);
    }
    assert.notEqual(ui.t('restoreDone'), 'restoreDone', `${lang}: restore has its line too`);
    assert.notEqual(ui.t('fNeural'), 'fNeural', `${lang}: the model row has a label`);
  }
  // A language without its own line falls back to English rather than a code.
  ui.setLang('de');
  assert.match(ui.t('installDone', 'DLSS 5'), /DLSS 5 is installed/);

  const renderer = fs.readFileSync(path.join(__dirname, '../src/renderer/renderer.js'), 'utf8');
  assert.match(renderer, /t\('installDone', route === 'optiscaler' \? 'OptiScaler DLSS-NR' : 'DLSS 5'\)/);
  assert.match(renderer, /t\('restoreDone'\)/);
});

// Once the route on screen is in the game and whole, the install button is
// disabled and says so: a second click could add nothing, and people were
// clicking twice to be sure. A broken install keeps the button.
test('a whole install disables the button and names itself; a broken one keeps it', () => {
  const context = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/renderer/i18n.js'), 'utf8'), context, { filename: 'i18n.js' });
  const ui = context.window.i18n;
  for (const lang of ['en', 'fr', 'ar']) {
    ui.setLang(lang);
    const line = ui.t('alreadyInstalled', 'OptiScaler DLSS-NR');
    assert.ok(line.includes('OptiScaler DLSS-NR') && !line.includes('undefined'), `${lang}: ${line}`);
  }

  const renderer = fs.readFileSync(path.join(__dirname, '../src/renderer/renderer.js'), 'utf8');
  assert.match(renderer, /id="doInstall"\$\{[^}]*!installedHere\(d, pick, dir\)\?\.whole/,
    'the button is disabled by the same judgement that labels it');
  assert.match(renderer, /route === 'optiscaler'\s*\?\s*Boolean\(d\.optiscaler && d\.optiscaler\.installed\)/,
    'an OptiScaler install is whole only when the scanner says its hook and files are there');
  assert.match(renderer, /d\.reshade && d\.reshade\.installed && d\.addon/,
    'a ReShade install is whole only with ReShade and the add-on both present');
});

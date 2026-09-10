'use strict';
// #255: closing the window should park the app in the tray rather than end it,
// because people close windows out of habit and then wonder why the overlay
// stopped answering in the game they are still playing. On by default, and
// switchable off - which is what these tests hold in place.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

function load(root) {
  const main = path.resolve(__dirname, '../main.js');
  const realRequire = createRequire(main);
  const handlers = new Map();
  const windowEvents = new Map();
  const appEvents = new Map();
  const built = [];
  const win = {
    on: (name, fn) => windowEvents.set(name, fn),
    once() {}, loadFile() {}, show() {}, focus() {}, restore() {},
    isMinimized: () => false, isDestroyed: () => false, hide() { win.hidden = true; },
    hidden: false, webContents: { on() {}, send() {} }
  };
  const tray = {
    made: 0, destroyed: false, tip: null,
    setContextMenu: (menu) => built.push(menu), setToolTip(v) { tray.tip = v; },
    on() {}, isDestroyed: () => tray.destroyed
  };
  const stubs = {
    electron: {
      app: { setAppUserModelId() {}, whenReady: () => ({ then() {} }), on: (n, fn) => appEvents.set(n, fn),
        getPath: () => root, requestSingleInstanceLock: () => true, quit() {} },
      ipcMain: { handle: (name, fn) => handlers.set(name, fn), on() {} },
      BrowserWindow: function () { tray.madeWindow = true; return win; },
      Tray: function () { tray.made += 1; return tray; },
      Menu: { buildFromTemplate: (template) => template },
      nativeImage: { createFromPath: () => ({ isEmpty: () => false, resize: () => 'icon' }) },
      shell: {}, dialog: {}, clipboard: {}, Notification: function () {}, safeStorage: {}
    }
  };
  const context = vm.createContext({ require: (name) => stubs[name] || realRequire(name),
    __dirname: path.dirname(main), process, Buffer, console, setTimeout, setInterval, clearInterval });
  vm.runInContext(fs.readFileSync(main, 'utf8'), context, { filename: main });
  // createWindow is only called from whenReady, which the stub never resolves.
  vm.runInContext('createWindow();', context);
  return { handlers, windowEvents, win, tray, built, context };
}

test('closing the window hides it to the tray by default, and Quit is the only way out', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swapper-tray-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const app = load(root);

  assert.equal(await app.handlers.get('settings')().closeToTray, true, 'on for a fresh install');

  let prevented = false;
  app.windowEvents.get('close')({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true, 'the close is intercepted');
  assert.equal(app.win.hidden, true, 'and the window goes to the tray instead');
  assert.equal(app.tray.made, 1, 'one tray icon, created on demand');

  const menu = app.built.at(-1);
  assert.equal(menu.length, 3, 'Open, a separator, Quit');
  assert.equal(menu[0].label, 'Open DLSS 5 Swapper');
  assert.equal(menu[2].label, 'Quit');

  // Quit sets the flag the close handler reads, so the next close is real.
  menu[2].click();
  app.win.hidden = false;
  let preventedAfterQuit = false;
  app.windowEvents.get('close')({ preventDefault: () => { preventedAfterQuit = true; } });
  assert.equal(preventedAfterQuit, false, 'quitting closes for real');
  assert.equal(app.win.hidden, false);
});

test('turning the setting off restores an ordinary close, and it survives a restart', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swapper-tray-off-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const app = load(root);

  assert.equal(await app.handlers.get('set-close-to-tray')({}, false), false);
  let prevented = false;
  app.windowEvents.get('close')({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, false, 'the window closes the way it always did');
  assert.equal(app.win.hidden, false);

  // A second launch reads the same library.json.
  const again = load(root);
  assert.equal(await again.handlers.get('settings')().closeToTray, false, 'the choice persists');
  assert.equal(await again.handlers.get('set-close-to-tray')({}, true), true, 'and can be turned back on');
});

test('the tray menu speaks whatever language the renderer is showing', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swapper-tray-lang-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const app = load(root);
  app.windowEvents.get('close')({ preventDefault() {} });

  await app.handlers.get('set-tray-labels')({}, { show: 'فتح DLSS 5 Swapper', quit: 'إنهاء' });
  const menu = app.built.at(-1);
  assert.equal(menu[0].label, 'فتح DLSS 5 Swapper');
  assert.equal(menu[2].label, 'إنهاء');

  // Nonsense from the renderer must not empty the menu.
  await app.handlers.get('set-tray-labels')({}, { show: 7 });
  assert.equal(app.built.at(-1)[0].label, 'فتح DLSS 5 Swapper', 'the last good labels stand');
});

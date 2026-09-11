'use strict';
// #229, #258, #104: the app already knew the driver could not run the neural
// pass and said so - in one line of an install log, followed by fifty lines
// saying "added" and "done". Three people lost days to it. It is a question
// now, asked once per driver version, and it never refuses the install.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

function load(root, rows) {
  const main = path.resolve(__dirname, '../main.js');
  const realRequire = createRequire(main);
  const handlers = new Map();
  const stubs = {
    electron: {
      app: { setAppUserModelId() {}, whenReady: () => ({ then() {} }), on() {}, getPath: () => root,
        requestSingleInstanceLock: () => true, quit() {} },
      ipcMain: { handle: (name, fn) => handlers.set(name, fn), on() {} },
      BrowserWindow: function () { return { on() {}, once() {}, loadFile() {}, webContents: { on() {}, send() {} } }; },
      Tray: function () { return { setContextMenu() {}, setToolTip() {}, on() {}, isDestroyed: () => false }; },
      Menu: { buildFromTemplate: (t) => t }, nativeImage: { createFromPath: () => ({ isEmpty: () => true }) },
      shell: {}, dialog: {}, clipboard: {}, Notification: function () {}, safeStorage: {}
    },
    './src/core/install-guards': {
      gpuInfo: async () => rows,
      driverNeuralFault: (r) => (r || []).some((x) => [61664, 61686].includes(Number(String(x.driver).split('.')[0]) * 100 + Number(String(x.driver).split('.')[1]))),
      driverNames: (r) => (r || []).map((x) => `${x.name} - ${x.driver}`).join(', '),
      assertGameClosed: async () => {}
    }
  };
  const context = vm.createContext({ require: (n) => stubs[n] || realRequire(n),
    __dirname: path.dirname(main), process, Buffer, console, setTimeout, setInterval, clearInterval });
  vm.runInContext(fs.readFileSync(main, 'utf8'), context, { filename: main });
  return handlers;
}

const temp = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swapper-driver-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};

test('a faulting driver is reported once, then remembered', async (t) => {
  const root = temp(t);
  const rows = [{ name: 'NVIDIA GeForce RTX 4090', driver: '616.86' }];
  const app = load(root, rows);

  const first = await app.handlers?.get?.('driver-neural-fault')() ?? await app.get('driver-neural-fault')();
  assert.equal(first.fault, true);
  assert.equal(first.acknowledged, false, 'asked the first time');
  assert.equal(first.names, 'NVIDIA GeForce RTX 4090 - 616.86', 'and it names the actual driver');

  await app.get('acknowledge-driver')({}, first.names);
  assert.equal((await app.get('driver-neural-fault')()).acknowledged, true, 'not asked again');

  // A different measured driver is a different answer.
  rows[0].driver = '616.64';
  const changed = await app.get('driver-neural-fault')();
  assert.equal(changed.fault, true);
  assert.equal(changed.acknowledged, false, 'a driver change asks again');
});

test('the good driver is never asked about, and neither is a machine with no NVIDIA tool', async (t) => {
  const good = load(temp(t), [{ name: 'NVIDIA GeForce RTX 5090', driver: '616.56' }]);
  assert.equal((await good.get('driver-neural-fault')()).fault, false, '616.56 completes, so nothing to say');

  const untested = load(temp(t), [{ name: 'NVIDIA GeForce RTX 5060 Ti', driver: '616.92' }]);
  assert.equal((await untested.get('driver-neural-fault')()).fault, false, 'an untested newer driver is not called broken');

  const none = load(temp(t), null);
  assert.equal((await none.get('driver-neural-fault')()).fault, false, 'no nvidia-smi is not a warning');
});

test('the acknowledgement list cannot grow without bound', async (t) => {
  const root = temp(t);
  const app = load(root, [{ name: 'NVIDIA GeForce RTX 4090', driver: '616.86' }]);
  for (let i = 0; i < 20; ++i) await app.get('acknowledge-driver')({}, `driver ${i}`);
  const state = JSON.parse(fs.readFileSync(path.join(root, 'library.json'), 'utf8'));
  assert.equal(state.driverAcknowledged.length, 8, 'the last eight, not every driver ever seen');
  assert.equal(state.driverAcknowledged.at(-1), 'driver 19');
});

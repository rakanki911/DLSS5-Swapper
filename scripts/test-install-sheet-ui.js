'use strict';

// Run with npm run test:sheet. Opens the real window against the fixture
// bridge and checks what the install sheet offers and what it sends. No real
// library, no game files, no network.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-sheet-ui-')));
const timeout = setTimeout(() => { console.error('UI test timed out'); app.exit(1); }, 60000);

const DX12 = { bitness: 64, api: 'dxgi', apiLabel: 'DirectX 12', hasNativeDlss: true };
const NO_DLSS = { bitness: 64, api: 'dxgi', apiLabel: 'DirectX 12', hasNativeDlss: false };
const DX9 = { bitness: 64, api: 'd3d9', apiLabel: 'DirectX 9' };

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false, width: 1280, height: 900,
    webPreferences: {
      preload: path.join(__dirname, '../test/fixtures/game-filters-preload.js'),
      contextIsolation: true, nodeIntegration: false, backgroundThrottling: false
    }
  });
  const errors = [];
  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 3) { errors.push(message); console.error('[renderer]', message); }
  });
  await win.loadFile(path.join(__dirname, '../src/renderer/index.html'));
  const run = (code) => win.webContents.executeJavaScript(code);
  const settle = (condition) => run(`new Promise(resolve => {
    const check = () => (${condition}) ? resolve() : setTimeout(check, 10);
    check();
  })`);
  await settle(`state.games.length === 9 && $('statusText').textContent === t('ready')`);
  const options = (details, pick, dir) =>
    run(`installOptions(${JSON.stringify(details)}, ${JSON.stringify(pick)}, ${JSON.stringify(dir)})`);

  // The route belongs to a DirectX 12 game with DLSS of its own, and nowhere
  // else. A game reached through the Feeder renders at native, so there is no
  // upscale for the neural pass to run ahead of and offering it would be a lie.
  const native = await options({ recommendedRoute: 'native' }, DX12, 'DX12');
  assert.match(native, /value="preupscale"/, 'the route is offered');
  assert.doesNotMatch(native, /value="preupscale" selected/, 'and is not the default');
  assert.doesNotMatch(await options({ recommendedRoute: 'feeder' }, NO_DLSS, 'NoDlss'), /value="preupscale"/);
  assert.doesNotMatch(await options({ recommendedRoute: 'feeder' }, DX9, 'DX9'), /value="preupscale"/);
  assert.doesNotMatch(await options({}, null, 'NoExecutable'), /value="preupscale"/);

  // Its name says which one it is next to the three that were already there.
  const label = await run(`t('routePreUpscale')`);
  assert.match(label, /before the upscale/i);
  assert.ok(native.includes(label));

  // Choosing it shows the hint, and the hint carries the part that stops
  // someone concluding the whole idea does nothing.
  const chosen = await options({ recommendedRoute: 'preupscale' }, DX12, 'Chosen');
  assert.match(chosen, /value="preupscale" selected/);
  assert.ok(chosen.includes(await run(`t('routePreUpscaleHint')`)), 'the sheet explains when it saves nothing');
  assert.match(await run(`t('routePreUpscaleHint')`), /DLAA/);

  // And the route reaches the installer rather than stopping at the control.
  const dir = await run(`state.games[0].dir`);
  await run(`openSheet(${JSON.stringify(dir)})`);
  await settle(`Boolean($('routeChoice'))`);
  assert.match(await run(`$('routeChoice').innerHTML`), /value="preupscale"/);

  await run(`$('routeChoice').value = 'preupscale'; $('routeChoice').dispatchEvent(new Event('change'));`);
  await settle(`$('routeChoice') && $('routeChoice').value === 'preupscale'`);
  await run(`$('doInstall').click()`);
  await settle(`window.lab.testInstallCalls().length > 0`);

  assert.equal((await run(`window.lab.testInstallCalls().at(-1)`)).route, 'preupscale',
    'the sheet sends the chosen route to the installer');

  assert.deepEqual(errors, []);
  clearTimeout(timeout);
  console.log('install sheet UI checks passed');
  app.exit(0);
}).catch((error) => { console.error(error); app.exit(1); });

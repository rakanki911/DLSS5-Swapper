'use strict';
// Diagnostic: mirrors src/overlay-bridge.js exactly, including the `ready` gate,
// so the frames it reports are the frames the app would actually transmit.
// Paints before `ready` are ignored by the app and are shown only for contrast.
//
//   npx electron scripts/probe-overlay-surface.js
const { app, BrowserWindow, screen } = require('electron');
const path = require('path');
const protocol = require('../src/overlay-protocol');
const root = path.join(__dirname, '..');

app.whenReady().then(async () => {
  console.log('--- display ---');
  for (const d of screen.getAllDisplays())
    console.log(`  ${d.size.width}x${d.size.height} scaleFactor=${d.scaleFactor}` +
                (d.scaleFactor !== 1 ? '   <-- not 100%' : ''));

  const win = new BrowserWindow({ show: false, width: protocol.WIDTH, height: 900, transparent: true, frame: false,
    webPreferences: { preload: path.join(root, 'overlay-preload.js'), offscreen: true, contextIsolation: true,
                      sandbox: true, nodeIntegration: false, backgroundThrottling: false, spellcheck: false } });

  let ready = false, pre = 0, post = 0;
  win.webContents.on('paint', (_e, _d, image) => {
    const { width, height } = image.getSize();
    if (!ready) {
      if (++pre === 1) console.log(`--- pre-ready paint (app ignores these): ${width}x${height} ---`);
      return;
    }
    if (++post > 2) return;
    const bytes = image.toBitmap().length;
    console.log(`--- POST-READY paint #${post}  (these are the real frames) ---`);
    console.log(`  getSize : ${width} x ${height}`);
    console.log(`  bitmap  : ${bytes} bytes (w*h*4 = ${width * height * 4})`);
    console.log(`  width == ${protocol.WIDTH} ? ${width === protocol.WIDTH ? 'OK - emulation fixed it' : 'MISMATCH - app drops this frame'}`);

    if (post === 1) {
      // Does a straight resample give the bridge something it will accept?
      try {
        const target = Math.round(height * protocol.WIDTH / width);
        const scaled = image.resize({ width: protocol.WIDTH, height: target, quality: 'good' });
        const s = scaled.getSize(), sb = scaled.toBitmap().length;
        console.log(`--- resize() test ---`);
        console.log(`  asked for ${protocol.WIDTH}x${target} -> got ${s.width}x${s.height}, ${sb} bytes (w*h*4 = ${s.width * s.height * 4})`);
        console.log(`  usable as a fix ? ${s.width === protocol.WIDTH && sb === s.width * s.height * 4 ? 'YES' : 'NO'}`);
      } catch (e) { console.log('  resize() threw:', e.message); }
    }
    if (post === 2) app.exit(0);
  });

  win.webContents.setFrameRate(30);
  await win.loadFile(path.join(root, 'src/renderer/overlay-panel.html'));
  const height = Math.ceil(await win.webContents.executeJavaScript(
    `document.querySelector('#panel').getBoundingClientRect().height`));
  console.log(`--- panel CSS height: ${height} ---`);
  win.setContentSize(protocol.WIDTH, height);
  win.webContents.enableDeviceEmulation({ screenPosition: 'desktop', screenSize: { width: protocol.WIDTH, height },
    deviceScaleFactor: 1, viewSize: { width: protocol.WIDTH, height }, viewPosition: { x: 0, y: 0 }, scale: 1 });
  ready = true;
  win.webContents.invalidate();

  setTimeout(() => {
    console.log(post ? '' : '\nRESULT: no post-ready paints in 12s - emulation may have stopped repaints entirely.');
    app.exit(post ? 0 : 2);
  }, 12000);
});

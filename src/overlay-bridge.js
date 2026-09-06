'use strict';
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const protocol = require('./overlay-protocol');
const preferences=require('./overlay-preferences');
const { ipcMain } = require('electron');

module.exports = async function startOverlayBridge({ BrowserWindow, userData }) {
  const token = crypto.randomBytes(16).toString('hex');
  const endpoint = path.join(userData, 'overlay-bridge.endpoint');
  // The add-on composes the same name from LAB_OVERLAY_PROFILE (see
  // overlay/overlay.cpp). Both sides must spell the app's data folder the
  // same way or the overlay loads in the game and waits for a pipe forever.
  const profile = path.basename(userData);
  const pipeName = `\\\\.\\pipe\\${profile}-overlay-${token}`;
  let latest = null, sequence = 0, client = null, closed = false, ready = false;
  // CSS height of the panel, and the height every transmitted frame carries, so
  // the add-on's pointer coordinates map 1:1 onto the offscreen window.
  let panelHeight = 0;
  let server = null;
  let runtimeStatus = null, commandTime = 0, commandCount = 0;
  const win = new BrowserWindow({ show: false, width: protocol.WIDTH, height: 900, transparent: true, frame: false,
    webPreferences: { preload: path.join(__dirname, '../overlay-preload.js'), offscreen: true, contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false, spellcheck: false } });
  const preferenceChanged=(dir,value)=>{if(dir===userData&&!closed&&!win.isDestroyed())win.webContents.send('lab-overlay-preferences',value);};
  const control = (event, command) => {
    if (closed || !client || event.sender !== win.webContents) return;
    if (Date.now() - commandTime > 1000) { commandTime = Date.now(); commandCount = 0; }
    if (++commandCount > 240) return;
    try { client.write(protocol.command(runtimeStatus, command)); } catch(error) { console.warn('Lab overlay command rejected:',error.message); }
  };
  ipcMain.on('lab-overlay-control', control);
  const resize = (event, height) => {
    if (closed || event.sender !== win.webContents || !Number.isInteger(height) || height < 200 || height > protocol.MAX_HEIGHT) return;
    panelHeight = height;
    win.setContentSize(protocol.WIDTH, height);
    win.webContents.enableDeviceEmulation({ screenPosition: 'desktop', screenSize: { width: protocol.WIDTH, height }, deviceScaleFactor: 1, viewSize: { width: protocol.WIDTH, height }, viewPosition: { x: 0, y: 0 }, scale: 1 });
    win.webContents.invalidate();
  };
  ipcMain.on('lab-overlay-resize', resize);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.setFrameRate(30);
  function sendLatest() {
    if (!client || client.destroyed || client.inFlight || !latest) return;
    client.inFlight = true;
    client.sequence = latest.readUInt32LE(8);
    client.write(latest);
  }
  // Chromium renders the offscreen panel at the display's device pixel ratio.
  // enableDeviceEmulation fixes the CSS layout but NOT the surface it hands back,
  // so on a scaled desktop (125%, 150%, ...) every frame arrives wider than the
  // fixed transport width and used to be discarded in silence: the add-on then
  // connected and waited forever on its "shared panel design" message. Resample
  // back to the transport size instead, and keep the panel's CSS height as the
  // target so pointer coordinates still map 1:1.
  function box(src, sw, sh, dw, dh) {
    if (src.length !== sw * sh * 4) return null;
    const out = Buffer.allocUnsafe(dw * dh * 4), xr = sw / dw, yr = sh / dh;
    for (let y = 0; y < dh; ++y) {
      const y0 = Math.floor(y * yr), y1 = Math.min(sh, Math.max(y0 + 1, Math.ceil((y + 1) * yr)));
      for (let x = 0; x < dw; ++x) {
        const x0 = Math.floor(x * xr), x1 = Math.min(sw, Math.max(x0 + 1, Math.ceil((x + 1) * xr)));
        let b = 0, g = 0, r = 0, a = 0, n = 0;
        for (let sy = y0; sy < y1; ++sy) {
          let i = (sy * sw + x0) * 4;
          for (let sx = x0; sx < x1; ++sx, i += 4) { b += src[i]; g += src[i + 1]; r += src[i + 2]; a += src[i + 3]; ++n; }
        }
        // Averaging premultiplied BGRA is correct; protocol.frame un-multiplies.
        const o = (y * dw + x) * 4;
        out[o] = (b / n + 0.5) | 0; out[o + 1] = (g / n + 0.5) | 0;
        out[o + 2] = (r / n + 0.5) | 0; out[o + 3] = (a / n + 0.5) | 0;
      }
    }
    return out;
  }
  let paintWarned = false;
  const refuse = message => { if (!paintWarned) { paintWarned = true; console.error('Lab overlay: dropping panel frames. ' + message); } };
  function surfaceBitmap(image) {
    const { width, height } = image.getSize();
    if (!width || !height) return null;                       // transient empty frame
    const target = panelHeight || Math.round(height * protocol.WIDTH / width);
    if (target < 1 || target > protocol.MAX_HEIGHT) { refuse(`Panel height ${target} is outside the transport range.`); return null; }
    if (width === protocol.WIDTH && height === target) {
      const bitmap = image.toBitmap();
      if (bitmap.length === width * height * 4) return { bitmap, height: target };
    }
    // Chromium's own resampler first; it is not obliged to honour the request.
    const scaled = image.resize({ width: protocol.WIDTH, height: target, quality: 'good' });
    const size = scaled.getSize(), bitmap = scaled.toBitmap();
    if (size.width === protocol.WIDTH && size.height === target && bitmap.length === protocol.WIDTH * target * 4)
      return { bitmap, height: target };
    const boxed = box(image.toBitmap(), width, height, protocol.WIDTH, target);
    if (boxed) return { bitmap: boxed, height: target };
    refuse(`Offscreen surface ${width}x${height} could not be resampled to ${protocol.WIDTH}x${target}.`);
    return null;
  }
  win.webContents.on('paint', (_event, _dirty, image) => {
    if (!ready || closed) return;
    const surface = surfaceBitmap(image);
    if (!surface) return;
    try { latest = protocol.frame(surface.bitmap, protocol.WIDTH, surface.height, ++sequence); }
    catch (error) { return refuse(error.message); }
    paintWarned = false;
    sendLatest();
  });
  function close() {
    if (closed) return; closed = true;
    preferences.events.removeListener('change',preferenceChanged);
    client?.destroy(); server?.close();
    ipcMain.removeListener('lab-overlay-control', control);
    ipcMain.removeListener('lab-overlay-resize', resize);
    if (!win.isDestroyed()) win.destroy();
    try { if (fs.readFileSync(endpoint, 'utf8') === token) fs.unlinkSync(endpoint); } catch {}
  }
  win.webContents.on('render-process-gone', (_event, details) => { console.error('Lab overlay renderer stopped:', details.reason); close(); });
  win.on('closed', close);
  try {
  await win.loadFile(path.join(__dirname, 'renderer/overlay-panel.html'));
  win.webContents.send('lab-overlay-preferences',preferences.read(userData));
  preferences.events.on('change',preferenceChanged);
  const height = Math.ceil(await win.webContents.executeJavaScript(`document.querySelector('#panel').getBoundingClientRect().height`));
  if (height < 1 || height > protocol.MAX_HEIGHT) { win.destroy(); throw Error('Overlay panel height exceeds its bounded surface'); }
  panelHeight = height;
  win.setContentSize(protocol.WIDTH, height);
  // Fixed CSS pixels regardless of desktop DPI. No scaling/reflow in the native UI.
  win.webContents.enableDeviceEmulation({ screenPosition: 'desktop', screenSize: { width: protocol.WIDTH, height }, deviceScaleFactor: 1, viewSize: { width: protocol.WIDTH, height }, viewPosition: { x: 0, y: 0 }, scale: 1 });
  ready = true;
  win.webContents.invalidate();
  server = net.createServer(socket => {
    // One test game at a time: a second process must not alter its controls.
    if (client) { socket.destroy(); return; }
    client = socket;
    let pending = Buffer.alloc(0), lastInput = Date.now(), count = 0, mouseDown = false;
    socket.on('error', () => {});
    socket.on('close', () => {
      if (client !== socket) return;
      client = null; runtimeStatus = null;
      if (!win.isDestroyed()) {
        win.webContents.sendInputEvent({ type: 'mouseUp', x: -1, y: -1, button: 'left', clickCount: 1 });
        win.webContents.send('lab-overlay-status', null);
      }
    });
    socket.on('data', data => {
      try {
        if (pending.length + data.length > 128000) throw Error('Input limit');
        pending = Buffer.concat([pending, data]);
        while (pending.length >= 8) {
          if (pending.readUInt32LE(0) === 0x31534c44) {
            const length = pending.readUInt32LE(4);
            if (length > 60000) throw Error('Status limit');
            if (pending.length < 8 + length) break;
            runtimeStatus = protocol.status(JSON.parse(pending.toString('utf8', 8, 8 + length)));
            pending = pending.subarray(8 + length);
            win.webContents.send('lab-overlay-status', runtimeStatus);
            continue;
          }
          if (pending.length < 20) break;
          if (Date.now() - lastInput > 1000) { lastInput = Date.now(); count = 0; }
          if (++count > 500) throw Error('Input rate limit');
          const e = protocol.input(pending.subarray(0, 20)); pending = pending.subarray(20);
          if (e.action === 0) {
            if ([protocol.HELLO_VALUE, protocol.PREVIOUS_HELLO_VALUE, protocol.OLD_HELLO_VALUE, protocol.LEGACY_HELLO_VALUE].includes(e.value) && e.x === 0 && e.y === 0) {
              if (!socket.negotiated) { socket.negotiated = true; socket.write(protocol.helloReply(e.value)); }
              continue;
            }
            if ((e.value >>> 0) === socket.sequence) { socket.inFlight = false; if (latest.readUInt32LE(8) !== socket.sequence) sendLatest(); }
            continue;
          }
          if (e.action === 2) mouseDown = true;
          if (e.action === 3 || e.action === 6) mouseDown = false;
          if (e.action === 6) { win.webContents.sendInputEvent({ type: 'mouseUp', x: -1, y: -1, button: 'left', clickCount: 1 }); continue; }
          if (e.action <= 3) win.webContents.sendInputEvent({ type: ['', 'mouseMove', 'mouseDown', 'mouseUp'][e.action], x: e.x, y: e.y, button: 'left', modifiers: mouseDown ? ['leftButtonDown'] : [], clickCount: e.action === 1 ? 0 : 1 });
          if (e.action === 4) win.webContents.sendInputEvent({ type: 'mouseWheel', x: e.x, y: e.y, deltaY: e.value, deltaX: 0 });
          if (e.action === 5) {
            const keyCode = ['Tab', 'Left', 'Right', 'Up', 'Down', 'Space', 'Return', 'Tab', 'Backspace', 'Delete', 'A', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '-'][e.value];
            const modifiers = e.value === 7 ? ['shift'] : e.value === 10 ? ['control'] : [];
            win.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
            if (e.value >= 11) win.webContents.sendInputEvent({ type: 'char', keyCode });
            win.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
          }
        }
      } catch (error) { console.error('Lab overlay connection rejected:', error.message); socket.destroy(); }
    });
    sendLatest();
    win.webContents.invalidate();
  });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(pipeName, resolve); });
    server.on('error', error => { console.error('Lab overlay transport:', error.message); close(); });
    fs.mkdirSync(userData, { recursive: true });
    fs.writeFileSync(endpoint, token, { mode: 0o600 });
  } catch (error) { close(); throw error; }
  return { window: win, endpoint, pipeName, getFrame: () => latest, getStatus:()=>runtimeStatus, close };
};

'use strict';
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const protocol = require('./overlay-protocol');
const preferences=require('./overlay-preferences');
const { ipcMain } = require('electron');

module.exports = async function startOverlayBridge({ BrowserWindow, userData, idleTakeoverMs = 5000 }) {
  const token = crypto.randomBytes(16).toString('hex');
  const endpoint = path.join(userData, 'overlay-bridge.endpoint');
  // The add-on composes the same name from LAB_OVERLAY_PROFILE (see
  // overlay/overlay.cpp). Both sides must spell the app's data folder the
  // same way or the overlay loads in the game and waits for a pipe forever.
  const profile = path.basename(userData);
  const pipeName = `\\\\.\\pipe\\${profile}-overlay-${token}`;
  let latest = null, sequence = 0, client = null, closed = false, ready = false;
  // What the panel is in CSS pixels, which is what the add-on expects to be
  // handed regardless of what the desktop's scaling makes of it.
  let panelHeight = 900;
  // How long an unreachable game may hold the single connection.
  const IDLE_TAKEOVER_MS = idleTakeoverMs;
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
  // The panel is a fixed 534-pixel surface on the other side of the pipe, but
  // an offscreen window paints at the display's scale factor: measured here,
  // a 534x320 panel comes back as 804x480 on a 150% display. Every one of
  // those frames used to be dropped by the size check, so nothing ever
  // reached the game and the add-on waited for a design that never arrived -
  // on any scaled display, which is most of them.
  win.webContents.on('paint', (_event, _dirty, image) => {
    if (!ready || closed) return;
    const painted = image.getSize();
    if (!painted.width || !painted.height) return;
    // Resized to the panel's own height rather than by aspect ratio, so a
    // rounded scale cannot drift a row per frame.
    const frame = painted.width === protocol.WIDTH ? image
      : image.resize({ width: protocol.WIDTH, height: panelHeight, quality: 'good' });
    const { width, height } = frame.getSize();
    if (width !== protocol.WIDTH || height < 1 || height > protocol.MAX_HEIGHT) return;
    const bitmap = frame.toBitmap();
    // A bitmap that is not exactly the size it claims would be refused by the
    // add-on and drop the connection; skip the frame instead.
    if (bitmap.length !== width * height * 4) return;
    latest = protocol.frame(bitmap, width, height, ++sequence);
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
    // But a game that crashed or was killed can leave its end of the pipe open
    // with nobody behind it, and every game after that was refused and left
    // waiting for a panel that would never arrive. A live add-on acknowledges
    // every frame, so silence this long means the other end is gone.
    if (client) {
      if (Date.now() - (client.lastSeen || 0) < IDLE_TAKEOVER_MS) { socket.destroy(); return; }
      const abandoned = client;
      client = null;
      abandoned.destroy();
    }
    client = socket;
    socket.lastSeen = Date.now();
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
      socket.lastSeen = Date.now();
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
  // What the Overlay page shows instead of leaving someone to guess why the
  // panel in the game says it is still waiting.
  const state = () => ({
    listening: Boolean(server && server.listening) && !closed,
    connected: Boolean(client) && !closed,
    game: Boolean(runtimeStatus),
    endpoint,
    pipeName
  });
  return { window: win, endpoint, pipeName, state, getFrame: () => latest, getStatus:()=>runtimeStatus, close };
};

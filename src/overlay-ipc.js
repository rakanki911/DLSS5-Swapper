'use strict';
const path = require('node:path');
const { createOverlayLibrary } = require('./overlays');

module.exports = function registerOverlayIpc({ app, ipcMain, dialog, shell, window, bridge = () => null }) {
  const appRoot = path.resolve(__dirname, '..');
  // Installed, the built add-on rides along as an extra resource; from source it
  // is whatever scripts/build-overlay.ps1 last produced.
  const builtin = () => (app.isPackaged
    ? path.join(process.resourcesPath, 'overlay', 'dlss5-lab-overlay.addon64')
    : path.join(appRoot, 'dist/overlay/dlss5-lab-overlay.addon64'));
  // Never let an overlay be installed over the app's own directory.
  const forbidden = () => [appRoot, app.isPackaged ? path.dirname(app.getPath('exe')) : appRoot];
  const library = () => createOverlayLibrary(path.join(app.getPath('userData'), 'overlay-library'),
    builtin(), forbidden());
  const handle = (name, fn) => ipcMain.handle(`overlay-${name}`, async (_event, ...args) => {
    try { return { ok: true, value: await fn(...args) }; }
    catch (error) { return { ok: false, error: error.message }; }
  });
  handle('list', () => library().list());
  // What the panel in the game is waiting for, said on the Overlay page:
  // whether the service is up at all, and whether a game is attached.
  handle('bridge', () => {
    const live = bridge();
    const state = live ? live.state() : { listening: false, connected: false, game: false };
    // The service can be listening perfectly while the add-on the game has to
    // load is not there at all - antivirus takes it, and nothing said so.
    // resolve() hashes the file, so a truncated or gutted one throws rather
    // than reporting itself absent. Either way the game cannot load it.
    let addon = false, addonFile = null;
    try { const entry = library().resolve('builtin'); addon = Boolean(entry.ready); addonFile = entry.file; }
    catch { addon = false; }
    return { ...state, addon, addonFile };
  });
  handle('preferences',()=>require('./overlay-preferences').read(app.getPath('userData')));
  handle('save-preferences',patch=>require('./overlay-preferences').save(app.getPath('userData'),patch));
  handle('add', async () => {
    const picked = await dialog.showOpenDialog(window(), { title: 'Add a custom ReShade overlay', properties: ['openFile'], filters: [{ name: 'ReShade native add-ons', extensions: ['addon64', 'addon32'] }] });
    if (picked.canceled) return null;
    const confirm = await dialog.showMessageBox(window(), { type: 'warning', title: 'Native add-on — trusted developers only',
      message: 'This file contains native code. A ReShade add-on can access your files when loaded by a game.',
      detail: 'Adding it here only stores a copy; it is not executed here. A checksum does not certify that the file is safe.',
      buttons: ['Cancel', 'Add trusted file'], defaultId: 0, cancelId: 0 });
    return confirm.response === 1 ? library().add(picked.filePaths[0]) : null;
  });
  handle('remove', async id => {
    const entry = library().resolve(id);
    if (entry.builtin) throw Error('The built-in overlay cannot be deleted.');
    const confirm = await dialog.showMessageBox(window(), { type: 'question', message: `Remove ${entry.name}?`, detail: 'Your original imported file is kept.', buttons: ['Cancel', 'Remove'], defaultId: 0, cancelId: 0 });
    if (confirm.response === 1) library().remove(id);
  });
  handle('install', async id => {
    const entry = library().resolve(id);
    if (!entry.ready) throw Error('Build the experimental add-on first (see Developer files).');
    const picked = await dialog.showOpenDialog(window(), { title: 'Select a CLOSED offline test game with ReShade add-on support', properties: ['openFile'], filters: [{ name: 'Windows game executable', extensions: ['exe'] }] });
    if (picked.canceled) return null;
    const confirm = await dialog.showMessageBox(window(), { type: 'warning', title: 'Overlay test — not a DLSS installation',
      message: 'Confirm the game is closed and already uses ReShade with add-on support. Keep DLSS 5 Swapper open while testing the built-in overlay.',
      detail: `${picked.filePaths[0]}\n\nOnly a uniquely named overlay add-on is copied next to this executable. No existing DLLs or configuration files are replaced by installation. No Vulkan registry changes. Avoid online / anti-cheat games.\n\nThis overlay automatically connects through an undocumented, exact-build v4.7 adapter that temporarily redirects its UI dispatch. This may be incompatible with other add-ons. RenoDX itself saves settings you change. This is not NVIDIA's official SDK or overlay.`,
      buttons: ['Cancel', 'Install test overlay'], defaultId: 0, cancelId: 0 });
    return confirm.response === 1 ? library().install(id, picked.filePaths[0]) : null;
  });
  handle('uninstall', async id => {
    const confirm = await dialog.showMessageBox(window(), { type: 'question', message: 'Is the test game closed?', detail: 'Remove only the unchanged overlay this app copied. Keep ReShade, DLSS, presets, and every original file.', buttons: ['Cancel', 'Remove test overlay'], defaultId: 0, cancelId: 0 });
    if (confirm.response === 1) library().uninstall(id);
  });
  handle('source', async () => {
    const error = await shell.openPath(path.join(appRoot, 'overlay'));
    if (error) throw Error(error);
  });
};

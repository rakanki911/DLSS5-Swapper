'use strict';
const path = require('node:path');
const { createOverlayLibrary } = require('./overlays');

module.exports = function registerOverlayIpc({ app, ipcMain, dialog, shell, window, bridge = () => null, language = () => 'en' }) {
  const text = (english, chinese) => language() === 'zh' ? chinese : english;
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
    const picked = await dialog.showOpenDialog(window(), { title: text('Add a custom ReShade overlay', '添加自定义 ReShade 叠加层'), properties: ['openFile'], filters: [{ name: text('ReShade native add-ons', 'ReShade 原生插件'), extensions: ['addon64', 'addon32'] }] });
    if (picked.canceled) return null;
    const confirm = await dialog.showMessageBox(window(), { type: 'warning', title: text('Native add-on — trusted developers only', '原生插件：仅使用可信开发者的文件'),
      message: text('This file contains native code. A ReShade add-on can access your files when loaded by a game.', '此文件包含原生程序代码。游戏加载 ReShade 插件后，插件可以访问你的文件。'),
      detail: text('Adding it here only stores a copy; it is not executed here. A checksum does not certify that the file is safe.', '在这里添加只会保存一份副本，不会运行它。文件校验通过并不代表文件一定安全。'),
      buttons: [text('Cancel', '取消'), text('Add trusted file', '添加可信文件')], defaultId: 0, cancelId: 0 });
    return confirm.response === 1 ? library().add(picked.filePaths[0]) : null;
  });
  handle('remove', async id => {
    const entry = library().resolve(id);
    if (entry.builtin) throw Error('The built-in overlay cannot be deleted.');
    const confirm = await dialog.showMessageBox(window(), { type: 'question', message: text(`Remove ${entry.name}?`, `移除“${entry.name}”？`), detail: text('Your original imported file is kept.', '你导入的原始文件会保留。'), buttons: [text('Cancel', '取消'), text('Remove', '移除')], defaultId: 0, cancelId: 0 });
    if (confirm.response === 1) library().remove(id);
  });
  handle('install', async id => {
    const entry = library().resolve(id);
    if (!entry.ready) throw Error('Build the experimental add-on first (see Developer files).');
    const picked = await dialog.showOpenDialog(window(), { title: text('Select a CLOSED offline test game with ReShade add-on support', '选择已关闭、支持 ReShade 插件的离线测试游戏'), properties: ['openFile'], filters: [{ name: text('Windows game executable', 'Windows 游戏主程序'), extensions: ['exe'] }] });
    if (picked.canceled) return null;
    const confirm = await dialog.showMessageBox(window(), { type: 'warning', title: text('Overlay test — not a DLSS installation', '叠加层测试：此操作不会安装 DLSS'),
      message: text('Confirm the game is closed and already uses ReShade with add-on support. Keep DLSS 5 Swapper open while testing the built-in overlay.', '请确认游戏已经关闭，且已使用支持插件的 ReShade。测试内置叠加层时，请保持 DLSS 5 Swapper 运行。'),
      detail: `${picked.filePaths[0]}\n\n${text("Only a uniquely named overlay add-on is copied next to this executable. No existing DLLs or configuration files are replaced by installation. No Vulkan registry changes. Avoid online / anti-cheat games.\n\nThis overlay automatically connects through an undocumented, exact-build v4.7 adapter that temporarily redirects its UI dispatch. This may be incompatible with other add-ons. RenoDX itself saves settings you change. This is not NVIDIA's official SDK or overlay.", '仅在该主程序旁复制一个名称唯一的叠加层插件。安装不会替换已有 DLL 或配置文件，也不会修改 Vulkan 注册表。请避免用于联网或带反作弊的游戏。\n\n此叠加层通过未公开文档的、精确匹配 4.7 版的适配接口自动连接，会临时转接界面接口，可能与其他插件不兼容。修改的设置由 RenoDX 自行保存。这不是 NVIDIA 官方 SDK 或叠加层。')}`,
      buttons: [text('Cancel', '取消'), text('Install test overlay', '安装测试叠加层')], defaultId: 0, cancelId: 0 });
    return confirm.response === 1 ? library().install(id, picked.filePaths[0]) : null;
  });
  handle('uninstall', async id => {
    const confirm = await dialog.showMessageBox(window(), { type: 'question', message: text('Is the test game closed?', '测试游戏已经关闭了吗？'), detail: text('Remove only the unchanged overlay this app copied. Keep ReShade, DLSS, presets, and every original file.', '仅移除本程序复制且未经修改的叠加层。保留 ReShade、DLSS、预设及全部原始文件。'), buttons: [text('Cancel', '取消'), text('Remove test overlay', '移除测试叠加层')], defaultId: 0, cancelId: 0 });
    if (confirm.response === 1) library().uninstall(id);
  });
  handle('source', async () => {
    const error = await shell.openPath(path.join(appRoot, 'overlay'));
    if (error) throw Error(error);
  });
};

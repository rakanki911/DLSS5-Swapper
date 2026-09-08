'use strict';

// Run with npm run test:ui. The hidden window uses synthetic metadata and an
// isolated profile; no real library, game files or network calls are involved.
const { app, BrowserWindow, Menu } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-filter-ui-')));
const timeout = setTimeout(() => { console.error('UI test timed out'); app.exit(1); }, 60000);

app.whenReady().then(async () => {
  const gameMenu = require('../src/core/game-menu');
  const nativeMenu = Menu.buildFromTemplate(gameMenu.template({
    name: 'Game & Emulator', labels: gameMenu.labelsFor({ open: 'فتح مجلد اللعبة' }), busy: false, restorable: true
  }, () => {}));
  assert.equal(nativeMenu.getMenuItemById('restore').enabled, true);
  assert.equal(nativeMenu.getMenuItemById('open').label, 'فتح مجلد اللعبة');
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
  await run(`new Promise(resolve => {
    const check = () => state.games.length === 9 && $('statusText').textContent === t('ready')
      ? resolve() : setTimeout(check, 10);
    check();
  })`);
  await run(`show('games')`);
  const swtorOptions = await run(`installOptions({ recommendedRoute: 'feeder' }, { bitness: 64, api: 'd3d9', apiLabel: 'DirectX 9' }, 'SWTOR')`);
  assert.match(swtorOptions, /value="feeder" selected/);
  assert.doesNotMatch(swtorOptions, /value="native"/);
  assert.match(await run(`installOptions({}, { bitness: 32, api: 'd3d8', apiLabel: 'DirectX 8' }, 'DX8')`), /value="feeder" selected/);
  assert.match(swtorOptions, /value="optiscaler" disabled/);
  assert.match(await run(`installOptions({ antiCheatWarning: true }, null, 'NoExecutable')`), /anti-cheat-warning/);
  assert.match(await run(`installOptions({}, { bitness: 32, api: 'd3d10', apiLabel: 'DirectX 10', antiCheatWarning: true }, 'DX10')`), /anti-cheat-warning/);
  const count = () => run(`document.querySelectorAll('#groups .card').length`);
  const select = (id, value) => run(`$('${id}').value = ${JSON.stringify(value)}; $('${id}').dispatchEvent(new Event('change'));`);
  const search = (query) => run(`$('gameSearch').focus(); $('gameSearch').value = ${JSON.stringify(query)}; $('gameSearch').dispatchEvent(new Event('input'));`);
  const clear = () => run(`$('clearGameFilters').click()`);

  assert.equal(await count(), 9);
  await search('TRUCK');
  assert.equal(await count(), 3);
  assert.equal(await run(`document.activeElement.id`), 'gameSearch');
  await select('gameApi', 'DirectX 12');
  assert.equal(await count(), 2);
  await select('gameDlss', 'present');
  await select('gameAddon', 'present');
  assert.equal(await count(), 1);
  assert.equal(await run(`$('gamesCount').textContent`), '1 of 9 shown');
  assert.equal(await run(`$('groups').querySelector('.name').textContent`), 'Euro Truck Simulator');
  assert.equal(await run(`state.games.length`), 9);
  await select('gameDlss', 'version:310.8.0.0');
  assert.equal(await count(), 0);
  assert.equal(await run(`Boolean($('groups').querySelector('.games-empty'))`), true);
  assert.equal(await run(`[...$('gameDlss').options].some(o => o.value === 'version:2.2.16')`), true);
  await clear();
  assert.equal(await count(), 9);
  assert.equal(await run(`$('gameSearch').value`), '');
  assert.equal(await run(`$('clearGameFilters').disabled`), true);

  await select('gameApi', 'dx11-dx12');
  assert.equal(await count(), 5);
  await clear();
  await select('gameApi', 'no-graphics-exe');
  assert.equal(await count(), 1);
  await clear();
  await select('gameDlss', 'present');
  assert.equal(await count(), 3);
  assert.equal(await run(`[...$('groups').querySelectorAll('.card')].find(c => c.querySelector('.name').textContent === 'Unknown DLSS version').querySelector('.status').textContent.includes('DLSS present')`), true);
  await clear();
  await run(`$('gameQuickFilters').querySelector('[data-filter="api"]').focus(); $('gameQuickFilters').querySelector('[data-filter="api"]').click()`);
  assert.equal(await count(), 3);
  assert.equal(await run(`document.activeElement.dataset.filter`), 'api');
  assert.equal(await run(`$('gameApi').value`), 'DirectX 12');
  await run(`$('gameQuickFilters').querySelector('[data-value="present"]').click()`);
  assert.equal(await count(), 2);
  await clear();
  await run(`$('groups').querySelector('[data-ready-filter]').focus(); $('groups').querySelector('[data-ready-filter]').click()`);
  assert.equal(await count(), 8);
  assert.equal(await run(`$('gameDlss').value`), 'ready');
  assert.equal(await run(`document.activeElement.dataset.readyFilter`), 'My folders');

  // New scan results must respect active filters without losing text/focus.
  await clear();
  await search('truck');
  await select('gameDlss', 'version:2.2.16');
  await run(`state.games.push({ name: 'New Truck', dir: 'C:\\\\FixtureGames\\\\new', launcher: 'My folders', cached: null }); renderGames()`);
  assert.equal(await count(), 1);
  await run(`state.games.at(-1).cached = { ok: true, api: 'DirectX 12', dlss: '2.2.16' }; renderGames()`);
  assert.equal(await count(), 2);
  assert.equal(await run(`document.activeElement.id`), 'gameSearch');
  await run(`state.games.at(-1).cached.dlss = '3.10.0'; state.games[0].cached.dlss = '3.10.0'; renderGames()`);
  assert.equal(await count(), 0);
  assert.equal(await run(`$('gameDlss').value`), 'version:2.2.16');
  await run(`state.games.pop(); state.games[0].cached.dlss = '2.2.16'; renderGames()`);

  const output = path.join(__dirname, '../dist/ui-tests');
  fs.mkdirSync(output, { recursive: true });
  await clear();
  await search('truck');
  await select('gameApi', 'dx11-dx12');
  await select('gameDlss', 'present');
  // Capture the actual renderer, including narrow-window and RTL layouts.
  const languageChecks = await run(`LANGS.map(({ code, dir }) => {
    applyLang(code);
    const strings = window.featureI18n.strings(code);
    return {
      code,
      translated: $('gameSearch').placeholder === strings.searchGamesHint && $('clearGameFilters').textContent.trim() === strings.clearFilters,
      preserved: $('gameSearch').value === 'truck' && $('gameApi').value === 'dx11-dx12' && $('gameDlss').value === 'present',
      direction: document.documentElement.dir === dir,
      warning: installOptions({ antiCheatWarning: true }, { bitness: 64, api: 'd3d9' }, 'Fixture').includes(esc(strings.antiCheatWarning))
    };
  })`);
  assert.equal(languageChecks.length, 38);
  for (const check of languageChecks) {
    for (const key of ['translated', 'preserved', 'direction', 'warning']) assert.equal(check[key], true, check.code + ': ' + key);
  }
  for (const [lang, theme, width] of [['en', 'light', 1280], ['en', 'dark', 1040], ['ar', 'dark', 1040], ['ja', 'light', 1040], ['fa', 'dark', 1040]]) {
    win.setSize(width, 900);
    await run(`applyLang('${lang}'); document.documentElement.dataset.theme = '${theme}'; new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));`);
    assert.equal(await count(), 2);
    assert.equal(await run(`$('gameSearch').value`), 'truck');
    assert.equal(await run(`$('gameApi').value`), 'dx11-dx12');
    assert.equal(await run(`$('gameDlss').value`), 'present');
    assert.equal(await run(`document.documentElement.dir`), ['ar', 'fa', 'ur'].includes(lang) ? 'rtl' : 'ltr');
    assert.equal(await run(`Array.from(document.querySelectorAll('.game-filters input, .game-filters select, #clearGameFilters')).every(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.width > 50; })`), true);
    // Allow the hidden window's compositor to present the new language too.
    await new Promise(resolve => setTimeout(resolve, 150));
    const screenshot = await win.webContents.capturePage();
    fs.writeFileSync(path.join(output, `filters-${lang}-${theme}.png`), screenshot.toPNG());
  }
  await clear();
  await search('السيارات');
  assert.equal(await count(), 1);
  await clear();
  await run(`window.fixtureGames = state.games; state.games = Array.from({ length: 1000 }, (_, i) => ({ ...fixtureGames[i % 9], name: 'Library Game ' + i, dir: 'C:\\\\FixtureGames\\\\large' + i })); renderGames()`);
  assert.equal(await count(), 1000);
  await search('Library Game 999');
  assert.equal(await count(), 1);
  await run(`state.games = window.fixtureGames; delete window.fixtureGames; renderGames()`);
  await clear();

  // Store categories are a presentation preference: one grid when off,
  // original sources when on, without a library reload or filter reset.
  await run(`(async () => { applyLang('en'); state.games.forEach((g, i) => { g.launcher = ['Steam', 'Epic Games', 'GOG'][i % 3]; }); renderGames(); await renderSettings(); })()`);
  assert.equal(await run(`document.querySelectorAll('#groups .group-head').length`), 3);
  const libraryReads = await run(`window.lab.testLibraryReads()`);
  await search('truck');
  await select('gameApi', 'dx11-dx12');
  await select('gameDlss', 'present');
  await run(`(async () => { await $('setGroupGames').onclick(); show('games'); })()`);
  assert.equal(await run(`$('setGroupGames').getAttribute('aria-checked')`), 'false');
  assert.equal(await run(`document.querySelectorAll('#groups .group-head').length`), 0);
  assert.equal(await run(`document.querySelectorAll('#groups .grid').length`), 1);
  assert.equal(await count(), 2);
  assert.deepEqual(await run(`[...document.querySelectorAll('#groups .name')].map(e => e.textContent)`), ['American Truck Simulator', 'Euro Truck Simulator']);
  assert.equal(await run(`$('gameSearch').value`), 'truck');
  assert.equal(await run(`$('gameDlss').value`), 'present');
  assert.equal(await run(`window.lab.boot().then(boot => boot.groupGamesByStore)`), false);
  assert.equal(await run(`window.lab.testLibraryReads()`), libraryReads);
  await clear();
  assert.equal(await count(), 9);
  assert.equal(await run(`document.querySelectorAll('#groups .grid').length`), 1);
  await run(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
  fs.writeFileSync(path.join(output, 'unified-games.png'), (await win.webContents.capturePage()).toPNG());
  await search('No matching title');
  assert.equal(await count(), 0);
  assert.equal(await run(`Boolean($('groups').querySelector('.games-empty'))`), true);
  await clear();
  await run(`(async () => { await renderSettings(); await $('setGroupGames').onclick(); })()`);
  assert.equal(await run(`$('setGroupGames').getAttribute('aria-checked')`), 'true');
  assert.equal(await run(`document.querySelectorAll('#groups .group-head').length`), 3);
  assert.equal(await count(), 9);
  assert.equal(await run(`window.lab.testLibraryReads()`), libraryReads);
  await run(`(async () => { applyLang('ar'); show('settings'); await renderSettings(); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); })()`);
  assert.equal(await run(`$('setGroupGames').getAttribute('aria-label')`), 'تقسيم الألعاب حسب المتجر');
  fs.writeFileSync(path.join(output, 'grouping-settings-ar.png'), (await win.webContents.capturePage()).toPNG());

  // Manual API selection is independent of detection and never auto-installs.
  await run(`applyLang('en'); show('games'); openSheet(state.games[0].dir)`);
  const apiReady = () => run(`new Promise(resolve => { const check = () => $('apiChoice') && !$('apiChoice').disabled ? resolve() : setTimeout(check, 15); check(); })`);
  await apiReady();
  assert.equal(await run(`$('apiChoice').value`), 'auto');
  assert.equal(await run(`$('apiChoice').options.length`), 8);
  const beforeApi = await run(`window.lab.testInstallCalls().length`);
  for (const value of ['d3d9', 'd3d11', 'd3d12', 'vulkan', 'opengl', 'd3d10']) {
    await select('apiChoice', value);
    await apiReady();
    assert.equal(await run(`$('apiChoice').value`), value);
    assert.equal(await run(`$('doInstall').disabled`), value === 'd3d10');
    assert.equal(await run(`window.lab.testInstallCalls().length`), beforeApi);
    if (value === 'vulkan') {
      assert.match(await run(`$('apiHint').textContent`), /shared ReShade layer/);
      assert.doesNotMatch(await run(`$('backendHint').textContent`), /must not be active/);
      await run(`document.getAnimations().forEach(animation => animation.finish()); new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
      assert.equal(await run(`getComputedStyle($('overlay')).opacity`), '1');
      fs.writeFileSync(path.join(output, 'manual-vulkan-en.png'), (await win.webContents.capturePage()).toPNG());
    }
  }
  // Correct a DX10/OpenGL misclassification; preserve the selected label and
  // route after closing the sheet and changing language.
  await run(`window.lab.testDetectedApi({ api: 'opengl', apiLabel: 'OpenGL', bitness: 64 }); openSheet(state.games[0].dir)`);
  await apiReady();
  await select('apiChoice', 'd3d11'); await apiReady();
  assert.match(await run(`document.querySelector('#sheet .specs').textContent`), /DirectX 11/);
  assert.equal(await run(`$('routeChoice').value`), 'feeder');
  await run(`closeSheet(); applyLang('ar'); openSheet(state.games[0].dir)`);
  await apiReady();
  assert.equal(await run(`$('apiChoice').value`), 'd3d11');
  assert.match(await run(`$('apiChoice').options[0].textContent`), /تلقائي/);
  await run(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
  await run(`document.getAnimations().forEach(animation => animation.finish())`);
  fs.writeFileSync(path.join(output, 'manual-api-ar.png'), (await win.webContents.capturePage()).toPNG());
  await select('apiChoice', 'auto'); await apiReady();
  assert.match(await run(`document.querySelector('#sheet .specs').textContent`), /OpenGL/);
  await run(`window.lab.testApiSaveFailure(true)`);
  await select('apiChoice', 'vulkan'); await apiReady();
  assert.equal(await run(`$('apiChoice').value`), 'auto', 'failed save does not claim the choice was saved');
  assert.equal(await run(`$('job').textContent.includes(t('errApiSave'))`), true);
  await run(`window.lab.testApiSaveFailure(false); window.lab.testDetectedApi({ api: 'dxgi', apiLabel: 'DirectX 12', bitness: 64 }); closeSheet(); applyLang('en'); show('about')`);
  for (const value of ['github', 'releases']) await run(`document.querySelector('[data-project="${value}"]').click()`);
  assert.deepEqual(await run(`window.lab.testProjectLinks()`), ['github', 'releases']);
  assert.equal(await run(`$('projectLinkError').classList.contains('hidden')`), true);
  await run(`window.lab.testProjectLinkFailure(true); document.querySelector('[data-project="releases"]').click()`);
  assert.equal(await run(`$('projectLinkError').classList.contains('hidden')`), false);
  await run(`window.lab.testProjectLinkFailure(false); document.querySelector('[data-project="releases"]').click(); new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
  fs.writeFileSync(path.join(output, 'about-links-en.png'), (await win.webContents.capturePage()).toPNG());

  // The backend selector is opt-in: changing the control must not install.
  await run(`applyLang('en'); show('games'); openSheet(state.games[0].dir)`);
  const sheetReady = () => run(`new Promise(resolve => { const check = () => $('backendChoice') && !jobRunning ? resolve() : setTimeout(check, 15); check(); })`);
  await sheetReady();
  assert.equal(await run(`$('backendChoice').value`), 'reshade');
  assert.equal(await run(`window.lab.testInstallCalls().length`), 0);
  await select('backendChoice', 'optiscaler');
  await sheetReady();
  assert.equal(await run(`$('backendChoice').value`), 'optiscaler');
  assert.equal(await run(`Boolean($('routeChoice'))`), false);
  assert.equal(await run(`window.lab.testInstallCalls().length`), 0);
  assert.match(await run(`$('doInstall').textContent`), /OptiScaler/);
  assert.match(await run(`$('backendHint').textContent`), /RTX 50/);
  await run(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
  fs.writeFileSync(path.join(output, 'optiscaler-en.png'), (await win.webContents.capturePage()).toPNG());
  await run(`window.lab.testHoldInstall(); $('doInstall').click()`);
  assert.equal(await run(`jobRunning`), true);
  assert.equal(await run(`$('backendChoice').disabled && $('doRestore').disabled`), true);
  await run(`$('doInstall').click()`);
  assert.equal(await run(`window.lab.testInstallCalls().length`), 1);
  await run(`window.lab.testFinishInstall(); new Promise(resolve => setTimeout(resolve, 500))`);
  await sheetReady();
  assert.equal(await run(`window.lab.testInstallCalls()[0].route`), 'optiscaler');
  assert.equal(await run(`sheetDetails.installedRoute`), 'optiscaler');
  // A whole install takes the button away; a second click cannot add anything.
  assert.equal(await run(`$('doInstall').disabled`), true);
  assert.match(await run(`$('doInstall').textContent`), /OptiScaler DLSS-NR is installed/);
  await select('backendChoice', 'reshade');
  await sheetReady();
  assert.equal(await run(`$('routeChoice').value`), 'native');
  assert.equal(await run(`$('doInstall').textContent`), 'Apply backend change');
  await run(`$('doInstall').click(); new Promise(resolve => setTimeout(resolve, 500))`);
  await sheetReady();
  assert.equal(await run(`window.lab.testInstallCalls()[1].route`), 'native');
  assert.equal(await run(`sheetDetails.installedRoute`), 'native');
  assert.match(await run(`$('backendHint').textContent`), /No effects found/);
  const callsBeforeProtection = await run(`window.lab.testInstallCalls().length`);
  for (const [issue, lang] of [['errManagedModpack', 'ar']]) {
    await run(`window.lab.testInstallIssue('${issue}'); applyLang('${lang}'); openSheet(state.games[0].dir, true)`);
    await sheetReady();
    assert.equal(await run(`$('doInstall').disabled`), true);
    assert.equal(await run(`$('doRestore').disabled`), false);
    assert.equal(await run(`document.querySelector('#sheet [role="alert"]').textContent`), await run(`t('${issue}')`));
    await run(`$('doInstall').click()`);
    assert.equal(await run(`window.lab.testInstallCalls().length`), callsBeforeProtection);
    await run(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    fs.writeFileSync(path.join(output, `${issue}-${lang}.png`), (await win.webContents.capturePage()).toPNG());
  }
  await run(`window.lab.testInstallIssue(null); applyLang('en'); openSheet(state.games[0].dir, true)`);
  await sheetReady();
  // The issue no longer governs the button. What does is the native install
  // already in the game, which is whole - so it stays disabled and says so.
  assert.equal(await run(`Boolean(document.querySelector('#sheet [role="alert"]'))`), false);
  assert.equal(await run(`$('doInstall').textContent`), 'DLSS 5 is installed');
  assert.equal(await run(`$('doInstall').disabled`), true);
  assert.equal(await run(`$('doRestore').disabled`), false);
  // With the add-on gone the install is not whole any more, and the button
  // comes back so it can be redone. Everything below runs in that state.
  await run(`window.lab.testInstallWhole(false)`);
  for (const [lang, theme] of [['en', 'light'], ['ar', 'dark']]) {
    await run(`window.lab.testAntiCheatWarning(true); applyLang('${lang}'); document.documentElement.dataset.theme = '${theme}'; openSheet(state.games[0].dir, true)`);
    await sheetReady();
    assert.equal(await run(`$('doInstall').disabled`), false, 'anti-cheat is optional, not blocked');
    assert.equal(await run(`$('doRestore').disabled`), false);
    assert.equal(await run(`document.querySelector('.anti-cheat-warning b').textContent`), await run(`t('antiCheatWarningTitle')`));
    assert.equal(await run(`document.querySelector('.anti-cheat-warning span').textContent`), await run(`t('antiCheatWarning')`));
    assert.equal(await run(`getComputedStyle(document.querySelector('.anti-cheat-warning')).color`), theme === 'light' ? 'rgb(165, 29, 39)' : 'rgb(255, 157, 165)');
    await run(`document.querySelector('.anti-cheat-warning').scrollIntoView({ block: 'center' }); new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    fs.writeFileSync(path.join(output, `anti-cheat-${lang}-${theme}.png`), (await win.webContents.capturePage()).toPNG());
  }
  assert.equal(await run(`window.lab.testInstallCalls().length`), callsBeforeProtection, 'showing a warning never installs');
  await run(`window.lab.testAntiCheatWarning(false); applyLang('en'); openSheet(state.games[0].dir, true)`);
  await sheetReady();
  assert.equal(await run(`document.querySelector('.anti-cheat-warning')`), null);
  await select('backendChoice', 'optiscaler');
  await sheetReady();
  await run(`applyLang('ar')`);
  await sheetReady();
  assert.equal(await run(`$('backendChoice').value`), 'optiscaler');
  assert.equal(await run(`document.documentElement.dir`), 'rtl');
  assert.match(await run(`$('doInstall').textContent`), /تطبيق/);
  await run(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
  fs.writeFileSync(path.join(output, 'optiscaler-ar.png'), (await win.webContents.capturePage()).toPNG());

  // Clipboard is stubbed in the preload: these checks never change the real clipboard.
  assert.equal(await run(`$('copyJob').disabled`), false);
  await run(`$('copyJob').onclick()`);
  assert.match(await run(`window.lab.testCopiedText()`), /done - 1 replaced, 5 added/);
  assert.match(await run(`window.lab.testCopiedText()`), /FixtureGames/);
  assert.equal(await run(`getComputedStyle($('job')).userSelect`), 'text');
  await run(`closeSheet(); applyLang('en'); show('history'); renderHistory()`);
  assert.equal(await run(`document.querySelectorAll('.hist-row').length`), 2, 'install updates History without reopening the app');
  await run(`$('copyHistory').onclick()`);
  assert.match(await run(`window.lab.testCopiedText()`), /OptiScaler DLSS-NR/);
  assert.match(await run(`window.lab.testCopiedText()`), /ReShade \/ RenoDX/);
  assert.equal(await run(`getComputedStyle(document.querySelector('.hist-row .d')).userSelect`), 'text');
  await run(`window.lab.testHistory([
    { name: '<img src=x onerror=alert(1)> & Game', dir: 'D:\\\\Games\\\\<test>', exe: 'bin/Game.exe', route: 'feeder', api: 'd3d9', date: '2026-09-02T19:12:00.000Z', replaced: 1, added: 5, action: 'restore' },
    { name: 'محاكي الألعاب', dir: 'D:\\\\Games\\\\Emulator', date: '2026-09-01T12:00:00.000Z', replaced: 0, added: 8, action: 'install', imported: true }
  ]); renderHistory()`);
  assert.equal(await run(`document.querySelectorAll('#history img').length`), 0);
  assert.match(await run(`$('history').textContent`), /restored/);
  assert.match(await run(`$('history').textContent`), /Backup record/);
  await run(`$('copyHistory').onclick()`);
  assert.match(await run(`window.lab.testCopiedText()`), /<img src=x onerror=alert\(1\)> & Game/);
  assert.doesNotMatch(await run(`window.lab.testCopiedText()`), /&lt;/);
  await run(`new Promise(resolve => setTimeout(resolve, 150))`);
  fs.writeFileSync(path.join(output, 'history-en.png'), (await win.webContents.capturePage()).toPNG());
  await run(`state.theme = 'dark'; $('themeBtn').click(); new Promise(resolve => setTimeout(resolve, 150))`);
  assert.equal(await run(`document.documentElement.dataset.theme`), 'light');
  fs.writeFileSync(path.join(output, 'history-light.png'), (await win.webContents.capturePage()).toPNG());
  await run(`applyLang('ar'); renderHistory()`);
  assert.equal(await run(`$('copyHistory').textContent`), 'نسخ الهستري');
  await run(`$('copyHistory').onclick()`);
  assert.equal(await run(`$('copyFeedback').textContent`), 'تم النسخ إلى الحافظة');
  await run(`new Promise(resolve => setTimeout(resolve, 150))`);
  fs.writeFileSync(path.join(output, 'history-ar.png'), (await win.webContents.capturePage()).toPNG());
  await run(`window.lab.testHistoryFailure(true); renderHistory()`);
  assert.equal(await run(`$('copyHistory').disabled`), true);
  assert.equal(await run(`$('history').textContent`), await run(`t('historyLoadFailed')`));
  await run(`window.lab.testHistoryFailure(false); window.lab.testHistory([]); renderHistory()`);
  assert.equal(await run(`$('copyHistory').disabled`), true);
  assert.equal(await run(`$('history').textContent`), await run(`t('histEmpty')`));
  await run(`show('home'); $('clearLog').click()`);
  assert.equal(await run(`$('copyLog').disabled`), true);
  await run(`for(let index = 0; index < 55; index++) log('Log <entry> ' + index); $('copyLog').onclick()`);
  assert.equal(await run(`document.querySelectorAll('#log .log-row').length`), 40);
  assert.equal((await run(`window.lab.testCopiedText()`)).split('\n').length, 55, 'copies ALL entries, not only the last 40 displayed');
  assert.match(await run(`window.lab.testCopiedText()`), /Log <entry> 0\n/);
  assert.match(await run(`window.lab.testCopiedText()`), /Log <entry> 54$/);
  assert.equal(await run(`getComputedStyle(document.querySelector('#log .m')).userSelect`), 'text');
  await run(`window.lab.testCopyFailure(true); $('copyLog').onclick()`);
  assert.equal(await run(`$('copyFeedback').textContent`), await run(`t('copyFailed')`));
  await run(`$('clearLog').click()`);
  assert.equal(await run(`$('copyLog').disabled`), true);
  // Right-click is delegated to current cards, including after filters/renders.
  await run(`window.lab.testCopyFailure(false); applyLang('en'); show('games'); state.recents = [{ dir: state.games[0].dir, at: Date.now() }]; renderRecent();`);
  const menu = (selector, action) => run(`(async () => {
    window.lab.testMenuAction(${JSON.stringify(action)});
    const card = document.querySelector(${JSON.stringify(selector)});
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 900, clientY: 650 });
    card.querySelector('.title, .name')?.dispatchEvent(event);
    await new Promise(resolve => { const check = () => contextMenuOpen ? setTimeout(check, 10) : resolve(); check(); });
    return event.defaultPrevented;
  })()`);
  const first = '#groups .card';
  const firstDir = await run(`document.querySelector('${first}').dataset.dir`);
  const recentDir = await run(`state.games[0].dir`);
  const readsBeforeMenu = await run(`window.lab.testLibraryReads()`);
  assert.equal(await menu(first, 'copy'), true);
  assert.equal(await run(`window.lab.testCopiedText()`), firstDir);
  assert.equal(await run(`$('overlay').classList.contains('hidden')`), true, 'right-click does not open details by itself');
  await menu(first, 'open');
  assert.deepEqual(await run(`window.lab.testActionCalls().at(-1)`), { action: 'open', dir: firstDir });
  await menu(first, 'scan');
  assert.deepEqual(await run(`window.lab.testActionCalls().at(-1)`), { action: 'scan', dir: firstDir });
  assert.equal(await run(`window.lab.testLibraryReads()`), readsBeforeMenu, 'rescan does not sweep the whole library');
  await menu(first, 'poster');
  assert.equal(await run(`state.games.find(g => g.dir === ${JSON.stringify(firstDir)}).poster.custom`), true);
  await menu(first, 'details');
  assert.equal(await run(`sheetGame.dir`), firstDir);
  await run(`closeSheet(); show('home'); applyLang('ar')`);
  await menu('#recents .rcard', 'copy');
  assert.equal(await run(`window.lab.testCopiedText()`), recentDir);
  assert.equal(await run(`window.lab.testMenuCalls().at(-1).options.labels.open`), 'فتح مجلد اللعبة');
  await run(`(async () => {
    window.lab.testMenuAction(null);
    const card = document.querySelector('#recents .rcard'); card.focus();
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true }));
    await new Promise(resolve => { const check = () => contextMenuOpen ? setTimeout(check, 10) : resolve(); check(); });
  })()`);
  assert.equal(await run(`window.lab.testMenuCalls().at(-1).dir`), recentDir);
  const restoresBefore = await run(`window.lab.testActionCalls().filter(c => c.action === 'restore').length`);
  await menu('#recents .rcard', null);
  assert.equal(await run(`window.lab.testActionCalls().filter(c => c.action === 'restore').length`), restoresBefore);
  await run(`jobRunning = true`);
  await menu('#recents .rcard', 'restore'); // Defensive guard even for a forged return value.
  assert.equal(await run(`window.lab.testMenuCalls().at(-1).options.busy`), true);
  assert.equal(await run(`window.lab.testActionCalls().filter(c => c.action === 'restore').length`), restoresBefore);
  await run(`jobRunning = false`);
  await menu('#recents .rcard', 'restore');
  assert.equal(await run(`window.lab.testActionCalls().filter(c => c.action === 'restore').length`), restoresBefore + 1);
  assert.equal(await run(`window.lab.testActionCalls().find(c => c.action === 'restore').dir`), recentDir);
  assert.match(await run(`$('job').textContent`), /originals restored/);
  assert.equal(await run(`window.lab.history().then(r => r.rows.at(-1).action)`), 'restore');
  await run(`closeSheet(); state.recents = [{ dir: state.games[0].dir, at: Date.now() }]; renderRecent();`);
  await menu('#recents .rcard', 'hide');
  assert.equal(await run(`state.games.some(g => g.dir === ${JSON.stringify(recentDir)})`), false);
  assert.equal(await run(`document.querySelectorAll('#recents .rcard').length`), 0);
  assert.deepEqual(await run(`window.lab.testActionCalls().at(-1)`), { action: 'hide', dir: recentDir });
  await run(`new Promise(resolve => setTimeout(resolve, 450))`);
  assert.equal(await run(`$('overlay').classList.contains('hidden')`), true, 'a completed job must not reopen a dismissed sheet');
  assert.deepEqual(errors, []);
  console.log('PASS: filters and warnings in all 38 languages; library grouping, optional backends, History/copy, context actions, keyboard access, restore guards and light/dark/RTL layouts.');
  console.log(`Screenshots: ${output}`);
  clearTimeout(timeout);
  win.destroy();
  app.exit(0);
}).catch(error => { console.error(error); clearTimeout(timeout); app.exit(1); });

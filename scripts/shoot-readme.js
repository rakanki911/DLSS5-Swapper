'use strict';

// README screenshots, taken from the real app against the real server so the
// pictures are of the thing itself rather than a mock. Dark theme, one wide
// window, and every shot waits on what it is photographing rather than a clock.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

// Electron is started on a script rather than on the app folder, so it reports
// its own version for app.getVersion() - 33.4.11 turned up in the report sheet
// where 2.2.4 belongs. The real one is put back before anything reads it.
const version = require('../package.json').version;
if (typeof app.setVersion === 'function') app.setVersion(version);
else app.getVersion = () => version;
app.setName('DLSS 5 Swapper');

require('../main.js');

const OUT = path.join(__dirname, '..', 'docs', 'screenshots');
const WIDTH = 1680, HEIGHT = 1020;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const die = (why) => { console.error(why); app.exit(1); };
setTimeout(() => die('timed out'), 180000);

app.whenReady().then(async () => {
  let win = null;
  for (let i = 0; i < 200 && !win; ++i) {
    win = BrowserWindow.getAllWindows().find((w) => !w.webContents.isDestroyed() && !w.webContents.isOffscreen());
    if (!win) await wait(100);
  }
  if (!win) return die('no window');
  await new Promise((resolve) => win.webContents.isLoading() ? win.webContents.once('did-finish-load', resolve) : resolve());
  win.setSize(WIDTH, HEIGHT);
  win.center();
  win.show();

  const run = (code) => win.webContents.executeJavaScript(code, true);
  const shot = async (name) => {
    await wait(700);
    const image = await win.webContents.capturePage();
    const file = path.join(OUT, name);
    fs.writeFileSync(file, image.toPNG());
    console.log('  wrote', name, image.getSize().width + 'x' + image.getSize().height);
  };
  const settle = async (expression, why) => {
    for (let i = 0; i < 150; ++i) { if (await run(expression)) return; await wait(200); }
    throw new Error('never became true: ' + why);
  };

  const dumped = async (label) => {
    const seen = await run(`JSON.stringify({
      dialogs: [...document.querySelectorAll('dialog')].filter(d => d.open).map(d => d.id),
      cards: document.querySelectorAll('[data-community-card]').length,
      notice: document.getElementById('communityNotice').textContent.trim().slice(0, 60),
      replies: document.querySelectorAll('.community-reply, [data-reply]').length,
      threads: document.querySelectorAll('[data-thread]').length,
      composer: !!document.querySelector('.community-composer')
    })`);
    console.log('  [' + label + ']', seen);
  };

  // Dark theme through the same path the button uses, so nothing is faked.
  await run(`state.theme = 'dark'; document.documentElement.dataset.theme = 'dark'; paintBrand(); window.lab.setTheme('dark'); true`);
  await wait(400);

  await run(`show('community'); true`);
  // The grid, once it is the grid and not the word "Loading": cards present,
  // the notice cleared, and every piece of artwork actually decoded.
  // Let the library settle first: a progress bar in the corner reading
  // "Fetching art..." is not what the page looks like in use.
  await settle(`$('statusText').textContent === t('ready')`, 'library idle');
  await settle(`document.querySelectorAll('[data-community-card]').length >= 6
    && !document.getElementById('communityNotice').textContent.trim()
    && [...document.querySelectorAll('#communityCards img')].every(i => i.complete && i.naturalWidth > 0)`, 'community grid');
  await wait(1200);
  await dumped('grid');
  await shot('10-community.png');

  // A card that has both a report and a comment on it, so the thread is real.
  const key = await run(`(() => {
    const cards = [...document.querySelectorAll('[data-community-card]')];
    // One whose report carries prose, not just hardware chips: the card badge
    // counts those, so "1 comment" is the promise of something to read.
    const wanted = cards.find(c => /[1-9]\d* comment/.test(c.textContent));
    return (wanted || cards[0]).dataset.communityCard;
  })()`);
  console.log('  card:', key);
  await run(`document.querySelector('[data-community-card="' + ${JSON.stringify(key)} + '"]').click(); true`);
  await settle(`document.getElementById('communityCardDialog').open && document.querySelectorAll('[data-thread]').length > 0`, 'card opened');
  await settle(`[...document.querySelectorAll('#communityCardDialog img')].every(i => i.complete && i.naturalWidth > 0)`, 'card artwork');
  await wait(900);
  await dumped('card');
  await shot('11-community-card.png');

  await run(`document.getElementById('communityCardDialog').close(); true`);
  await settle(`!document.getElementById('communityCardDialog').open`, 'card closed');
  await wait(500);

  // The menu the app draws itself, on a game this install has already reported:
  // that is the one that says Edit and Remove rather than Send.
  await run(`show('games'); true`);
  await settle(`document.querySelectorAll('#groups .card').length > 0`, 'game cards');
  const picked = await run(`(() => {
    const cards = [...document.querySelectorAll('#groups .card')];
    const mine = cards.find(c => window.communityUi.reportFor(c.dataset.dir));
    const card = mine || cards[0];
    card.scrollIntoView({ block: 'center' });
    return JSON.stringify({ dir: card.dataset.dir, reported: !!mine });
  })()`);
  console.log('  menu on:', picked);
  await wait(600);
  await run(`(() => {
    const dir = ${JSON.stringify('')} + JSON.parse(${JSON.stringify(picked)}).dir;
    const card = [...document.querySelectorAll('#groups .card')].find(c => c.dataset.dir === dir);
    const box = card.getBoundingClientRect();
    card.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true, cancelable: true,
      clientX: Math.round(box.left + box.width / 2), clientY: Math.round(box.top + box.height / 2)
    }));
    return true;
  })()`);
  await settle(`!document.getElementById('gameMenu').hidden && document.getElementById('gameMenu').offsetHeight > 0`, 'game menu');
  await wait(700);
  await dumped('menu');
  await shot('12-games-menu.png');
  await run(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true`);
  await wait(500);
  await run(`show('community'); true`);
  await settle(`document.querySelectorAll('[data-community-card]').length >= 6`, 'back on community');
  await wait(600);

  await run(`document.getElementById('communityCardDialog').close(); true`);
  await settle(`!document.getElementById('communityCardDialog').open`, 'card closed');
  await wait(600);

  // The report sheet, on a game from the real library, so it wears that game's
  // own colours the way it does in use.
  const dir = await run(`(state.games.find(g => g.poster) || state.games[0] || {}).dir || null`);
  if (dir) {
    console.log('  report sheet for:', dir);
    await run(`window.communityUi.openReport(${JSON.stringify(dir)}); true`);
    await settle(`document.getElementById('communityReportDialog').open`, 'report dialog');
    await settle(`[...document.querySelectorAll('#communityReportDialog img')].every(i => i.complete && i.naturalWidth > 0)`, 'report artwork');
    await wait(1200);
    await dumped('report');
    await shot('13-community-report.png');
  } else console.log('  no game in the library for the report sheet');

  // Settings: the name and icon a person is signed with, and the switch that
  // decides whether Windows says anything at all.
  await run(`document.querySelectorAll('dialog[open]').forEach(d => d.close()); show('settings'); true`);
  await settle(`document.getElementById('settings').textContent.length > 200`, 'settings drawn');
  await run(`(() => {
    const block = [...document.querySelectorAll('#settings *')]
      .find(el => /community|notification/i.test(el.textContent) && el.children.length && el.textContent.length < 900);
    if (block) block.scrollIntoView({ block: 'center' });
    return true;
  })()`);
  await wait(900);
  await dumped('settings');
  await shot('14-settings-community.png');

  console.log('done');
  app.exit(0);
}).catch((error) => die(error && error.stack || String(error)));

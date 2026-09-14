'use strict';
// What was promised on the tracker for the next release, each pinned where it
// lives so it cannot quietly come undone.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('DirectDraw gets dgVoodoo the way DX8 and DX9 do (#292, #279, #150)', () => {
  assert.match(read('main.js'),
    /if \(api === 'd3d8' \|\| api === 'd3d9' \|\| api === 'ddraw'\) \{\s*try \{\s*p\.source\.feeder\.dgVoodooDir = await ensureDgVoodoo/);
});

test('the overlay message no longer claims an install that has not finished (#275, #292)', () => {
  const i18n = read('src', 'renderer', 'i18n.js');
  assert.doesNotMatch(i18n, /DLSS was installed normally/);
  assert.match(i18n, /overlaySkipped: \(error\) => `The in-game overlay will not be installed/);
});

test('the driver warning says "may", because it is a warning (#300, #278, #270)', () => {
  const i18n = read('src', 'renderer', 'i18n.js');
  assert.doesNotMatch(i18n, /cannot run the neural pass/);
  assert.match(i18n, /MSI Afterburner and RivaTuner closed/);
});

test('a game folder Windows will not let us write to is refused in words, up front (#301)', () => {
  assert.match(read('src', 'core', 'backend-manager.js'),
    /if \(!core\.canWrite\(config\.gameDir\)\) throw Object\.assign\(new Error\('errNoWriteAccess'\), \{ code: 'errNoWriteAccess' \}\);/);
  assert.equal((read('src', 'renderer', 'i18n.js').match(/errNoWriteAccess: '/g) || []).length, 3, 'in the three languages i18n.js carries: English, Arabic and Simplified Chinese');
});

test('every installed game has its read-only ReShade.ini cleared once per start (#155)', () => {
  const main = read('main.js');
  assert.match(main, /function repairReadOnlyConfigs\(games\)/);
  assert.match(main, /repairReadOnlyConfigs\(lastGames\);\s*return lastGames;/);
});

test('a report carries the store id the library already knew (#274)', () => {
  const main = read('main.js');
  assert.match(main, /storeId: g\.id \? String\(g\.id\) : null,/);
  assert.match(main, /storeId: store && game\.storeId \? game\.storeId : null/);
});

test('the uninstaller says uninstalling does not restore games (#266)', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.build.nsis.include, 'build/installer.nsh');
  const script = read('build', 'installer.nsh');
  assert.match(script, /!macro customUnInit/);
  assert.match(script, /Restore originals/);
  assert.match(script, /isUpdated/, 'and it stays out of the way of an update');
});

test('the community page carries its new controls, hidden until the server offers them', () => {
  const html = read('src', 'renderer', 'index.html');
  assert.match(html, /<label id="communityGpuField" hidden>/);
  assert.match(html, /<label id="communitySortField" hidden>/);
  assert.match(html, /id="communityScope" role="group" hidden/);
  for (const scope of ['all', 'mine', 'reports']) assert.match(html, new RegExp(`data-scope="${scope}"`));
  const page = read('src', 'renderer', 'community.js');
  assert.match(page, /if \(!state\.features\.includes\('gpu'\)\) delete filters\.gpu;/);
  assert.match(page, /scope === 'all' \? window\.lab\.communityCards\(filters\) : window\.lab\.communitySearch\(filters, scope\)/);
  const preload = read('preload.js');
  assert.match(preload, /communitySearch: \(filters, scope\) => ipcRenderer\.invoke\('community-search', filters, scope\)/);
  assert.match(preload, /communityForGame: \(dir\) => ipcRenderer\.invoke\('community-for-game', dir\)/);
  assert.match(preload, /communityGpus: \(\) => ipcRenderer\.invoke\('community-gpus'\)/);
});

// The "You" on the My games button: a second key called \`mine\` in the same
// table silently replaced the first. One name, one meaning.
test('no label on the community page is defined twice', () => {
  const page = read('src', 'renderer', 'community.js');
  for (const lang of ['en', 'ar']) {
    const start = page.indexOf(`    ${lang}: {`);
    const end = page.indexOf('\n    }', start);
    const block = page.slice(start, end).replace(/facts: \{[^}]*\}/, '');
    const keys = [...block.matchAll(/(?:^|[,{\s])([a-zA-Z][a-zA-Z0-9]*):\s/g)].map(match => match[1]).slice(1);
    const twice = keys.filter((key, index) => keys.indexOf(key) !== index);
    assert.deepEqual([...new Set(twice)], [], lang);
  }
});

test('the game sheet shows what the community found, before installing', () => {
  const renderer = read('src', 'renderer', 'renderer.js');
  assert.match(renderer, /<div class="sheet-community" id="sheetCommunity" hidden><\/div>/);
  assert.match(renderer, /queueMicrotask\(\(\) => fillSheetCommunity\(g, dir\)\);/);
  assert.match(read('main.js'), /ipcMain\.handle\('community-for-game'/);
  assert.equal((read('src', 'renderer', 'i18n.js').match(/sheetCommunityTitle: '/g) || []).length, 3, 'in the three languages i18n.js carries: English, Arabic and Simplified Chinese');
});

// Somebody names you in the chat, answers you there, or likes what you wrote:
// each is a Windows notification now, and clicking a chat one opens the chat on
// that message.
test('reactions and chat reach you as notifications', () => {
  const client = read('src', 'community-client.js');
  assert.match(client, /\/v1\/me\/notices\?since=\$\{since\}&include=chat,reaction/);
  const page = read('src', 'renderer', 'community.js');
  for (const kind of ['reaction', 'chat-mention', 'chat-reply', 'chat-reaction']) {
    assert.match(page, new RegExp(`notice\\.kind === '${kind}'`), kind);
  }
  for (const key of ['noticeReacted', 'noticeChatMention', 'noticeChatReply', 'noticeChatReaction']) {
    assert.equal((page.match(new RegExp(`${key}: `, 'g')) || []).length, 2, `${key} in English and Arabic`);
  }
  assert.match(page, /if \(notice\?\.chat\) \{\s*document\.querySelector\('\[data-view="chat"\]'\)\?\.click\(\);\s*await window\.chatUi\?\.focusMessage\?\.\(notice\.chat\);/);
  assert.match(read('src', 'renderer', 'chat.js'), /window\.chatUi = \{ render, stopPolling, applyLanguage, focusMessage \};/);
});

// Seen on the live server: Hogwarts, GTA V and a dozen more showed twice under
// My games, because each has a card filed by executable and an older one filed
// by title. One game, one card.
test('My games shows each game once, on its fullest card', () => {
  const page = read('src', 'renderer', 'community.js');
  assert.match(page, /if \(scope === 'mine'\) \{\s*const best = new Map\(\);/);
  assert.match(page, /state\.cards = state\.cards\.filter\(card => !card\.local \|\| best\.get\(card\.local\) === card\);/);
  // And the choice runs before the "no reviews yet" list is worked out from it.
  assert.ok(page.indexOf('const best = new Map();') < page.indexOf('state.unreported = scope ==='), 'dedupe first');
});

// Seen in the running app: switching to Everyone and choosing "My card" at once
// sent two requests, and the older, unfiltered answer landed last and painted
// over the filtered one. Only the newest request may paint.
test('a late answer never paints over a newer filter', () => {
  const page = read('src', 'renderer', 'community.js');
  assert.match(page, /const ticket = state\.renderTicket = \(state\.renderTicket \|\| 0\) \+ 1;/);
  assert.match(page, /\]\);\s*if \(ticket !== state\.renderTicket\) return;\s*\$\('communityRefresh'\)\.disabled = false;/);
});

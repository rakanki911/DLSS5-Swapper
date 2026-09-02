'use strict';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const { t, setLang, getLang, dirOf, LANGS } = window.i18n;
const state = { games: [], recents: [], newDlss: null, log: [], theme: 'light', lang: 'en', logo: {} };

const ORDER = ['Steam', 'Epic Games', 'GOG', 'Added by hand', 'My folders'];
const rank = (l) => (ORDER.indexOf(l) === -1 ? ORDER.length : ORDER.indexOf(l));
const short = (v) => (v ? String(v).replace(/\.0$/, '') : null);
const initials = (name) =>
  name.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

const ICON = {
  exe: '<svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>',
  dlss: '<svg viewBox="0 0 24 24"><path d="M3 12h4l2.5-6 4 12 2.5-6h5"/></svg>',
  detect: '<svg viewBox="0 0 24 24"><path d="M12 3l8 4.5-8 4.5-8-4.5z"/><path d="M4 12l8 4.5 8-4.5M4 16.5l8 4.5 8-4.5"/></svg>',
  addon: '<svg viewBox="0 0 24 24"><path d="M14 4h4a2 2 0 0 1 2 2v4"/><path d="M4 10V6a2 2 0 0 1 2-2h4"/><rect x="4" y="12" width="8" height="8" rx="2"/><path d="M16 12v8m4-4h-8"/></svg>'
};

// ---------------- log ----------------

const TICK = '<svg viewBox="0 0 24 24" style="width:15px;height:15px"><path d="M5 12.5 9.5 17 19 7.5"/></svg>';
// Under ten megabytes a whole number rounds a 0.4 MB add-on down to "0 MB".
const MB = (bytes) => {
  const mb = bytes / 1048576;
  return (mb < 10 ? mb.toFixed(1) : Math.round(mb)) + ' MB';
};

function log(message) {
  state.log.push({ t: new Date().toLocaleTimeString('en-GB'), m: message });
  renderLog();
}

function renderLog() {
  $('log').innerHTML = state.log.length
    ? state.log.slice(-40).map((e) => `<div class="log-row"><i></i><span class="t">[${e.t}]</span><span class="m">${esc(e.m)}</span></div>`).join('')
    : `<p class="empty">${t('logEmpty')}</p>`;
  $('log').scrollTop = $('log').scrollHeight;
}

function setStatus(text, percent) {
  $('statusText').textContent = text;
  if (percent !== undefined) $('statusBar').style.width = Math.round(percent) + '%';
}

// ---------------- views ----------------

function show(view) {
  for (const s of document.querySelectorAll('.view')) s.classList.toggle('active', s.id === 'view-' + view);
  for (const b of document.querySelectorAll('.nav-item')) b.classList.toggle('active', b.dataset.view === view);
  if (view === 'history') renderHistory();
  if (view === 'settings') renderSettings();
  if (view === 'addons') renderAddons();
}

// ---------------- recent game ----------------

function tile(icon, key, value, sub, on) {
  return `<div class="tile">${icon}<div><div class="k">${key}</div><div class="v${on ? ' on' : ''}">${esc(value)}</div>${sub ? `<div class="s">${esc(sub)}</div>` : ''}</div></div>`;
}

// "2 min ago", "1 day ago" - close enough without a date library.
function ago(ts) {
  const sec = Math.max(0, (Date.now() - ts) / 1000);
  if (sec < 60) return t('agoNow');
  const mins = Math.floor(sec / 60);
  if (mins < 60) return t('agoMin', mins);
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('agoHour', hours);
  const days = Math.floor(hours / 24);
  return t('agoDay', days);
}

// A game counts as done when the add-on is in place and its DLSS matches the
// payload; that is what the pip reports.
function isReady(g) {
  const s = g && g.cached;
  return Boolean(s && s.addon && (
    s.bitness === 32 || (s.dlss && state.newDlss && s.dlss === state.newDlss)
  ));
}

function renderRecent() {
  const rows = state.recents
    .map((r) => ({ at: r.at, game: state.games.find((g) => g.dir === r.dir) }))
    .filter((r) => r.game)
    .slice(0, 8);

  if (!rows.length) {
    $('recents').innerHTML = `<p class="empty">${t('recentEmpty')}</p>`;
    return;
  }

  $('recents').innerHTML = rows.map(({ at, game }) => `
    <article class="rcard" data-dir="${esc(game.dir)}">
      ${game.poster ? `<img src="${game.poster.url}" alt="">` : `<div class="initials">${esc(initials(game.name))}</div>`}
      <div class="meta">
        <div class="title">${esc(game.name)}</div>
        <div class="when"><span class="ago">${ago(at)}</span><i class="pip${isReady(game) ? ' on' : ''}"></i></div>
      </div>
    </article>`).join('');
}

// Why a folder cannot be patched. These arrive from the scanner as codes, and
// a card was literally showing "no-graphics-exe" to the reader. An unknown code
// falls through as itself so a new one is visible rather than silently blank.
const REASONS = {
  installer: 'rInstaller',
  'no-exe': 'rNoExe',
  'no-graphics-exe': 'rNoGraphics',
  'xbox-protected': 'rXboxProtected',
  error: 'rError'
};
const reasonText = (code) => (code ? (REASONS[code] ? t(REASONS[code]) : code) : null);

// ---------------- games grid ----------------

function cardMarkup(g) {
  const s = g.cached;
  const api = s ? (s.api || reasonText(s.reason) || '—') : t('scanning');
  const dx12 = Boolean(s && s.dx12);
  const status = s && s.ok
    ? `<span class="dot-s ${s.dlss ? 'on' : ''}"></span>${s.dlss ? short(s.dlss) : t('noDlss')}
       <span class="dot-s ${s.addon ? 'on' : ''}" style="margin-inline-start:8px"></span>${t('addonShort')}`
    : '';
  const strip = status ? `<div class="status">${status}</div>` : '';
  const poster = g.poster
    ? `<div class="poster${g.poster.tall ? '' : ' wide'}"${g.poster.tall ? '' : ` style="--bgimg:url('${g.poster.url}')"`}>
         <img src="${g.poster.url}" alt="">${strip}</div>`
    : `<div class="poster"><div class="placeholder">${initials(g.name)}</div>${strip}</div>`;

  return `
    <article class="card${dx12 ? ' dx12' : ''}${s && !s.ok ? ' unsupported' : ''}" data-dir="${esc(g.dir)}">
      <div class="tools">
        <button class="tool" data-act="poster" title="Poster">🖼</button>
        <button class="tool" data-act="open" title="Open">📂</button>
        <button class="tool" data-act="hide" title="Hide">✕</button>
      </div>
      <span class="badge${dx12 ? ' dx12' : ''}">${esc(api)}</span>
      ${poster}
      <div class="name">${esc(g.name)}</div>
    </article>`;
}

function renderGames() {
  const groups = {};
  for (const g of state.games) (groups[g.launcher] ||= []).push(g);

  $('groups').innerHTML = Object.entries(groups)
    .sort((a, b) => rank(a[0]) - rank(b[0]))
    .map(([launcher, list]) => {
      const ready = list.filter((g) => g.cached && g.cached.dx12).length;
      return `<section class="group">
        <div class="group-head"><h4>${esc(launcher)}</h4><span class="count">${list.length}</span>
        <span class="ready">${t('readyFor', ready)}</span></div>
        <div class="grid">${list.map(cardMarkup).join('')}</div>
      </section>`;
    }).join('');

  const scanned = state.games.filter((g) => g.cached).length;
  const dx12 = state.games.filter((g) => g.cached && g.cached.dx12).length;
  $('gamesCount').textContent = t('found', state.games.length, dx12);
  setStatus(scanned < state.games.length ? t('scanning') : t('ready'), (scanned / Math.max(state.games.length, 1)) * 100);
}

// ---------------- history / settings ----------------

async function renderHistory() {
  const rows = await window.lab.history();
  $('history').innerHTML = rows.length
    ? rows.map((r) => `<div class="hist-row">
        <div class="n">${esc(r.name)}${r.undone ? ` <span class="undone">${t('restored')}</span>` : ''}
          <div class="d">${esc(r.dir)}</div></div>
        <div class="c">${t('replacedAdded', r.replaced, r.added)}</div>
        <div class="d">${new Date(r.date).toLocaleString('en-GB')}</div>
      </div>`).join('')
    : `<div class="pad" style="color:var(--dim);font-size:13.5px">${t('histEmpty')}</div>`;
}

// ---------------- add-on builds ----------------

async function renderAddons() {
  const rows = await window.lab.addons();
  $('addonList').innerHTML = rows.length ? rows.map((a) => `
    <div class="addon${a.active ? ' on' : ''}">
      <div class="mark">${a.active ? TICK : ''}</div>
      <div class="body">
        <div class="t">${esc(a.label)}${a.replaces ? `<span class="tag">${t('addonReplaces')}</span>` : ''}${
          a.warn ? `<span class="tag warn">${esc(a.warn)}</span>` : ''}${
          a.caution ? `<span class="tag warn">${t(a.caution)}</span>` : ''}</div>
        <div class="d">${esc(a.file)}${a.version ? ' · ' + esc(a.version) : ''} · ${MB(a.size)}</div>
        ${a.notes ? `<ul class="notes">${a.notes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      </div>
      <button class="toggle" role="switch" aria-checked="${a.active}" data-path="${esc(a.path)}"
              title="${a.active ? t('addonDeactivate') : t('addonActivate')}">
        <span class="knob"></span>
      </button>
      ${a.custom
        ? `<button class="drop" data-remove="${esc(a.path)}" title="${t('addonRemove')}">
             <svg viewBox="0 0 24 24" style="width:15px;height:15px"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>
           </button>`
        : ''}
    </div>`).join('') : `<p class="hint">${t('logEmpty')}</p>`;

  const set = async (b, file, on) => {
    b.disabled = true;
    const res = await window.lab.addonToggle(file, on);
    if (!res.ok) { log(res.message); b.disabled = false; return; }
    // Only reported when one build had to step aside for another's file name.
    if (res.replaced) log(t('addonNameClash', res.replaced));
    renderAddons();
  };
  // Each switch stands on its own: turning one on leaves the others as they are.
  for (const b of $('addonList').querySelectorAll('.toggle')) {
    b.onclick = () => set(b, b.dataset.path, b.getAttribute('aria-checked') !== 'true');
  }
  // Only builds added by hand can be dropped; the ones found in folders and the
  // one shipped with the app are not the list's to delete.
  for (const b of $('addonList').querySelectorAll('[data-remove]')) {
    b.onclick = async () => {
      b.disabled = true;
      await window.lab.addonRemove(b.dataset.remove);
      renderAddons();
    };
  }
}

// Picking a file only opens the dialog; nothing is saved until it is confirmed,
// so a mis-click costs nothing.
let pendingAddon = null;

function closeDialog() {
  $('dlgOverlay').classList.add('hidden');
  pendingAddon = null;
}

$('addonAdd').onclick = async () => {
  const picked = await window.lab.addonPick();
  if (!picked) return;
  if (picked.error) { log(picked.error); return; }

  pendingAddon = picked;
  $('dlgFile').textContent =
    picked.file + (picked.version ? ' · ' + picked.version : '') + ' · ' + MB(picked.size);
  $('dlgName').value = picked.suggestedName || '';
  $('dlgDesc').value = '';
  $('dlgTag').value = '';
  $('dlgOverlay').classList.remove('hidden');
  $('dlgName').focus();
  $('dlgName').select();
};

$('dlgCancel').onclick = closeDialog;
$('dlgOverlay').onclick = (e) => { if (e.target === $('dlgOverlay')) closeDialog(); };
$('dlgSave').onclick = async () => {
  if (!pendingAddon) return;
  await window.lab.addonSave({
    path: pendingAddon.path,
    name: $('dlgName').value,
    description: $('dlgDesc').value,
    tag: $('dlgTag').value
  });
  closeDialog();
  renderAddons();
};

async function renderSettings() {
  const info = await window.lab.settings();
  $('settings').innerHTML = `
    <div class="set-row"><div><div class="k">${t('setAutoScan')}</div>
      <div class="v">${t('setAutoScanHint')}</div></div>
      <button class="setting-switch" id="setAutoScan" type="button" role="switch"
        aria-checked="${info.autoScanDrives ? 'true' : 'false'}" aria-label="${t('setAutoScan')}">
        <span class="knob"></span>
      </button></div>
    <div class="set-row"><div><div class="k">${t('setRoots')}</div>${
        (info.roots || []).length
          ? `<div class="paths">${info.roots.map((f) => `
              <div class="path-row"><span>${esc(f)}</span>
                <button class="drop" data-unroot="${esc(f)}" title="${t('addonRemove')}">
                  <svg viewBox="0 0 24 24" style="width:14px;height:14px"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>
                </button></div>`).join('')}</div>`
          : `<div class="v">—</div>`}</div>
      <span class="d">${(info.roots || []).length}</span></div>
    <div class="set-row"><div><div class="k">${t('setFolders')}</div>
        ${info.folders.length
          ? `<div class="paths">${info.folders.map((f) => `
              <div class="path-row"><span>${esc(f)}</span>
                <button class="drop" data-unfolder="${esc(f)}" title="${t('addonRemove')}">
                  <svg viewBox="0 0 24 24" style="width:14px;height:14px"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>
                </button></div>`).join('')}</div>`
          : `<div class="v">—</div>`}
      </div>
      <button class="ghost sm" id="setAddFolder">${t('setAdd')}</button></div>
    <div class="set-row"><div><div class="k">${t('setLibrary')}</div><div class="v">${esc(info.stateFile)}</div></div>
      <button class="ghost sm" id="setReset">${t('setReset')}</button></div>
    <div class="set-row"><div><div class="k">${t('setPosters')}</div><div class="v">${esc(info.posterDir)}</div></div>
      <span class="d">${t('setSaved', info.posterCount)}</span></div>`;
  $('setAutoScan').onclick = async () => {
    const toggle = $('setAutoScan');
    const enabled = toggle.getAttribute('aria-checked') !== 'true';
    toggle.setAttribute('aria-checked', String(enabled));
    toggle.disabled = true;
    await window.lab.setAutoScanDrives(enabled);
    await load();
    await renderSettings();
  };
  $('setAddFolder').onclick = async () => { if (await window.lab.addFolder()) load(); };
  for (const b of $('settings').querySelectorAll('[data-unroot]')) {
    b.onclick = async () => {
      b.disabled = true;
      await window.lab.excludeRoot(b.dataset.unroot);
      renderSettings();
      load();
    };
  }
  // A folder added for a quick look has to be removable, or the library is
  // stuck with it.
  for (const b of $('settings').querySelectorAll('[data-unfolder]')) {
    b.onclick = async () => {
      b.disabled = true;
      await window.lab.removeFolder(b.dataset.unfolder);
      renderSettings();
      load();
    };
  }
  $('setReset').onclick = async () => { await window.lab.reset(); load(); };
}

// ---------------- loading ----------------

async function scanAll() {
  const pending = state.games.filter((g) => !g.cached);
  for (const game of pending) {
    game.cached = await window.lab.scan(game.dir);
    renderGames();
    renderRecent();
  }
  setStatus(t('ready'), 100);
  log(t('libReady', state.games.length, state.games.filter((g) => g.cached && g.cached.dx12).length));
  fetchArt();
}

// Art is pulled for the whole grid rather than only when a game is opened, so
// the library fills in on its own. Steam's store is rate limited, so this walks
// one at a time and each result is cached on disk for next launch.
async function fetchArt() {
  if (!state.art) return;
  const missing = state.games.filter((g) => !g.poster || !g.poster.tall);
  if (!missing.length) return;

  let done = 0;
  setStatus(t('fetchingArt'), 0);
  for (const game of missing) {
    const art = await window.lab.artFetch(game.dir, game.name, game.appid);
    if (art && art.cover) {
      game.poster = { url: art.cover, tall: true, custom: false };
      renderGames();
      renderRecent();
    }
    setStatus(t('fetchingArt'), (++done / missing.length) * 100);
  }
  setStatus(t('ready'), 100);
  log(t('artFound', missing.filter((g) => g.poster && g.poster.tall).length, missing.length));
}

async function load() {
  setStatus(t('scanning'), 5);
  state.games = await window.lab.library();
  state.recents = await window.lab.recents();
  state.newDlss = (await window.lab.details(state.games[0] ? state.games[0].dir : '')).newDlss;
  renderGames();
  renderRecent();
  log(`Found ${state.games.length} games across ${new Set(state.games.map((g) => g.launcher)).size} sources`);
  await scanAll();
}

async function pickGame(dir) {
  log(`Scanning: ${dir}`);
  const cached = await window.lab.scan(dir);
  let game = state.games.find((g) => g.dir === dir);
  if (!game) {
    await window.lab.addGameByPath(dir);
    state.games = await window.lab.library();
    game = state.games.find((g) => g.dir === dir);
  }
  if (game) {
    game.cached = cached;
    renderGames();
    log(`Game: ${cached.exe || '—'} (${cached.api || 'unknown'})`);
    openSheet(dir);
  }
}


// ---------------- game sheet ----------------

let sheetGame = null;
let sheetDetails = null;
let jobLines = [];
const jobHistory = new Map();
let jobDir = null;
// Which executable the sheet is pointed at, kept per folder so re-rendering
// the sheet - a language switch does that - does not silently reset the choice.
const exeChoice = new Map();
const routeChoice = new Map();
const apiChoice = new Map();

// One row per fact, in a single panel. A wrapping grid of bordered tiles left
// an orphan on its own line whenever the count was odd, and repeated the same
// border and background six times over.
function spec(k, valueHtml, tone, full) {
  return `<div class="spec"><span class="k">${k}</span>` +
    `<span class="v${tone ? ' ' + tone : ''}"${full ? ` title="${esc(full)}"` : ''}>${valueHtml}</span></div>`;
}

// "3.7.20.0 -> 310.8.0.0" says what the swap does in one line; two separate
// rows made the reader hold one number in their head to compare it with the
// other. Nothing to change means no arrow at all.
function dlssValue(have, next, upToDate) {
  if (!next) return `<span>${esc(have || '—')}</span>`;
  if (upToDate) return `<span class="on">${esc(next)}</span>`;
  return `<span class="was">${esc(have || t('none'))}</span>` +
    `<span class="arrow">→</span><span class="on">${esc(next)}</span>`;
}

const exeLine = (e) => `${e.rel}  —  ${e.apiLabel}  —  ${e.bitness || '?'}-bit  —  ${MB(e.size)}`;

function chosenExe(d, dir) {
  const want = exeChoice.get(dir);
  return d.exes.find((e) => e.path === want) || d.exes[0] || null;
}

// One executable is not a choice, so the control only appears when the folder
// really does hold more than one - a launcher plus the game, most often.
function exePicker(d, dir) {
  if (d.exes.length < 2) return '';
  const chosen = chosenExe(d, dir);
  return `
    <div class="exe-field">
      <div class="k">${t('fExe')}</div>
      <div class="exe-wrap">
        <button type="button" class="exe-select" id="exeSelect" aria-haspopup="listbox" aria-expanded="false">
          <span class="exe-value">${esc(exeLine(chosen))}</span>
          <svg class="chev" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="exe-menu hidden" id="exeMenu" role="listbox">
          ${d.exes.map((e) => `
            <button type="button" class="exe-option${e.path === chosen.path ? ' selected' : ''}"
                    data-path="${esc(e.path)}" role="option" title="${esc(e.rel)}">
              <span class="tick">${e.path === chosen.path ? '✓' : ''}</span>
              <span class="exe-name">${esc(e.rel)}</span>
              <span class="exe-meta"><span>${esc(e.apiLabel)}</span><span>${e.bitness || '?'}-bit · ${MB(e.size)}</span></span>
            </button>`).join('')}
        </div>
      </div>
    </div>`;
}

function selectedApi(pick, dir) {
  const choices = (pick && pick.apiChoices) || [];
  const wanted = apiChoice.get(dir);
  return choices.find((item) => item.api === wanted) || choices[0] || { api: pick.api, label: pick.apiLabel };
}

function routesFor(pick, api) {
  if (!pick) return ['native'];
  if (pick.bitness === 32 || pick.emulator) return ['feeder'];
  if (api === 'dxgi') return ['native', 'feeder'];
  if (api === 'd3d9') return ['native'];
  return ['feeder'];
}

function selectedRoute(d, pick, dir, api = selectedApi(pick, dir).api) {
  const routes = routesFor(pick, api);
  const wanted = routeChoice.get(dir);
  if (routes.includes(wanted)) return wanted;
  if (routes.includes(d.recommendedRoute)) return d.recommendedRoute;
  return routes[0];
}

function installOptions(d, pick, dir) {
  if (!pick) return '';
  const api = selectedApi(pick, dir);
  const route = selectedRoute(d, pick, dir, api.api);
  const apis = pick.apiChoices || [{ api: pick.api, label: pick.apiLabel }];
  const routes = routesFor(pick, api.api);
  return `
    <div class="install-options">
      ${apis.length > 1 ? `<label><span>${t('fApi')}</span><select id="apiChoice">${apis.map((item) =>
        `<option value="${esc(item.api)}"${item.api === api.api ? ' selected' : ''}>${esc(item.label)}</option>`).join('')}</select></label>` : ''}
      <label><span>${t('fRoute')}</span><select id="routeChoice">${routes.map((item) =>
        `<option value="${item}"${item === route ? ' selected' : ''}>${t(item === 'feeder' ? 'routeFeeder' : 'routeNative')}</option>`).join('')}</select></label>
    </div>
    ${pick.emulator ? `<div class="emu-note"><b>${esc(pick.emulator.name)} · ${esc(pick.emulator.system)}</b><span>${esc(pick.emulator.hint)}</span><span>${t('emulatorDepthHint')}</span></div>` : ''}`;
}

function jobLog(line) {
  jobLines.push(line);
  if (jobDir) jobHistory.set(jobDir, [...jobLines]);
  const box = document.querySelector('.job');
  if (box) { box.textContent = jobLines.join('\n'); box.scrollTop = box.scrollHeight; }
}

async function openSheet(dir) {
  const g = state.games.find((x) => x.dir === dir);
  if (!g) return;
  sheetGame = g;
  jobDir = dir;
  // Refreshing the sheet after an install used to clear the only useful copy
  // of a failure. Keep each game's result visible until the next attempt.
  jobLines = [...(jobHistory.get(dir) || [])];

  $('overlay').classList.remove('hidden');
  $('sheet').innerHTML = '<div class="pad" style="color:var(--dim)">Reading the folder…</div>';

  const [d, art] = await Promise.all([
    window.lab.details(dir),
    window.lab.artFetch(dir, g.name, g.appid)
  ]);
  if (sheetGame !== g) return;
  sheetDetails = d;
  if (!exeChoice.has(dir) && d.installedExe) {
    const installed = d.exes.find((item) => item.rel.toLowerCase() === String(d.installedExe).toLowerCase());
    if (installed) exeChoice.set(dir, installed.path);
  }
  if (!apiChoice.has(dir) && d.installedApi) apiChoice.set(dir, d.installedApi);
  if (!routeChoice.has(dir) && d.installedRoute) routeChoice.set(dir, d.installedRoute);

  const info = art && !art.error && !art.none ? art : null;
  const cover = (info && info.cover) || (g.poster && g.poster.tall ? g.poster.url : null);
  const hero = (info && info.hero) || (g.poster && !g.poster.tall ? g.poster.url : null);
  const upToDate = Boolean(d.newDlss && d.currentDlss && d.currentDlss.version === d.newDlss);
  // With a picker on screen the executable already has its own row, so the
  // fact tile would only repeat it.
  const pick = chosenExe(d, dir);
  const inGameDlss = (d.currentDlss && d.currentDlss.version) || null;
  const showExeFact = d.exes.length < 2;

  $('sheet').innerHTML = `
    <div class="hero${hero ? '' : ' empty'}">
      ${hero ? `<img src="${hero}" alt="">` : ''}
      <button class="close" id="sheetClose"><svg viewBox="0 0 24 24" style="width:14px;height:14px"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>
    <div class="sheet-body">
      <div class="head">
        <div class="cover">${cover ? `<img src="${cover}" alt="">` : esc(initials(g.name))}</div>
        <div class="who">
          <h3>${esc(info ? info.name : g.name)}</h3>
          <div class="meta">${[g.launcher, info && info.released, info && info.genres && info.genres.join(', '),
              info && info.rating ? info.rating + '/100' : null].filter(Boolean).map(esc).join(' · ')}</div>
          <div class="path">${esc(g.dir)}</div>
        </div>
      </div>

      ${info && info.summary ? `<p class="summary">${esc(info.summary.slice(0, 260))}${info.summary.length > 260 ? '…' : ''}</p>` : ''}

      ${exePicker(d, dir)}
      ${installOptions(d, pick, dir)}

      <div class="specs">
        ${showExeFact && pick ? spec(t('fExe'), esc(pick.rel.split(/[\/]/).pop()), null, pick.rel) : ''}
        ${pick ? spec(t('fArchitecture'), `${pick.bitness || '?'}-bit`) : ''}
        ${spec(t('fApi'), esc((pick && selectedApi(pick, dir).label) || reasonText(d.reason) || '—'), pick && selectedApi(pick, dir).api === 'dxgi' ? 'on' : 'off')}
        ${spec('DLSS', dlssValue(inGameDlss, d.newDlss, upToDate))}
        ${spec(t('fAddon'), esc(d.addon ? t('installed') : t('notPresent')), d.addon ? 'on' : 'off')}
        ${spec(t('fReShade'), esc(d.reshade.installed
            ? d.reshade.version + (d.reshade.addonSupport ? ' + ' + t('addonShort') : '')
            : t('notInstalled')), d.reshade.installed ? 'on' : 'off')}
      </div>

      ${d.files.length ? `<div class="filelist">${d.files.map((f) =>
        `<div class="filerow"><span class="f">${esc(f.rel)}</span><span class="v">${esc(f.version || '—')}</span></div>`).join('')}</div>` : ''}

      <div class="sheet-actions">
        <button class="btn-install" id="doInstall"${d.ok ? '' : ' disabled'}>${t('install')}</button>
        <button class="btn-restore" id="doRestore"${d.hasBackup ? '' : ' disabled'}>${t('restore')}</button>
      </div>
      <div class="job" id="job">${jobLines.join('\n') || t('jobReady')}</div>
      <button class="ghost sm job-copy" id="copyJob"${jobLines.length ? '' : ' disabled'}>Copy log</button>
    </div>`;

  $('sheetClose').onclick = closeSheet;
  wireExePicker(dir);
  const apiSelect = $('apiChoice');
  if (apiSelect) apiSelect.onchange = () => { apiChoice.set(dir, apiSelect.value); openSheet(dir); };
  const routeSelect = $('routeChoice');
  if (routeSelect) routeSelect.onchange = () => routeChoice.set(dir, routeSelect.value);
  $('doInstall').onclick = () => runJob('install', dir);
  $('doRestore').onclick = () => runJob('restore', dir);
  $('copyJob').onclick = async () => {
    const text = (jobHistory.get(dir) || []).join('\n');
    try { await navigator.clipboard.writeText(text); } catch { log(text); }
  };
}

function wireExePicker(dir) {
  const select = $('exeSelect');
  if (!select) return;
  const menu = $('exeMenu');

  select.onclick = (event) => {
    event.stopPropagation();
    const opening = menu.classList.contains('hidden');
    menu.classList.toggle('hidden', !opening);
    select.classList.toggle('open', opening);
    select.setAttribute('aria-expanded', String(opening));
  };
  menu.onclick = (event) => {
    const option = event.target.closest('.exe-option');
    if (!option) return;
    exeChoice.set(dir, option.dataset.path);
    apiChoice.delete(dir);
    routeChoice.delete(dir);
    openSheet(dir);
  };
}

async function runJob(kind, dir) {
  const install = $('doInstall');
  const restoreBtn = $('doRestore');
  install.disabled = restoreBtn.disabled = true;
  install.textContent = kind === 'install' ? t('installing') : t('install');
  jobLines = [];
  jobDir = dir;
  jobHistory.set(dir, []);
  jobLog(kind === 'install' ? '--- installing ---' : '--- restoring ---');

  const pick = sheetDetails ? chosenExe(sheetDetails, dir) : null;
  const res = kind === 'install'
    ? await window.lab.install(
      dir,
      exeChoice.get(dir) || null,
      pick ? selectedRoute(sheetDetails, pick, dir) : null,
      pick ? selectedApi(pick, dir).api : null
    )
    : await window.lab.restoreGame(dir);
  install.textContent = t('install');

  if (res.ok) {
    jobLog(kind === 'install' ? `done - ${res.replaced} replaced, ${res.added} added` : 'done - originals restored');
    log(`${kind === 'install' ? 'Installed' : 'Restored'}: ${dir}`);
    // Recent Games tracks what was actually swapped, not what was browsed.
    state.recents = await window.lab.touch(dir);
    renderRecent();
    const g = state.games.find((x) => x.dir === dir);
    if (g) { g.cached = await window.lab.scan(dir); renderGames(); renderRecent(); }
    setTimeout(() => openSheet(dir), 400);
  } else {
    jobLog('FAILED: ' + (res.message || res.code || 'Unknown error'));
    if (res.code && res.code !== res.message) jobLog('code: ' + res.code);
    if (res.params && res.params.output) jobLog('setup output:\n' + String(res.params.output).slice(-4000));
    if (res.params && !res.params.output && Object.keys(res.params).length) jobLog('details: ' + JSON.stringify(res.params));
    log(`Failed: ${dir} — ${res.message || res.code || 'Unknown error'}`);
    install.disabled = false;
    // A failed external ReShade setup can still have changed files. Re-read
    // the manifest so Restore originals becomes available immediately.
    setTimeout(() => openSheet(dir), 250);
  }
}

function closeSheet() {
  sheetGame = null;
  sheetDetails = null;
  $('overlay').classList.add('hidden');
}

// ---------------- events ----------------

$('nav').onclick = (e) => {
  const b = e.target.closest('.nav-item');
  if (b) show(b.dataset.view);
};
document.querySelector('.link[data-view]').onclick = () => show('games');

// The wordmark is black artwork, so the dark theme gets the lifted copy.
function paintBrand() {
  const art = state.theme === 'dark' ? (state.logo.logoDark || state.logo.logo) : state.logo.logo;
  $('brand').innerHTML = art
    ? `<img src="${art}" alt="DLSS 5 Swapper">`
    : '<b style="font-size:19px">DLSS 5 Swapper</b>';
}

// ---------------- language ----------------

function applyLang(code) {
  state.lang = setLang(code);
  document.documentElement.lang = state.lang;
  document.documentElement.dir = dirOf(state.lang);
  $('langLabel').textContent = state.lang.toUpperCase();

  for (const node of document.querySelectorAll('[data-i18n]')) {
    node.textContent = t(node.dataset.i18n);
  }
  // Anything drawn from data has to be rebuilt, not just relabelled.
  renderLog();
  renderRecent();
  renderGames();
  const view = document.querySelector('.view.active');
  if (view && view.id === 'view-history') renderHistory();
  if (view && view.id === 'view-settings') renderSettings();
  if (view && view.id === 'view-addons') renderAddons();
  if (sheetGame) openSheet(sheetGame.dir);
}

// With this many languages a plain list is a long scroll, so the menu filters
// as you type. The filter matches the native name, the English name and the
// code, because someone looking for Greek may type any of the three.
function langRows(filter) {
  const q = filter.trim().toLowerCase();
  const rows = q
    ? LANGS.filter((l) => `${l.native} ${l.label} ${l.code}`.toLowerCase().includes(q))
    : LANGS;
  if (!rows.length) return '<div class="lang-none">—</div>';
  return rows.map((l) => `
    <button class="lang-item${l.code === state.lang ? ' active' : ''}" data-lang="${l.code}">
      <span>${l.native}</span><span class="code">${l.code.toUpperCase()}</span>
    </button>`).join('');
}

function buildLangMenu(filter = '') {
  const menu = $('langMenu');
  if (!menu.querySelector('.lang-search')) {
    menu.innerHTML = '<input class="lang-search" type="text" spellcheck="false"><div class="lang-list"></div>';
    const box = menu.querySelector('.lang-search');
    box.oninput = () => { menu.querySelector('.lang-list').innerHTML = langRows(box.value); };
    box.onclick = (e) => e.stopPropagation();
  }
  const box = menu.querySelector('.lang-search');
  box.placeholder = t('setLang') + ' · ' + LANGS.length;
  box.value = filter;
  menu.querySelector('.lang-list').innerHTML = langRows(filter);
  return box;
}

$('langBtn').onclick = (e) => {
  e.stopPropagation();
  const box = buildLangMenu('');
  const menu = $('langMenu');
  menu.classList.toggle('hidden');
  if (!menu.classList.contains('hidden')) {
    box.focus();
    // Keep the current language in view when the list opens unfiltered.
    const active = menu.querySelector('.lang-item.active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }
};

$('langMenu').onclick = async (e) => {
  const item = e.target.closest('.lang-item');
  if (!item) return;
  $('langMenu').classList.add('hidden');
  applyLang(item.dataset.lang);
  await window.lab.setLang(state.lang);
};

document.addEventListener('click', () => {
  $('langMenu').classList.add('hidden');
  // The executable menu lives inside the sheet, so it is rebuilt often; look it
  // up each time rather than holding a reference.
  const exeMenu = $('exeMenu');
  if (exeMenu) {
    exeMenu.classList.add('hidden');
    $('exeSelect').classList.remove('open');
    $('exeSelect').setAttribute('aria-expanded', 'false');
  }
});

$('winMin').onclick = () => window.lab.window('minimize');
$('winClose').onclick = () => window.lab.window('close');

$('themeBtn').onclick = () => {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = state.theme;
  paintBrand();
  window.lab.setTheme(state.theme);
};

$('browseBtn').onclick = async () => {
  const dir = await window.lab.addGame();
  if (dir) { show('home'); pickGame(dir); }
};
$('addGame').onclick = async () => { const d = await window.lab.addGame(); if (d) load(); };
$('addFolder').onclick = async () => { if (await window.lab.addFolder()) load(); };
$('rescan').onclick = async () => {
  for (const g of state.games) g.cached = null;
  await load();
};
$('clearLog').onclick = () => { state.log = []; renderLog(); };

$('groups').onclick = async (event) => {
  const card = event.target.closest('.card');
  if (!card) return;
  const dir = card.dataset.dir;
  const act = event.target.closest('.tool')?.dataset.act;

  if (act === 'poster') {
    const url = await window.lab.setPoster(dir);
    if (url) {
      const g = state.games.find((x) => x.dir === dir);
      g.poster = { url, tall: true, custom: true };
      renderGames();
      renderRecent();
    }
  } else if (act === 'open') {
    window.lab.open(dir);
  } else if (act === 'hide') {
    await window.lab.hide(dir);
    state.games = state.games.filter((g) => g.dir !== dir);
    renderGames();
  } else {
    openSheet(dir);
  }
};

$('recents').onclick = (e) => {
  const card = e.target.closest('.rcard');
  if (card) openSheet(card.dataset.dir);
};

$('overlay').onclick = (e) => { if (e.target === $('overlay')) closeSheet(); };
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('dlgOverlay').classList.contains('hidden')) closeDialog();
  else closeSheet();
});
window.lab.onJob((e) => jobLog(`${e.code} ${JSON.stringify(e.params)}`));

const zone = $('dropZone');
['dragenter', 'dragover'].forEach((n) => zone.addEventListener(n, (e) => { e.preventDefault(); zone.classList.add('over'); }));
['dragleave', 'drop'].forEach((n) => zone.addEventListener(n, (e) => { e.preventDefault(); zone.classList.remove('over'); }));
zone.addEventListener('drop', (e) => {
  const f = e.dataTransfer.files[0];
  if (!f) return;
  const dir = window.lab.pathForFile(f);
  if (dir) pickGame(dir);
});
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());

(async () => {
  const boot = await window.lab.boot();
  state.theme = boot.theme || 'light';
  document.documentElement.dataset.theme = state.theme;
  applyLang(boot.lang || 'en');
  $('statusVersion').textContent = `v${boot.version}`;
  state.logo = boot;
  paintBrand();
  state.art = (await window.lab.artStatus()).available;
  // Artwork comes from Steam's public store endpoints, so there is nothing to
  // configure and nothing for the reader to act on.
  renderLog();
  load();
})();

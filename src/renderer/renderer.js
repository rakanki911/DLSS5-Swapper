'use strict';

const { t, setLang, getLang } = window.i18n;
const $ = (id) => document.getElementById(id);

const state = {
  source: null,
  sourceDir: null,
  sourceBundled: false,
  reshadeSetup: null,
  reshadeBundled: false,
  scan: null,
  exeIndex: 0,
  lastGame: null,
  appVersion: '',
  // Log entries are kept as codes so the whole log re-renders on a language
  // switch instead of freezing in whichever language it was written.
  entries: []
};

const ICON = {
  reshade: '<svg viewBox="0 0 24 24"><path d="M12 3l7.5 4.2v9.6L12 21l-7.5-4.2V7.2z"/><path d="M12 8.4l3.6 2v4l-3.6 2-3.6-2v-4z"/></svg>',
  addon: '<svg viewBox="0 0 24 24"><path d="M14 4h4a2 2 0 0 1 2 2v4"/><path d="M4 10V6a2 2 0 0 1 2-2h4"/><rect x="4" y="12" width="8" height="8" rx="2"/><path d="M16 12v8m4-4h-8"/></svg>',
  detect: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg>',
  driver: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10v4m4-4v4m4-4v4"/></svg>'
};

const ARROW = '<svg class="swap-arrow" viewBox="0 0 24 24"><path d="M4 12h15m0 0l-5.5-5.5M19 12l-5.5 5.5"/></svg>';
const TICK = '<svg class="tick" viewBox="0 0 24 24"><path d="M4 12.5l5.5 5.5L20 7"/></svg>';

// ---------- log ----------

function renderLog() {
  $('log').textContent = state.entries
    .map((e) => `[${e.time}] ${e.code === 'raw' ? e.args[0] : t(e.code, ...(e.args || []))}`)
    .join('\n');
  $('log').scrollTop = $('log').scrollHeight;
}

function log(code, ...args) {
  $('logCard').classList.remove('hidden');
  state.entries.push({ time: new Date().toLocaleTimeString('en-GB'), code, args });
  renderLog();
}

let toastTimer;
function toast(message, kind) {
  const el = $('toast');
  el.textContent = message;
  el.className = `toast ${kind || ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 4600);
}

// ---------- helpers ----------

function shortVersion(v) {
  if (!v) return '—';
  return v.replace(/\.0$/, '');
}

// Positive when a is newer than b; 0 when either side has no readable version.
function compareVersions(a, b) {
  const parse = (text) => {
    const m = String(text || '').match(/(\d+)\.(\d+)\.(\d+)/);
    return m ? m.slice(1).map(Number) : null;
  };
  const x = parse(a);
  const y = parse(b);
  if (!x || !y) return 0;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

// Says which of the three detection paths identified this executable.
function detectionLabel(exe) {
  if (!exe.via || exe.via === 'imports') return t('viaImports');
  if (exe.via === 'strings') return t('viaStrings');
  return t('viaModule', exe.via.slice(7));
}

function chip(icon, label, value, kind) {
  return `<span class="chip ${kind}">${icon}<span>${label}</span><b>${value}</b></span>`;
}

// ---------- language ----------

function applyLanguage(lang) {
  setLang(lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = t('dir');

  for (const node of document.querySelectorAll('[data-i18n]')) {
    node.textContent = t(node.dataset.i18n);
  }
  for (const node of document.querySelectorAll('[data-i18n-title]')) {
    node.title = t(node.dataset.i18nTitle);
  }
  for (const button of $('langSwitch').children) {
    button.classList.toggle('active', button.dataset.lang === lang);
  }

  renderSettings();
  renderLastGame();
  renderLog();
  if (state.scan && state.scan.chosen) renderStatus();
}

// ---------- boot ----------

async function boot() {
  const info = await window.api.boot();
  state.sourceDir = info.sourceDir;
  state.source = info.source;
  state.sourceBundled = info.sourceBundled;
  state.reshadeSetup = info.reshadeSetup;
  state.reshadeBundled = info.reshadeBundled;
  state.appVersion = info.appVersion;
  state.lastGame = info.lastGame;

  applyLanguage(info.language);
}

// Rebuilt on every language change so the label follows the UI, not the boot.
function renderLastGame() {
  const hint = $('lastGameHint');
  if (!state.lastGame) {
    hint.classList.add('hidden');
    return;
  }
  hint.classList.remove('hidden');
  hint.innerHTML = `${t('lastGame')} <a href="#" id="lastGameLink"></a>`;
  $('lastGameLink').textContent = state.lastGame;
  $('lastGameLink').onclick = (event) => {
    event.preventDefault();
    loadGame(state.lastGame);
  };
}

// A bundled path is an implementation detail - and for the portable build it is
// a random temp folder. Say where it is in words instead of printing it.
function showPath(id, value, bundled) {
  const el = $(id);
  el.textContent = bundled ? t('insideApp') : (value || t('notSet'));
  el.classList.toggle('plain', Boolean(bundled));
  el.title = bundled ? value || '' : '';
}

function renderSettings() {
  showPath('sourcePath', state.sourceDir, state.sourceBundled);
  $('appVersionLine').textContent = `DLSS 5 Swapper v${state.appVersion}`;
  $('sourceBundled').classList.toggle('hidden', !state.sourceBundled);
  $('reshadeBundled').classList.toggle('hidden', !state.reshadeBundled);

  const source = state.source;
  if (source && source.ok) {
    const parts = [t('sourceFiles', source.payload.length)];
    if (source.dlssVersion) parts.push(`DLSS ${shortVersion(source.dlssVersion)}`);
    parts.push(source.hasNeuralRendering ? t('sourceHasNr') : t('sourceNoNr'));
    parts.push(source.addon ? t('sourceHasAddon') : t('sourceNoAddon'));
    $('sourceStatus').textContent = parts.join(' • ');
  } else {
    $('sourceStatus').textContent = t((source && source.reason) || 'sourceEmpty');
    openSettings();
  }

  showPath('reshadePath', state.reshadeSetup || t('reshadeMissing'), state.reshadeBundled);
}

// ---------- game ----------

async function loadGame(dir) {
  log('scanning', dir);
  const scan = await window.api.scanGame(dir);
  state.scan = scan;
  state.lastGame = dir;

  if (!scan.chosen) {
    toast(t('scanFailedToast'), 'bad');
    log(scan.emptyReason || 'no-graphics-exe');
    return;
  }

  $('dropZone').classList.add('hidden');
  $('result').classList.remove('hidden');
  $('actionBar').classList.remove('hidden');
  document.body.classList.add('has-actions');
  $('gameName').textContent = scan.gameName;
  $('gameDir').textContent = scan.gameDir;

  state.exeIndex = 0;
  renderExePicker();

  renderStatus();
  $('restoreBtn').classList.toggle('hidden', !scan.hasBackup);
  log('gamePicked', scan.chosen.rel, scan.chosen.apiLabel, scan.exeCandidates.length);
}

function currentExe() {
  return state.scan.exeCandidates[state.exeIndex] || state.scan.exeCandidates[0];
}

function exeMeta(exe) {
  return `<span class="meta"><span>${exe.apiLabel}</span><span>${Math.round(exe.size / 1048576)} MB</span></span>`;
}

function renderExePicker() {
  const candidates = state.scan.exeCandidates;
  const chosen = currentExe();
  $('exeValue').textContent = `${chosen.rel}  —  ${chosen.apiLabel}  —  ${Math.round(chosen.size / 1048576)} MB`;

  $('exeMenu').innerHTML = candidates
    .map((exe, i) => `<button type="button" class="option${i === state.exeIndex ? ' selected' : ''}" data-index="${i}" role="option">
      ${TICK}<span class="name">${exe.rel}</span>${exeMeta(exe)}
    </button>`)
    .join('');

  // One executable is not a choice; hide the control rather than tease it.
  $('exeField').classList.toggle('hidden', candidates.length < 2);
}

function closeExeMenu() {
  $('exeMenu').classList.add('hidden');
  $('exeSelect').classList.remove('open');
  $('exeSelect').setAttribute('aria-expanded', 'false');
}

function renderSwap(scan) {
  const dlss = scan.dlssFiles.find((f) => /^nvngx_dlss\.dll$/i.test(f.name));
  const sourceOk = state.source && state.source.ok;
  const from = dlss ? shortVersion(dlss.version) : null;
  const to = sourceOk ? shortVersion(state.source.dlssVersion) : null;
  const same = from && to && from === to;

  const fromValue = from
    ? `<div class="swap-value">${from}</div>`
    : `<div class="swap-value small">${t('noDlssFile')}</div>`;
  const toValue = to
    ? `<div class="swap-value">${to}</div>`
    : `<div class="swap-value small">${t('sourceIncomplete')}</div>`;

  $('swapSummary').className = `swap${same ? ' same' : ''}`;
  $('swapSummary').innerHTML = `
    <div class="swap-side from">
      <div class="swap-label">${t('tileCurrentDlss')}</div>
      ${fromValue}
    </div>
    ${ARROW}
    <div class="swap-side to">
      <div class="swap-label">${t('tileNewDlss')}</div>
      ${toValue}
    </div>`;
}

function renderStatus() {
  const scan = state.scan;
  const exe = currentExe();
  const rs = scan.reshade;
  $('apiBadge').textContent = exe.apiLabel;

  renderSwap(scan);
  renderExePicker();

  const reshadeValue = rs.installed
    ? `${shortVersion(rs.version)}${rs.addonSupport ? t('withAddons') : t('withoutAddons')}`
    : t('notInstalled');

  $('chips').innerHTML = [
    chip(ICON.reshade, t('tileReShade'), reshadeValue, rs.installed ? (rs.addonSupport ? 'ok' : 'warn') : 'off'),
    chip(ICON.addon, t('tileAddon'), scan.addonPresent ? t('installed') : t('notPresent'), scan.addonPresent ? 'ok' : 'off'),
    chip(ICON.detect, t('tileDetection'), detectionLabel(exe), exe.dynamic ? 'warn' : 'ok')
  ].join('');

  const all = [...scan.dlssFiles, ...scan.streamlineFiles];
  const payload = new Map((state.source ? state.source.payload : []).map((f) => [f.name.toLowerCase(), f]));
  $('filesSummary').textContent = t('filesFound', all.length);
  $('filesList').innerHTML = all.length
    ? all
        .map((file) => {
          const next = payload.get(file.name.toLowerCase());
          const version = next && next.version !== file.version
            ? `<span class="vchip">${shortVersion(file.version)}</span><span class="arrow">→</span><span class="vchip new">${shortVersion(next.version)}</span>`
            : `<span class="vchip">${shortVersion(file.version)}</span>`;
          return `<div class="file-row"><span class="rel">${file.rel}</span><span class="ver">${version}</span></div>`;
        })
        .join('')
    : `<p class="hint">${t('noFilesFound')}</p>`;

  const setupVersion = state.reshadeSetup ? (state.reshadeSetup.match(/(\d+\.\d+\.\d+)/) || [])[1] : null;
  const olderThanSetup = rs.installed && setupVersion && compareVersions(setupVersion, rs.version) > 0;

  // Only a game that loads ReShade itself gets the in-place upgrade option;
  // dropping a dxgi.dll proxy next to an existing ReShade.asi runs two of them.
  $('optUpgradeRow').classList.toggle('hidden', !olderThanSetup);
  if (olderThanSetup) {
    $('optUpgradeLabel').textContent =
      rs.kind === 'asi'
        ? t('optUpgradeAsi', rs.file, shortVersion(rs.version), setupVersion)
        : t('optUpgradeProxy', shortVersion(rs.version), setupVersion);
  } else {
    $('optUpgradeReShade').checked = false;
  }

  const warnings = [];
  if (rs.installed && !rs.addonSupport) warnings.push(t('warnNoAddonSupport'));
  if (rs.kind === 'asi') warnings.push(t('warnAsi', rs.file));
  if (olderThanSetup) warnings.push(t('warnOlderReShade', shortVersion(rs.version)));
  if (exe.via === 'strings') warnings.push(t('warnDynamic'));
  if (exe.via && exe.via.startsWith('module:')) warnings.push(t('warnModule', exe.via.slice(7)));
  if (!state.reshadeSetup && (!rs.installed || !rs.addonSupport)) warnings.push(t('warnNoSetup'));
  if (exe.api !== 'dxgi') warnings.push(t('warnNotDx12', exe.apiLabel));
  if (scan.exeCandidates.length > 1) warnings.push(t('warnManyExes'));

  $('warnBox').innerHTML = warnings.map((w) => '• ' + w).join('<br>');
  $('warnBox').classList.toggle('hidden', warnings.length === 0);
}

// ---------- actions ----------

function describeFailure(result) {
  return result.code ? t(result.code, result.params) : result.message;
}

function setBusy(busy) {
  $('applyBtn').disabled = busy;
  $('applyBtn').classList.toggle('busy', busy);
  $('applyLabel').textContent = busy ? t('applying') : t('apply');
}

async function apply() {
  const exe = currentExe();
  setBusy(true);
  log('applyStart');

  const result = await window.api.apply({
    gameDir: state.scan.gameDir,
    exePath: exe.path,
    api: exe.api,
    source: state.source,
    reshadeSetup: state.reshadeSetup,
    installReShade: $('optReShade').checked,
    addMissingDlss: $('optAddDlss').checked,
    addStreamline: $('optStreamline').checked,
    upgradeReShade: $('optUpgradeReShade').checked
  });

  setBusy(false);

  if (result.ok) {
    const count = result.manifest.replaced.length + result.manifest.added.length;
    toast(t('doneToast', count), 'ok');
    await loadGame(state.scan.gameDir);
  } else {
    const message = describeFailure(result);
    log('raw', message);
    toast(message, 'bad');
  }
}

async function restoreGame() {
  $('restoreBtn').disabled = true;
  log('restoreStart');
  const result = await window.api.restore(state.scan.gameDir);
  $('restoreBtn').disabled = false;

  if (result.ok) {
    toast(t('restoreToast'), 'ok');
    await loadGame(state.scan.gameDir);
  } else {
    const message = describeFailure(result);
    log('raw', message);
    toast(message, 'bad');
  }
}

// ---------- settings sheet ----------

function openSettings() { $('settingsOverlay').classList.remove('hidden'); }
function closeSettings() { $('settingsOverlay').classList.add('hidden'); }

// ---------- wiring ----------

$('minBtn').onclick = () => window.api.window('minimize');
$('titlebar').ondblclick = (event) => {
  // Only the empty parts of the header maximise; controls keep their own job.
  if (!event.target.closest('button, .lang-switch')) window.api.window('maximize');
};
$('closeBtn').onclick = () => window.api.window('close');

$('langSwitch').onclick = async (event) => {
  const button = event.target.closest('button[data-lang]');
  if (!button || button.dataset.lang === getLang()) return;
  applyLanguage(button.dataset.lang);
  await window.api.setLanguage(button.dataset.lang);
};

$('settingsBtn').onclick = openSettings;
$('closeSettingsBtn').onclick = closeSettings;
$('settingsOverlay').onclick = (event) => {
  if (event.target === $('settingsOverlay')) closeSettings();
};
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  closeSettings();
  closeExeMenu();
});

$('pickGameBtn').onclick = async () => {
  const dir = await window.api.pickGame();
  if (dir) loadGame(dir);
};

$('pickSourceBtn').onclick = async () => {
  const picked = await window.api.pickSource();
  if (!picked) return;
  state.sourceDir = picked.dir;
  state.source = picked.source;
  state.sourceBundled = picked.bundled;
  renderSettings();
  if (state.scan && state.scan.chosen) renderStatus();
};

$('pickReshadeBtn').onclick = async () => {
  const file = await window.api.pickReShade();
  if (!file) return;
  state.reshadeSetup = file;
  state.reshadeBundled = false;
  renderSettings();
  if (state.scan && state.scan.chosen) renderStatus();
};

$('resetPathsBtn').onclick = async () => {
  const info = await window.api.resetPaths();
  Object.assign(state, {
    sourceDir: info.sourceDir,
    source: info.source,
    sourceBundled: info.sourceBundled,
    reshadeSetup: info.reshadeSetup,
    reshadeBundled: info.reshadeBundled
  });
  renderSettings();
  if (state.scan && state.scan.chosen) renderStatus();
};

$('exeSelect').onclick = (event) => {
  event.stopPropagation();
  const menu = $('exeMenu');
  const opening = menu.classList.contains('hidden');
  menu.classList.toggle('hidden', !opening);
  $('exeSelect').classList.toggle('open', opening);
  $('exeSelect').setAttribute('aria-expanded', String(opening));
};

$('exeMenu').onclick = (event) => {
  const option = event.target.closest('.option');
  if (!option) return;
  state.exeIndex = Number(option.dataset.index);
  closeExeMenu();
  renderExePicker();
  renderStatus();
};

document.addEventListener('click', closeExeMenu);

$('applyBtn').onclick = apply;
$('restoreBtn').onclick = restoreGame;
$('resetBtn').onclick = () => {
  state.scan = null;
  $('result').classList.add('hidden');
  $('actionBar').classList.add('hidden');
  document.body.classList.remove('has-actions');
  $('dropZone').classList.remove('hidden');
  renderLastGame();
};
$('openGameBtn').onclick = () => state.scan && window.api.openPath(state.scan.gameDir);

const zone = $('dropZone');
['dragenter', 'dragover'].forEach((name) =>
  zone.addEventListener(name, (event) => {
    event.preventDefault();
    zone.classList.add('over');
  })
);
['dragleave', 'drop'].forEach((name) =>
  zone.addEventListener(name, (event) => {
    event.preventDefault();
    zone.classList.remove('over');
  })
);
zone.addEventListener('drop', (event) => {
  const file = event.dataTransfer.files[0];
  if (!file) return;
  const dropped = window.api.pathForFile(file);
  if (dropped) loadGame(dropped);
});
document.addEventListener('dragover', (event) => event.preventDefault());
document.addEventListener('drop', (event) => event.preventDefault());

// Core events arrive as {code, params}; the wording is chosen here.
window.api.onLog((event) => log(event.code, event.params));

boot();

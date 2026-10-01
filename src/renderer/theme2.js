'use strict';
/* ===========================================================================
   Theme 2 — "Aperture": an editorial, horizontal shell that deliberately
   shares no visual grammar with the classic sidebar. A masthead, switchboard,
   command palette and split game workspace replace the original frame. View
   transitions keep navigation spatial without turning the interface into a
   showreel.

   Nothing here runs under theme 1: enable() is called when the skin is chosen
   and disable() takes every trace of it back out again. The functions it
   leans on - show, openSheet, closeSheet, t, esc, installOptions - are the
   app's own, so the two skins always show the same facts and the same state.
   =========================================================================== */
(function (root) {
  const q = (selector, scope) => (scope || document).querySelector(selector);
  const on = () => document.documentElement.dataset.skin === 'two';
  const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const icon = (paths, size) => `<svg viewBox="0 0 24 24" width="${size || 18}" height="${size || 18}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  const ICONS = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    folder: '<path d="M3 8a2 2 0 0 1 2-2h4.5l2 2H19a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-5M12 8h.01"/>',
    download: '<path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5"/><path d="M4 18.5V20a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1.5"/>',
    pin: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9.5 4v16"/>',
    open: '<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
    back: '<path d="M15 5 8 12l7 7"/>',
    next: '<path d="M9 5l7 7-7 7"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    star: '<path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9z"/>',
    file: '<path d="M14 3v5h5"/><path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8z"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h9"/>',
    restore: '<path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v4h4"/>',
    user: '<circle cx="12" cy="9" r="3.4"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3.2 9h17.6M3.2 15h17.6"/><path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18"/>',
    grid: '<rect x="3.5" y="4" width="7" height="7" rx="1.6"/><rect x="13.5" y="4" width="7" height="7" rx="1.6"/><rect x="3.5" y="13" width="7" height="7" rx="1.6"/><rect x="13.5" y="13" width="7" height="7" rx="1.6"/>',
    list: '<path d="M4 6.5h16M4 12h16M4 17.5h16"/>'
  };

  let built = false;
  let bar = null, dock = null, glow = null, palette = null, navWatch = null, cardWatch = null, statusWatch = null;
  let morphing = null;

  /* ---------------------------------------------------------------- frame */
  function buildBar() {
    bar = document.createElement('div');
    bar.className = 't2-bar';
    bar.id = 't2Bar';
    const logo = q('.brand img');
    bar.innerHTML = `
      <div class="t2-wordmark" aria-label="DLSS 5 Swapper">
        ${logo ? `<img src="${logo.getAttribute('src')}" alt="">` : '<b>DLSS 5</b>'}
        <span>SWAPPER</span>
      </div>
      <div class="t2-current" id="t2Current" aria-live="polite"></div>
      <button class="t2-search" id="t2Search" type="button">
        ${icon(ICONS.search, 16)}
        <span>${esc(t('t2Search'))}</span>
        <kbd class="t2-kbd">CTRL&nbsp; K</kbd>
      </button>
      <span class="t2-build-mark" aria-hidden="true">LOCAL / RTX</span>`;
    // On the body, not inside the shell: the shell is its own stacking context,
    // and a menu opened from the masthead has to be able to sit above the
    // switchboard that lives outside it.
    document.body.appendChild(bar);
    // The app's own toolbar moves into the masthead rather than floating over
    // it: in one row nothing can overlap the search, at any window width.
    const tools = q('.toolbar');
    if (tools) bar.appendChild(tools);
    q('#t2Search').onclick = () => openPalette();
    // The drawing ends the masthead with a person; it opens the page where a
    // name and an avatar are actually set.
    if (!q('#t2Avatar')) {
      const avatar = document.createElement('button');
      avatar.id = 't2Avatar';
      avatar.type = 'button';
      avatar.className = 't2-avatar';
      avatar.innerHTML = icon(ICONS.user, 17);
      avatar.onclick = () => show('settings');
      q('.toolbar')?.insertBefore(avatar, q('#winMin'));
    }
    // The drawing marks the language with a globe; the button itself is the
    // app's own, so only the mark is added.
    const lang = q('#langBtn');
    if (lang && !q('.t2-globe', lang)) {
      const globe = document.createElement('span');
      globe.className = 't2-globe';
      globe.innerHTML = icon(ICONS.globe, 15);
      lang.insertBefore(globe, lang.firstChild);
    }
  }

  function buildDock() {
    dock = document.createElement('nav');
    dock.className = 't2-dock';
    dock.id = 't2Dock';
    const items = [...document.querySelectorAll('.nav-item')].map((nav) => {
      const view = nav.dataset.view;
      const svg = nav.querySelector('svg')?.outerHTML || '';
      const label = nav.querySelector('span')?.textContent || view;
      return `<button class="t2-dock-item" type="button" data-view="${esc(view)}" title="${esc(label)}">${svg}<span>${esc(label)}</span></button>`;
    }).join('');
    dock.innerHTML = `
      <div class="t2-dock-glow" id="t2Glow"></div>
      <div class="t2-dock-items">${items}</div>
      <div class="t2-dock-foot">
        <div class="t2-status"><i></i><b id="t2Status">${esc(q('#statusText')?.textContent || '')}</b></div>
        <button class="t2-pin" id="t2Pin" type="button">${icon(ICONS.pin, 16)}</button>
      </div>`;
    document.body.appendChild(dock);
    glow = q('#t2Glow');
    for (const button of dock.querySelectorAll('.t2-dock-item')) {
      button.onclick = () => show(button.dataset.view);
    }
    const pin = q('#t2Pin');
    pin.title = pin.ariaLabel = t(state.rail === 'on' ? 'railExpand' : 'railCollapse');
    pin.onclick = async () => {
      state.rail = state.rail === 'on' ? 'off' : 'on';
      document.documentElement.dataset.rail = state.rail;
      pin.title = pin.ariaLabel = t(state.rail === 'on' ? 'railExpand' : 'railCollapse');
      syncDock();
      try { await window.lab.setRail(state.rail); } catch { /* it is already folded */ }
    };
    // The app's own status line is the source of truth; the dock mirrors it.
    const statusText = q('#statusText');
    if (statusText) {
      statusWatch = new MutationObserver(() => { const b = q('#t2Status'); if (b) b.textContent = statusText.textContent; });
      statusWatch.observe(statusText, { childList: true, characterData: true, subtree: true });
    }
    // Language changes rewrite the classic nav; the dock follows it.
    navWatch = new MutationObserver(() => {
      for (const nav of document.querySelectorAll('.nav-item')) {
        const item = dock.querySelector(`.t2-dock-item[data-view="${nav.dataset.view}"]`);
        const label = nav.querySelector('span')?.textContent;
        if (item && label) { item.querySelector('span').textContent = label; item.title = label; }
      }
    });
    navWatch.observe(q('.nav'), { childList: true, characterData: true, subtree: true });
  }

  // The library in this skin is a catalogue: a control bar that stays put, and
  // either wide cards or a dense list. The choice is the person's and is kept.
  function buildLibraryToggle() {
    const row = document.querySelector('.games-heading .row');
    if (!row || q('#t2View')) return;
    const saved = (() => { try { return localStorage.getItem('t2-library'); } catch { return null; } })();
    document.documentElement.dataset.library = saved === 'list' ? 'list' : 'grid';
    const group = document.createElement('div');
    group.className = 't2-view';
    group.id = 't2View';
    group.innerHTML = `
      <button type="button" data-view-mode="grid" title="${esc(t('t2Cards'))}" aria-label="${esc(t('t2Cards'))}">${icon(ICONS.grid, 16)}</button>
      <button type="button" data-view-mode="list" title="${esc(t('t2List'))}" aria-label="${esc(t('t2List'))}">${icon(ICONS.list, 16)}</button>`;
    row.prepend(group);
    // The filters join the bar, so the header is one console rather than three
    // stacked strips.
    const rail = document.querySelector('#view-games .game-filters');
    const head = document.querySelector('.games-heading');
    if (rail && head && rail.parentElement !== head) head.appendChild(rail);
    const paint = () => {
      const mode = document.documentElement.dataset.library;
      for (const button of group.querySelectorAll('button')) {
        button.classList.toggle('on', button.dataset.viewMode === mode);
        button.setAttribute('aria-pressed', String(button.dataset.viewMode === mode));
      }
    };
    for (const button of group.querySelectorAll('button')) {
      button.onclick = () => {
        document.documentElement.dataset.library = button.dataset.viewMode;
        try { localStorage.setItem('t2-library', button.dataset.viewMode); } catch { /* a session-long choice is fine */ }
        paint();
        stagger();
      };
    }
    paint();
  }

  function syncDock() {
    if (!dock) return;
    const current = q('.nav-item.active')?.dataset.view;
    let active = null;
    for (const item of dock.querySelectorAll('.t2-dock-item')) {
      const isOn = item.dataset.view === current;
      item.classList.toggle('on', isOn);
      if (isOn) active = item;
    }
    if (active && glow) {
      glow.style.setProperty('--x', `${active.offsetLeft}px`);
      glow.style.setProperty('--w', `${active.offsetWidth}px`);
      glow.classList.add('ready');
    }
    const currentLabel = q('#t2Current');
    if (currentLabel && active) currentLabel.textContent = active.querySelector('span')?.textContent || '';
  }

  /* ------------------------------------------------------- command palette */
  function openPalette() {
    if (palette) return;
    palette = document.createElement('div');
    palette.className = 't2-palette';
    palette.innerHTML = `
      <div class="t2-palette-box" role="dialog" aria-modal="true" aria-label="${esc(t('t2Search'))}">
        <input id="t2PaletteInput" type="text" autocomplete="off" spellcheck="false" placeholder="${esc(t('t2SearchHint'))}">
        <div class="t2-results" id="t2Results"></div>
        <div class="t2-palette-foot"><span>↑ ↓ ${esc(t('t2Move'))}</span><span>↵ ${esc(t('t2Open'))}</span><span>Esc ${esc(t('t2Dismiss'))}</span></div>
      </div>`;
    document.body.appendChild(palette);
    const input = q('#t2PaletteInput');
    let picked = 0;

    const rows = (query) => {
      const text = query.trim().toLowerCase();
      const games = (state.games || [])
        .filter((game) => !text || game.name.toLowerCase().includes(text))
        .slice(0, 8)
        .map((game) => ({ kind: 'game', name: game.name, sub: sourceLabel(game.launcher) || '', art: game.poster?.url || null, run: () => { closePalette(); openSheet(game.dir); } }));
      const views = [...document.querySelectorAll('.nav-item')]
        .map((nav) => ({ view: nav.dataset.view, label: nav.querySelector('span')?.textContent || nav.dataset.view }))
        .filter((item) => text && item.label.toLowerCase().includes(text))
        .map((item) => ({ kind: 'view', name: item.label, sub: t('t2Page'), art: null, run: () => { closePalette(); show(item.view); } }));
      return [...games, ...views];
    };

    let current = [];
    const paint = () => {
      current = rows(input.value);
      picked = Math.min(picked, Math.max(0, current.length - 1));
      const list = q('#t2Results');
      list.innerHTML = current.length
        ? current.map((row, index) => `
          <button class="t2-result${index === picked ? ' on' : ''}" type="button" data-index="${index}" style="--i:${index}">
            ${row.art ? `<img src="${row.art}" alt="">` : `<span class="t2-result-mark">${esc(initials(row.name))}</span>`}
            <b>${esc(row.name)}</b>
            <span class="t2-kind">${esc(row.sub)}</span>
          </button>`).join('')
        : `<div class="t2-empty">${esc(t('t2NoMatch'))}</div>`;
      for (const button of list.querySelectorAll('.t2-result')) {
        button.onclick = () => current[Number(button.dataset.index)]?.run();
      }
    };
    paint();
    input.oninput = () => { picked = 0; paint(); };
    input.onkeydown = (event) => {
      if (event.key === 'ArrowDown') { picked = Math.min(picked + 1, current.length - 1); paint(); event.preventDefault(); }
      else if (event.key === 'ArrowUp') { picked = Math.max(picked - 1, 0); paint(); event.preventDefault(); }
      else if (event.key === 'Enter') { current[picked]?.run(); event.preventDefault(); }
      else if (event.key === 'Escape') closePalette();
    };
    palette.onclick = (event) => { if (event.target === palette) closePalette(); };
    input.focus();
  }
  function closePalette() { palette?.remove(); palette = null; }

  /* ------------------------------------------------ pointer-driven light */
  function pointerMove(event) {
    if (!on()) return;
    const card = event.target.closest?.('.card, .t2-card');
    if (!card) return;
    const box = card.getBoundingClientRect();
    const x = event.clientX - box.left, y = event.clientY - box.top;
    card.style.setProperty('--mx', `${(x / box.width) * 100}%`);
    card.style.setProperty('--my', `${(y / box.height) * 100}%`);
    // Lighting follows the pointer, but surfaces stay on their grid. The old
    // 3D tilt looked playful and made dense libraries harder to scan.
  }
  function pointerOut(event) {
    const card = event.target.closest?.('.card');
    if (!card) return;
    card.style.removeProperty('--mx');
    card.style.removeProperty('--my');
  }
  function ripple(event) {
    if (!on() || calm()) return;
    const button = event.target.closest?.('.t2-btn, .btn-install, .glass-btn');
    if (!button) return;
    const box = button.getBoundingClientRect();
    const size = Math.max(box.width, box.height);
    const mark = document.createElement('span');
    mark.className = 't2-ripple';
    mark.style.cssText = `width:${size}px;height:${size}px;left:${event.clientX - box.left - size / 2}px;top:${event.clientY - box.top - size / 2}px`;
    button.appendChild(mark);
    setTimeout(() => mark.remove(), 600);
  }

  // Cards arrive one after another rather than all at once; the index is what
  // the stylesheet multiplies into each card's delay.
  // The app draws the status pips inside the poster. That is right for a
  // portrait tile and wrong for a row, so in this skin they are lifted out to
  // sit beside the name; the card is their positioning box either way.
  function liftStatus() {
    for (const card of document.querySelectorAll('#groups .card, #recents .rcard')) {
      const status = card.querySelector(':scope > .poster > .status');
      if (status) card.appendChild(status);
    }
  }

  function stagger() {
    if (!on()) return;
    liftStatus();
    document.querySelectorAll('#groups .card, #recents .card').forEach((card, index) => {
      card.style.setProperty('--i', String(index % 24));
    });
  }

  /* ------------------------------------------------------ view transitions */
  const canTransition = () => on() && !calm() && typeof document.startViewTransition === 'function';
  function transition(change) {
    if (!canTransition()) { change(); return { finished: Promise.resolve() }; }
    return document.startViewTransition(change);
  }

  /* --------------------------------------------------------- the game page */
  // The page for one game: a hero the artwork bleeds through, then tabs, then
  // one card per thing you can do. Every control keeps the id the app already
  // wires up, so this is a different page rather than a different program.
  // The game page, laid out as the design asks for it: an artwork masthead
  // carrying the title and the one action, then a workspace of two columns -
  // setup and activity on the left; the live read-out, the install actions and
  // the recent games on the right. Every control keeps the id the app wires.
  function sheetMarkup(context) {
    const { d, game, art, cover, hero, pick, dir, upToDate, inGameDlss } = context;
    const shots = [hero, cover, game.poster && game.poster.url]
      .filter((one, index, all) => one && all.indexOf(one) === index);
    const name = art ? art.name : game.name;
    const kicker = String(name).split(/[:\u2013-]/)[0].trim().toUpperCase();
    const genres = (art && art.genres ? art.genres : []).slice(0, 3);
    const ready = Boolean(d.ok && pick && !pick.installIssue && routesFor(pick).length);
    const summary = art && art.summary ? art.summary : '';
    const api = pick ? selectedApi(pick, dir) : null;
    const route = pick ? selectedRoute(d, pick, dir) : null;
    const routeName = route === 'optiscaler' ? 'OptiScaler' : route === 'renodx' ? 'RenoDX'
      : route === 'feeder' ? 'Feeder' : route === 'native' ? 'Native' : '—';
    const backend = d.installedRoute === 'optiscaler' ? 'OptiScaler DLSS-NR' : d.installedRoute ? 'ReShade' : t('none');
    const size = pick && pick.size ? `${Math.round(pick.size / 1048576)} MB` : null;
    const exeName = pick ? pick.rel.split(/[\\/]/).pop() : null;
    const exeMeta = [api && api.label, pick && pick.bitness ? t('gameBitness', pick.bitness) : null, size].filter(Boolean).join(' — ');
    const tile = (label, value, tone, hint) => `<div class="gp-tile${tone ? ' ' + tone : ''}">
        <span>${esc(label)}${hint ? icon(ICONS.info, 12) : ''}</span><strong>${value}</strong>
      </div>`;
    const now = new Date();
    const stamp = `${now.toLocaleDateString(state.lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const recent = (state.recents || [])
      .map((row) => ({ at: row.at, game: (state.games || []).find((one) => one.dir === row.dir) }))
      .filter((row) => row.game).slice(0, 3);

    return `
      <div class="gp" style="--art:url('${shots[0] || ''}')" data-shots='${esc(JSON.stringify(shots))}'>
        <header class="gp-hero">
          ${shots.length ? '<div class="gp-art" id="gpArt"></div>' : ''}
          <div class="gp-veil" aria-hidden="true"></div>
          <button class="gp-back" id="sheetClose" aria-label="${esc(t('t2Close'))}">${icon(ICONS.back, 18)}</button>
          <div class="gp-hero-copy">
            <span class="gp-kicker">${esc(kicker)}</span>
            <h1 class="gp-title">${esc(name)}</h1>
            ${summary ? `<p class="gp-sub">${esc(summary)}</p>` : ''}
            ${genres.length ? `<div class="gp-chips">${genres.map((one) => `<span class="gp-chip">${esc(one)}</span>`).join('')}</div>` : ''}
            <div class="gp-cta">
              <button class="gp-play" id="t2Play">${icon(ICONS.play, 16)}<span>${esc(t('t2Play'))}</span></button>
              <button class="gp-round" id="t2More" title="${esc(t('t2OpenFolder'))}">${icon(ICONS.more, 18)}</button>
            </div>
          </div>
          <div class="gp-hero-foot">
            ${shots.length > 1 ? `<div class="gp-gallery">
              <button class="gp-arrow" data-step="-1" aria-label="${esc(t('t2Move'))}">${icon(ICONS.back, 14)}</button>
              <div class="gp-dots">${shots.map((one, index) => `<i class="${index ? '' : 'on'}" data-shot="${index}"></i>`).join('')}</div>
              <button class="gp-arrow" data-step="1" aria-label="${esc(t('t2Move'))}">${icon(ICONS.next, 14)}</button>
            </div>` : ''}
            <div class="gp-signal" id="gpSignal">
              <span class="gp-signal-dot"></span>${esc(t('t2Signal'))}
              ${art && art.rating ? `<span class="gp-signal-sep"></span>${icon(ICONS.star, 13)}${esc(String(art.rating))}/100` : ''}
            </div>
          </div>
        </header>

        <div class="gp-work">
          <div class="gp-main">
            <section class="gp-card">
              <div class="gp-head">
                <span class="gp-head-icon">${icon(ICONS.gear, 17)}</span>
                <h2>${esc(t('t2Setup'))}</h2>
              </div>
              <div class="gp-apply">
                <div class="gp-apply-copy">
                  <b>${esc(d.installedRoute ? t('applyBackend') : t('t2SetupTitle'))}</b>
                  <span>${esc(d.installedRoute ? t('t2SetupInstalled') : t('t2SetupNote'))}</span>
                </div>
                <span class="gp-ready${ready ? '' : ' off'}">${icon(ICONS.check, 15)}${esc(ready ? t('t2Ready') : t('t2NotReady'))}</span>
              </div>
              <div class="gp-rule"></div>
              <div class="gp-fields">
                <div class="gp-field gp-field-exe">
                  <span class="gp-label">${esc(t('fExe'))}</span>
                  <div class="gp-exe">
                    <span class="gp-exe-icon">${icon(ICONS.file, 16)}</span>
                    ${d.exes.length > 1
                      ? `<div class="gp-exe-pick">${exePicker(d, dir)}</div>`
                      : `<b title="${esc(pick ? pick.rel : '')}">${esc(exeName || '—')}</b><small>${esc(exeMeta)}</small>`}
                    <button class="gp-mini" id="gpExeFolder" title="${esc(t('t2OpenFolder'))}">${icon(ICONS.folder, 15)}</button>
                  </div>
                </div>
                ${installOptions(d, pick, dir)}
              </div>
              <div class="gp-folder">
                <span class="gp-head-icon">${icon(ICONS.folder, 16)}</span>
                <div class="gp-folder-copy"><b>${esc(t('t2Folder'))}</b><span>${esc(game.dir)}</span></div>
                <button class="gp-mini" id="t2FolderOpen" title="${esc(t('t2OpenFolder'))}">${icon(ICONS.folder, 15)}</button>
              </div>
              <div class="gp-notes-slot" id="gpNotes"></div>
            </section>

            <section class="gp-card gp-activity">
              <div class="gp-head">
                <span class="gp-head-icon">${icon(ICONS.clock, 16)}</span>
                <h2>${esc(t('sheetActivity'))}</h2>
                <div class="gp-acts">
                  <button class="gp-act accent" id="shareResult">${window.communityUi?.reportFor?.(dir) ? t('menuCommunityEdit') : t('menuCommunity')}</button>
                  <button class="gp-act" id="copyJob"${jobLines.length ? '' : ' disabled'}>${icon(ICONS.copy, 14)}${t('copyLog')}</button>
                  <button class="gp-act" id="saveDiag">${icon(ICONS.download, 14)}${t('saveDiagnostics')}</button>
                </div>
              </div>
              <div class="gp-log">
                <span class="gp-log-mark">${icon(ICONS.check, 14)}</span>
                <div class="job" id="job" role="status" aria-live="polite">${esc(jobLines.join('\n') || t('jobReady'))}</div>
                <time class="gp-time">${esc(stamp)}</time>
              </div>
            </section>
          </div>

          <aside class="gp-side">
            <section class="gp-card">
              <div class="gp-head">
                <h2>${esc(t('t2System'))}</h2>
                <span class="gp-live"><i></i>${esc(routeName)}</span>
              </div>
              <div class="gp-tiles">
                ${tile(t('fArchitecture'), esc(pick && pick.bitness ? t('gameBitness', pick.bitness) : '—'))}
                ${tile(t('fApi'), esc((api && api.label) || reasonText(d.reason) || '—'))}
                ${tile(t('installedBackend'), esc(backend), d.installedRoute ? 'on' : '')}
                ${tile('DLSS', esc(inGameDlss || t('none')), upToDate ? 'on' : '')}
                ${tile(t('fAddon'), esc(d.addon ? t('installed') : t('notPresent')), '', true)}
                ${tile(t('fReShade'), esc(d.reshade.installed ? d.reshade.version : t('notInstalled')), '', true)}
              </div>
              <div class="sheet-actions">
                <button class="btn-install" id="doInstall"${ready ? '' : ' disabled'}>${icon(ICONS.download, 16)}${installLabel(d, pick, dir)}</button>
                <button class="btn-restore" id="doRestore"${d.hasBackup ? '' : ' disabled'}>${icon(ICONS.restore, 15)}${t('restore')}</button>
              </div>
            </section>

            ${recent.length ? `<section class="gp-card">
              <div class="gp-head">
                <h2>${esc(t('recentTitle'))}</h2>
                <button class="gp-viewall" id="gpViewAll">${esc(t('t2ViewAll'))}${icon(ICONS.next, 13)}</button>
              </div>
              <div class="gp-recents">
                ${recent.map(({ at, game: one }) => `
                  <button class="gp-recent" type="button" data-dir="${esc(one.dir)}">
                    ${one.poster ? `<img src="${one.poster.url}" alt="">` : `<span class="gp-recent-mark">${esc(initials(one.name))}</span>`}
                    <span class="gp-recent-copy"><b>${esc(one.name)}</b><small>${esc(t('t2Updated'))} ${esc(ago(at))}</small></span>
                    ${isReady(one) ? `<span class="gp-pill">${esc(t('installed'))}</span>` : ''}
                  </button>`).join('')}
              </div>
            </section>` : ''}

            <div class="gp-community" id="sheetCommunity" hidden></div>
          </aside>
        </div>
      </div>`;
  }

  // Wired after the markup is on screen. The app wires its own controls; these
  // are the ones only this page has.
  function wireSheet(context) {
    const { game, dir } = context;
    const play = q('#t2Play');
    if (play) play.onclick = async () => {
      play.disabled = true;
      try {
        const answer = await window.lab.launchGame(dir);
        if (!answer?.ok) log(answer?.message || t('t2PlayFailed'));
      } catch (error) { log(error.message); }
      finally { setTimeout(() => { play.disabled = false; }, 1200); }
    };
    for (const id of ['t2More', 't2FolderOpen', 'gpExeFolder']) {
      const button = q('#' + id);
      if (button) button.onclick = () => window.lab.open(game.dir);
    }
    const viewAll = q('#gpViewAll');
    if (viewAll) viewAll.onclick = () => { closeSheet(); show('games'); };
    for (const row of document.querySelectorAll('.gp-recent')) {
      row.onclick = () => openSheet(row.dataset.dir);
    }

    // The notes the app writes belong at the foot of the setup card, folded.
    const notes = q('#sheetNotes'), slot = q('#gpNotes');
    if (notes && slot) slot.appendChild(notes);

    // The artwork the catalogue gave us, one press at a time.
    const art = q('#gpArt'), page = q('.gp');
    const dots = [...document.querySelectorAll('.gp-dots i')];
    const shots = (() => { try { return JSON.parse(page?.dataset.shots || '[]'); } catch { return []; } })();
    if (art && dots.length > 1 && shots.length > 1) {
      let at = 0;
      const paint = () => {
        page.style.setProperty('--art', `url('${shots[at]}')`);
        dots.forEach((dot, index) => dot.classList.toggle('on', index === at));
      };
      for (const [index, dot] of dots.entries()) dot.onclick = () => { at = index; paint(); };
      for (const arrow of document.querySelectorAll('.gp-arrow')) {
        arrow.onclick = () => { at = (at + Number(arrow.dataset.step) + shots.length) % shots.length; paint(); };
      }
    }

    // The community answer arrives after the page does; the mark in the
    // masthead follows whatever it says.
    const box = q('#sheetCommunity'), signal = q('#gpSignal');
    if (box && signal) {
      const follow = () => {
        const status = box.querySelector('.sheet-community-status');
        signal.dataset.state = status ? [...status.classList].find((one) => one !== 'sheet-community-status') || '' : '';
      };
      new MutationObserver(follow).observe(box, { childList: true, subtree: true });
      follow();
    }
    // The page keeps the drawing's own neutral ground; the artwork colours the
    // masthead and nothing else.
  }

  function tintFromCover() {
    const page = q('.t2-page');
    const image = q('.t2-cover-source');
    if (!page || !image || !image.src) return;
    const paint = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const brush = canvas.getContext('2d', { willReadFrequently: true });
        brush.drawImage(image, 0, 0, 1, 1);
        const [r, g, b] = brush.getImageData(0, 0, 1, 1).data;
        const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255, span = max - min;
        if (span < .04) return;                       // grey artwork keeps the default
        const R = r / 255, G = g / 255, B = b / 255;
        let hue = max === R ? ((G - B) / span) % 6 : max === G ? (B - R) / span + 2 : (R - G) / span + 4;
        hue = Math.round(hue * 60);
        page.style.setProperty('--page-hue', String((hue + 360) % 360));
      } catch { /* a picture from elsewhere may not be readable; the default stands */ }
    };
    if (image.complete && image.naturalWidth) paint();
    else image.addEventListener('load', paint, { once: true });
  }

  function skeleton() {
    return `<div class="t2-skeleton">
      <div class="t2-bone" style="height:300px;border-radius:0 0 28px 28px"></div>
      <div class="t2-bone" style="height:120px"></div>
      <div class="t2-bone" style="height:210px"></div>
    </div>`;
  }

  /* --------------------------------------------------------------- wiring */
  function enable() {
    // The switchboard is horizontal in this skin, so there is no rail to fold:
    // the names always show and the old state is simply not applied.
    document.documentElement.dataset.rail = 'off';
    if (built) { syncDock(); stagger(); return; }
    built = true;
    buildBar();
    buildDock();
    document.addEventListener('pointermove', pointerMove, { passive: true });
    document.addEventListener('pointerout', pointerOut, { passive: true });
    document.addEventListener('keydown', paletteKey);
    cardWatch = new MutationObserver(() => stagger());
    for (const id of ['groups', 'recents']) {
      const box = document.getElementById(id);
      if (box) cardWatch.observe(box, { childList: true, subtree: true });
    }
    buildLibraryToggle();
    syncDock();
    stagger();
  }

  function disable() {
    if (!built) return;
    built = false;
    // Hand the toolbar back before the masthead goes.
    const tools = q('.toolbar');
    if (tools && bar && bar.contains(tools)) q('.main')?.prepend(tools);
    bar?.remove(); dock?.remove(); closePalette();
    q('#t2Avatar')?.remove(); q('.t2-globe')?.remove();
    q('#t2View')?.remove();
    delete document.documentElement.dataset.library;
    bar = dock = glow = null;
    navWatch?.disconnect(); cardWatch?.disconnect(); statusWatch?.disconnect();
    navWatch = cardWatch = statusWatch = null;
    document.removeEventListener('pointermove', pointerMove);
    document.removeEventListener('pointerout', pointerOut);
    document.removeEventListener('keydown', paletteKey);
    delete document.documentElement.dataset.rail;
  }

  function paletteKey(event) {
    if (!on()) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); palette ? closePalette() : openPalette(); }
    else if (event.key === 'Escape' && palette) closePalette();
  }

  /* The app's own navigation, wrapped so that moving anywhere is one motion.
     Function declarations in a classic script are properties of window, so
     replacing them here changes what the rest of the app calls, without the
     rest of the app knowing there are two skins. */
  const originalShow = root.show;
  root.show = function (view) {
    if (!canTransition()) { originalShow(view); syncDock(); return; }
    const change = () => { originalShow(view); syncDock(); };
    document.startViewTransition(change);
  };

  const originalOpenSheet = root.openSheet;
  root.openSheet = function (dir, keepLog) {
    if (!on()) return originalOpenSheet(dir, keepLog);
    // The card that was pressed and the hero it becomes share a name for the
    // length of the transition, which is what makes the poster travel.
    const card = document.querySelector(`.card[data-dir="${(window.CSS && CSS.escape) ? CSS.escape(dir) : dir}"] .poster`);
    if (card && canTransition()) { card.style.viewTransitionName = 't2-poster'; morphing = card; }
    const run = () => {
      const pending = originalOpenSheet(dir, keepLog);
      const sheet = q('#sheet');
      if (sheet) sheet.innerHTML = skeleton();   // instead of one line of text
      return pending;
    };
    if (!canTransition()) return run();
    const view = document.startViewTransition(run);
    view.finished.finally(() => { if (morphing) { morphing.style.viewTransitionName = ''; morphing = null; } });
    return view.updateCallbackDone;
  };

  const originalCloseSheet = root.closeSheet;
  root.closeSheet = function () {
    if (!canTransition()) return originalCloseSheet();
    return document.startViewTransition(() => originalCloseSheet());
  };

  root.theme2 = { enable, disable, sheetMarkup, wireSheet, syncDock, transition, openPalette, closePalette, stagger };

  // The app's boot can finish before this file has even been parsed - the
  // answer to boot() is one IPC round trip, and a second script is a second
  // fetch. When that happens nobody is left to call enable(), and the skin
  // arrives as a stylesheet with no frame: no dock, no command bar. The skin
  // is already named on the root element by then, so it starts itself.
  if (document.documentElement.dataset.skin === 'two') enable();
})(window);

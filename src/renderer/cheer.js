'use strict';
// What happens after Send. Until now the dialog simply closed, and the person
// was left to guess whether anything had been sent at all - so this says so,
// plainly and once: the room goes soft, a tick draws itself, and then the thing
// they just wrote is shown back to them with a way to go and look at it.
//
// Every word comes from the caller. This file knows about timing and paint,
// never about language.
(function (root) {
  const escape = value => String(value == null ? '' : value)
    .replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

  const still = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = ms => new Promise(resolve => setTimeout(resolve, still() ? Math.min(ms, 120) : ms));

  // Paper, not sparks: flat shapes in a few colours, tumbling as they fall.
  // Drawn once into a layer that is thrown away with the dialog.
  const PAPER = ['#3aa757', '#6cc10a', '#f0b429', '#f28b30', '#e2574c', '#8fd694'];
  const PIECES = 46;
  function confetti(into) {
    if (still()) return;
    const layer = document.createElement('span');
    layer.className = 'cheer-paper';
    const random = (low, high) => low + Math.random() * (high - low);
    for (let index = 0; index < PIECES; index++) {
      const piece = document.createElement('i');
      const round = index % 6 === 0;
      piece.style.cssText = `
        --x: ${random(-190, 190)}px; --y: ${random(-150, -30)}px;
        --fall: ${random(240, 460)}px; --spin: ${random(-540, 540)}deg;
        --life: ${random(1500, 2600)}ms; --wait: ${random(0, 260)}ms;
        width: ${random(5, 11)}px; height: ${round ? '' : random(7, 15) + 'px'};
        background: ${PAPER[index % PAPER.length]};
        border-radius: ${round ? '50%' : '1.5px'};`;
      if (round) piece.style.height = piece.style.width;
      layer.appendChild(piece);
    }
    into.appendChild(layer);
    setTimeout(() => layer.remove(), 3200);
  }

  let box = null;
  function element() {
    if (box) return box;
    box = document.createElement('dialog');
    box.className = 'cheer';
    document.body.appendChild(box);
    return box;
  }

  const TICK = '<circle class="cheer-ring" cx="42" cy="42" r="34"/><path class="cheer-stroke" d="M27 43.5 37.5 54 58 32"/>';
  const CROSS = '<circle class="cheer-ring" cx="42" cy="42" r="34"/><path class="cheer-stroke" d="M30 30 54 54"/><path class="cheer-stroke cheer-stroke-2" d="M54 30 30 54"/>';

  /**
   * @returns {Promise<string>} the `data-cheer` of whatever was pressed, or
   * 'close' when it was dismissed.
   */
  function show({ tone = 'ok', kicker = '', title = '', note = '', hero = null, poster = null,
    verdict = '', tags = [], comment = '', actions = [] } = {}) {
    const dialog = element();
    dialog.className = `cheer cheer-${tone === 'ok' ? 'ok' : 'bad'}`;
    dialog.innerHTML = `
      <div class="cheer-stage">
        <div class="cheer-mark" aria-hidden="true">
          <svg viewBox="0 0 84 84">${tone === 'ok' ? TICK : CROSS}</svg>
          <span class="cheer-pulse"></span>
        </div>
        <div class="cheer-card" role="alertdialog" aria-live="polite">
          <div class="cheer-head">
            ${hero ? `<img class="cheer-hero" src="${escape(hero)}" alt="">` : ''}
            <span class="cheer-veil"></span>
            ${poster ? `<span class="cheer-poster"><img src="${escape(poster)}" alt=""></span>` : ''}
            <span class="cheer-head-copy">
              ${kicker ? `<span class="cheer-kicker">${escape(kicker)}</span>` : ''}
              <b>${escape(title)}</b>
            </span>
            <span class="cheer-badge"><svg viewBox="0 0 84 84">${tone === 'ok' ? TICK : CROSS}</svg></span>
          </div>
          <div class="cheer-body">
            ${note ? `<p class="cheer-note">${escape(note)}</p>` : ''}
            ${comment ? `<blockquote class="cheer-quote">${verdict
              ? `<i class="community-dot ${escape(verdict)}"></i>` : ''}${escape(comment)}</blockquote>` : ''}
            ${tags.length ? `<div class="cheer-tags">${tags.filter(Boolean)
              .map(tag => `<span>${escape(tag)}</span>`).join('')}</div>` : ''}
          </div>
          <div class="cheer-foot">${actions.map((action, index) =>
            `<button type="button" class="${index === 0 ? 'cheer-go' : 'cheer-ghost'}" data-cheer="${escape(action.id)}">${escape(action.label)}</button>`).join('')}</div>
        </div>
      </div>`;

    const stage = dialog.querySelector('.cheer-stage');
    const mark = dialog.querySelector('.cheer-mark');
    const card = dialog.querySelector('.cheer-card');

    return new Promise(resolve => {
      const answer = (value) => {
        if (!dialog.open) return;
        dialog.removeEventListener('cancel', onCancel);
        dialog.removeEventListener('click', onClick);
        dialog.close();
        resolve(value);
      };
      const onCancel = (event) => { event.preventDefault(); answer('close'); };
      const onClick = (event) => {
        const button = event.target.closest('[data-cheer]');
        if (button) return answer(button.dataset.cheer);
        if (event.target === dialog) answer('close');
      };
      dialog.addEventListener('cancel', onCancel);
      dialog.addEventListener('click', onClick);
      dialog.showModal();

      // The mark first, alone, for as long as it takes to read it. Then it
      // stands down and what was written takes its place.
      (async () => {
        if (tone === 'ok') confetti(stage);
        await wait(tone === 'ok' ? 1450 : 1150);
        if (!dialog.open) return;
        mark.classList.add('cheer-gone');
        card.classList.add('cheer-here');
        await wait(240);
        if (dialog.open) dialog.querySelector('.cheer-go, .cheer-ghost')?.focus({ preventScroll: true });
      })();
    });
  }

  const api = { show };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.cheer = api;
})(typeof window !== 'undefined' ? window : globalThis);

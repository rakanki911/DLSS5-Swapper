'use strict';
// Native <input type=range> dragging relies on OS capture, which an offscreen
// Chromium window does not own. Handle pointer drags in the shared DOM instead.
// A custom theme stores one accent colour. The other three shades the panel
// needs are derived from it here, in one place, so the preview in the app and
// the surface drawn inside the game cannot drift apart.
//   bright  accent lifted toward white, for text on dark
//   soft    accent at low alpha, for selected rows
//   back    a dark tint over the panel's own base, for the gradient
window.overlayThemeVars = accent => {
  const hex = /^#([0-9a-f]{6})$/i.exec(String(accent || ''));
  if (!hex) return null;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(hex[1].slice(i, i + 2), 16));
  const pair = v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  const mix = (c, target, amount) => pair(c + (target - c) * amount);
  return {
    '--ol-accent': `#${pair(r)}${pair(g)}${pair(b)}`,
    '--ol-bright': `#${mix(r, 255, .47)}${mix(g, 255, .47)}${mix(b, 255, .47)}`,
    '--ol-soft': `#${pair(r)}${pair(g)}${pair(b)}25`,
    '--ol-back': `#${mix(r, 16, .88)}${mix(g, 21, .88)}${mix(b, 25, .88)}`
  };
};

// Point an element at a theme. Built-in themes are pure CSS; a custom one adds
// the derived variables inline, which override the stylesheet's defaults.
window.applyOverlayTheme = (element, prefs) => {
  if (!element || !prefs) return;
  element.dataset.overlayTheme = prefs.theme;
  for (const name of ['--ol-accent', '--ol-bright', '--ol-soft', '--ol-back']) element.style.removeProperty(name);
  if (prefs.theme !== 'custom') return;
  const vars = window.overlayThemeVars(prefs.custom && prefs.custom.accent);
  if (vars) for (const [name, value] of Object.entries(vars)) element.style.setProperty(name, value);
};

window.bindOverlayRanges = root => {
  let active = null;
  const move = event => {
    if (!active) return;
    const r = active.getBoundingClientRect(), thumb = 7.5;
    const min = Number(active.min), max = Number(active.max), step = Number(active.step) || .01;
    const ratio = Math.max(0, Math.min(1, (event.clientX - r.left - thumb) / Math.max(1, r.width - 2 * thumb)));
    active.value = String(Math.max(min, Math.min(max, min + Math.round(ratio * (max - min) / step) * step)));
    active.dispatchEvent(new Event('input', { bubbles: true }));
  };
  root.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.target.matches('input[type=range]:not(:disabled)')) return;
    active = event.target; event.preventDefault(); active.focus();
    active.dataset.dragging = 'true';
    try { active.setPointerCapture(event.pointerId); } catch {}
    move(event);
  });
  root.addEventListener('pointermove', move);
  const finish = () => { if (active) { delete active.dataset.dragging; active.dispatchEvent(new Event('change', { bubbles: true })); } active = null; };
  root.addEventListener('pointerup', finish);
  root.addEventListener('pointercancel', finish);
  root.addEventListener('lostpointercapture', finish);
};
// One DOM for the the preview AND the in-game Chromium surface. No native
// reconstruction of controls: their metrics, fonts and behavior stay identical.
window.mountOverlayPanel = (root, footer = 'Design inspired by the NVIDIA reference. Masking, models and DLSS sliders are not connected to the SDK.') => {
  const slider = (id, label, value) => `<label class="ol-slider" for="${id}"><span>${label}</span><input id="${id}" type="range" min="0" max="1" step="0.01" value="${value}"/><output for="${id}">${value.toFixed(2)}</output></label>`;
  root.innerHTML = `<div class="ol-panel" dir="ltr">
    <header><span class="ol-eyebrow">DLSS 5 SWAPPER CONTROLS</span><span class="ol-prototype">PREVIEW</span></header>
    <label class="ol-check ol-master"><input type="checkbox" checked/> DLSS ON <small>Preview only</small></label>
    <label class="ol-check ol-badge"><input type="checkbox"/> ON-SCREEN STATUS <small>Shows DLSS 5 On/Off over the game</small></label>
    <section><h4>GLOBAL CONTROLS</h4>${slider('olStructure', 'Structure Intensity', .38)}${slider('olTone', 'Tone Intensity', .28)}</section>
    <section class="ol-muted"><label class="ol-check"><input type="checkbox" disabled/> MODEL AUTOMASK <small>SDK required</small></label>${slider('olMaskStructure', 'Structure Intensity', 1)}</section>
    <section><label class="ol-check"><input type="checkbox" checked/> DEVELOPER MASKING <small>Demo groups</small></label>
      ${[['Pitcher', .45, .35], ['Grapes', 1, 1], ['Bottles', 1, 1]].map(([label, structure, tone], i) => `<div class="ol-group"><label class="ol-check"><input type="checkbox" checked/> ${label}</label>${slider(`olGroup${i}s`, 'Structure Intensity', structure)}${slider(`olGroup${i}t`, 'Tone Intensity', tone)}</div>`).join('')}
    </section><section><h4>MODELS <small>Preview selection</small></h4><div class="ol-models">${['A', 'B', 'C'].map((m, i) => `<button class="ol-model ${i ? '' : 'selected'}" aria-pressed="${!i}">Model ${m}</button>`).join('')}</div></section>
    <footer></footer></div>`;
  root.querySelector('footer').textContent = footer;
  root.querySelector('#olMaskStructure').disabled = true;
  for (const input of root.querySelectorAll('input[type="range"]')) input.oninput = () => { input.nextElementSibling.textContent = Number(input.value).toFixed(2); };
  for (const model of root.querySelectorAll('.ol-model')) model.onclick = () => {
    for (const item of root.querySelectorAll('.ol-model')) { item.classList.toggle('selected', item === model); item.setAttribute('aria-pressed', String(item === model)); }
  };
  if (!root.dataset.rangeBinding) { window.bindOverlayRanges(root); root.dataset.rangeBinding = 'true'; }
};

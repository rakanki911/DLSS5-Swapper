'use strict';
// The app's own way of asking. window.confirm draws the operating system's box:
// it cannot be styled, it says "dlss5-swapper" in the corner whatever the app
// is called, and it looks nothing like the thing it interrupts. This is the
// same question in the app's own hand.
//
// It resolves true or false like confirm() does, so a caller reads the same way:
//   if (!await ask({ title, body, confirm })) return;
(function (root) {
  const ICONS = {
    trash: '<path d="M4 7h16M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M6.5 7l.9 12.1A2 2 0 0 0 9.4 21h5.2a2 2 0 0 0 2-1.9L17.5 7M10 11v6M14 11v6"/>',
    restore: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4.5V10h5.5"/>',
    hide: '<path d="m3 3 18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.4 5.2A9.6 9.6 0 0 1 12 5c5 0 9 4.5 9 7a11 11 0 0 1-2.4 3.6M6.3 6.4A11.6 11.6 0 0 0 3 12c0 2.5 4 7 9 7a9.7 9.7 0 0 0 3.3-.6"/>',
    shield: '<path d="M12 3 5 6v5c0 4.7 2.8 8 7 10 4.2-2 7-5.3 7-10V6z"/><path d="m9 12 2 2 4-5"/>',
    question: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.8-.9 1.4v.4M12 17h.01"/>'
  };

  const escape = value => String(value == null ? '' : value)
    .replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

  // A blank line in the message is a paragraph break, which is how the strings
  // these replaced were already written.
  const paragraphs = body => String(body || '').split(/\n{2,}/)
    .map(part => `<p>${escape(part.trim()).replace(/\n/g, '<br>')}</p>`).join('');

  let box = null;
  function element() {
    if (box) return box;
    box = document.createElement('dialog');
    box.className = 'ask';
    box.setAttribute('aria-labelledby', 'askTitle');
    document.body.appendChild(box);
    return box;
  }

  /**
   * @returns {Promise<boolean>} true when the action was confirmed.
   */
  function ask({ kicker = 'DLSS 5 Swapper', title = '', body = '', confirm = 'OK', cancel = 'Cancel', icon = 'question', tone = 'danger' } = {}) {
    const dialog = element();
    dialog.className = `ask ask-${tone === 'accent' ? 'accent' : 'danger'}`;
    dialog.innerHTML = `
      <div class="ask-card">
        <button type="button" class="ask-x" data-ask="cancel" aria-label="${escape(cancel)}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>
        </button>
        <div class="ask-body">
          <span class="ask-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${ICONS[icon] || ICONS.question}</svg></span>
          <div class="ask-copy">
            ${kicker ? `<span class="ask-kicker">${escape(kicker)}</span>` : ''}
            <h2 id="askTitle">${escape(title)}</h2>
            ${paragraphs(body)}
          </div>
        </div>
        <div class="ask-foot">
          <button type="button" class="ask-ghost" data-ask="cancel">${escape(cancel)}</button>
          <button type="button" class="ask-go" data-ask="confirm">${escape(confirm)}</button>
        </div>
      </div>`;

    return new Promise(resolve => {
      const answer = (value) => {
        if (!dialog.open) return;
        dialog.removeEventListener('cancel', onCancel);
        dialog.removeEventListener('click', onClick);
        dialog.close();
        resolve(value);
      };
      // Escape closes it the way it closes every other dialog here, and means no.
      const onCancel = (event) => { event.preventDefault(); answer(false); };
      const onClick = (event) => {
        const button = event.target.closest('[data-ask]');
        if (button) return answer(button.dataset.ask === 'confirm');
        // The card fills the dialog, so a click landing on the dialog itself
        // landed on the dark around it.
        if (event.target === dialog) answer(false);
      };
      dialog.addEventListener('cancel', onCancel);
      dialog.addEventListener('click', onClick);
      dialog.showModal();
      dialog.querySelector('.ask-go').focus({ preventScroll: true });
    });
  }

  const api = { ask, ICONS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.ask = ask; root.askDialog = api; }
})(typeof window !== 'undefined' ? window : globalThis);

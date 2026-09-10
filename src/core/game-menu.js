'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_LABELS = {
  details: 'View game details', open: 'Open game folder', copy: 'Copy folder path',
  scan: 'Rescan this game', poster: 'Change cover', restore: 'Restore originals',
  community: 'Add to community-tested games',
  hide: 'Hide from library (keep files)', cancel: 'Cancel',
  confirmRestore: 'Restore the original files for this game?',
  restoreHint: 'Close the game first. Files installed by Swapper will be removed and backed-up originals restored.'
};

function hasBackup(dir) {
  return ['manifest.json', 'pending-switch.json'].some(name => {
    try { return fs.statSync(path.join(dir, '_DLSS5_Backup', name)).isFile(); } catch { return false; }
  });
}

function labelsFor(input = {}) {
  return Object.fromEntries(Object.entries(DEFAULT_LABELS).map(([key, fallback]) => [
    key, typeof input?.[key] === 'string' && input[key].trim() && input[key].length <= 1000 ? input[key] : fallback
  ]));
}

function template({ name, labels, busy, restorable }, select) {
  // Electron treats & as a Windows mnemonic; game titles should remain literal.
  const literal = text => String(text).replace(/&/g, '&&');
  const item = (action, enabled = !busy) => ({
    id: action, label: literal(labels[action]), enabled,
    click: () => { if (enabled) select(action); }
  });
  return [
    { label: literal(name), enabled: false },
    { type: 'separator' },
    item('details'), item('open', true), item('copy', true),
    { type: 'separator' },
    item('scan'), item('poster'), item('restore', !busy && restorable),
    { type: 'separator' }, item('community'),
    { type: 'separator' }, item('hide')
  ];
}

// Native menus provide edge positioning, outside-click/Escape dismissal and
// keyboard navigation without drawing a second, inaccessible overlay.
async function show({ Menu, dialog, window, dir, name, labels: input, busy = false, position }) {
  const labels = labelsFor(input);
  const action = await new Promise(resolve => {
    const menu = Menu.buildFromTemplate(template({ name, labels, busy, restorable: hasBackup(dir) }, resolve));
    // Allow command dispatch to finish before treating menu closure as Cancel.
    const options = { window, sourceType: position?.keyboard ? 'keyboard' : 'mouse', callback: () => setImmediate(() => resolve(null)) };
    if (Number.isFinite(position?.x) && Number.isFinite(position?.y)) {
      const [width, height] = window.getContentSize();
      options.x = Math.round(Math.max(0, Math.min(position.x, width - 1)));
      options.y = Math.round(Math.max(0, Math.min(position.y, height - 1)));
    }
    menu.popup(options);
  });
  if (action !== 'restore') return action;
  if (window.isDestroyed() || !hasBackup(dir)) return null;
  const result = await dialog.showMessageBox(window, {
    type: 'warning', title: labels.restore, message: labels.confirmRestore,
    detail: `${name}\n${dir}\n\n${labels.restoreHint}`,
    buttons: [labels.restore, labels.cancel], defaultId: 1, cancelId: 1, noLink: true
  });
  return result.response === 0 ? action : null;
}

module.exports = { hasBackup, labelsFor, template, show };

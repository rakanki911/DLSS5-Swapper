'use strict';
// Backup manifests live with their game, not in the app profile. Keeping the
// reader here lets History include Steam-discovered games and installations
// made before a library was manually added to the app.
const fs = require('fs');
const path = require('path');

const BACKUP_DIR = '_DLSS5_Backup';
const MANIFEST_NAME = /^manifest\.json(?:\.done(?:-\d+)?)?$/;

function rowsForGames(dirs) {
  const rows = [];
  for (const dir of new Set(dirs)) {
    const backup = path.join(dir, BACKUP_DIR);
    let names = [];
    try { names = fs.readdirSync(backup).filter((name) => MANIFEST_NAME.test(name)); } catch { continue; }
    for (const name of names) {
      try {
        const manifest = JSON.parse(fs.readFileSync(path.join(backup, name), 'utf8'));
        rows.push({
          name: path.basename(dir),
          dir,
          date: manifest.date,
          replaced: Array.isArray(manifest.replaced) ? manifest.replaced.length : 0,
          added: Array.isArray(manifest.added) ? manifest.added.length : 0,
          undone: name !== 'manifest.json'
        });
      } catch {}
    }
  }
  return rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

module.exports = { rowsForGames };

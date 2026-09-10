'use strict';
// Every report worth answering has needed the same four things: the app's own
// install log, the game's ReShade.log, the game's dlss5-feed.log, and which
// driver the person is on. Asking for them one at a time costs a round trip per
// report, and half arrive incomplete. This gathers them into one file.
//
// Nothing is collected that the person cannot see first: report() returns the
// list of sources so the app can show them before anything is written.
const fs = require('fs');
const path = require('path');

// A ReShade log from a long session runs to megabytes and the useful part is
// the end. Keep the tail, and say so where it was cut.
const TAIL_BYTES = 256 * 1024;
const BACKUP_DIR = '_DLSS5_Backup';

// The logs a game writes beside its executable, in the order they matter.
const GAME_LOGS = [
  'dlss5-feed.log',
  'ReShade.log',
  path.join('host64', 'dlss5-feed-host.log'),
  path.join('host64', 'ReShade.log'),
  'dlss5-feed-crash.dmp.txt'
];

function readTail(file) {
  const size = fs.statSync(file).size;
  if (size <= TAIL_BYTES) return { text: fs.readFileSync(file, 'utf8'), size, truncated: false };
  const handle = fs.openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(TAIL_BYTES);
    fs.readSync(handle, buffer, 0, TAIL_BYTES, size - TAIL_BYTES);
    return { text: buffer.toString('utf8'), size, truncated: true };
  } finally {
    fs.closeSync(handle);
  }
}

// What would go in, without reading any of it. The app shows this and waits.
function sources({ gameDir, exeDir, userData }) {
  const found = [];
  const add = (label, file) => {
    let stat;
    try { stat = fs.statSync(file); } catch { return; }
    if (stat.isFile()) found.push({ label, file, bytes: stat.size });
  };
  if (exeDir) for (const name of GAME_LOGS) add(`game: ${name}`, path.join(exeDir, name));
  if (gameDir) {
    add('install manifest', path.join(gameDir, BACKUP_DIR, 'manifest.json'));
    // The executable's own folder is usually not the game folder.
    if (!exeDir || path.resolve(exeDir) !== path.resolve(gameDir)) {
      for (const name of GAME_LOGS) add(`game: ${name}`, path.join(gameDir, name));
    }
  }
  if (userData) add('app crash log', path.join(userData, 'crash.log'));
  return found;
}

function section(title, body) {
  const rule = '='.repeat(72);
  return `${rule}\n${title}\n${rule}\n${body}\n`;
}

// `facts` is whatever the caller already knows - version, platform, GPU rows,
// the activity log. This module never goes looking for machine details of its
// own, so what ends up in the file stays predictable.
function report({ gameDir, exeDir, userData, facts = {}, now = new Date() }) {
  const found = sources({ gameDir, exeDir, userData });
  const head = [
    `DLSS 5 Swapper diagnostics`,
    `generated: ${now.toISOString()}`,
    ...Object.entries(facts)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
  ].join('\n');

  let text = section('Environment', head);
  if (!found.length) {
    text += section('Logs', 'No log files were found for this game.\n' +
      'Run the install once, launch the game, then save this again.');
    return { text, sources: found };
  }
  for (const item of found) {
    let body;
    try {
      const read = readTail(item.file);
      body = read.truncated
        ? `[the first ${read.size - TAIL_BYTES} bytes are omitted; this is the end of the file]\n\n${read.text}`
        : read.text;
    } catch (error) {
      body = `Could not be read: ${error.message}`;
    }
    text += section(`${item.label}  (${item.file}, ${item.bytes} bytes)`, body);
  }
  return { text, sources: found };
}

module.exports = { report, sources, GAME_LOGS, TAIL_BYTES };

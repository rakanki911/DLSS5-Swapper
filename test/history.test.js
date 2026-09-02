'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { rowsForGames } = require('../src/core/history');

test('history reads active and timestamped restored manifests', (t) => {
  const game = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-history-'));
  t.after(() => fs.rmSync(game, { recursive: true, force: true }));
  const backup = path.join(game, '_DLSS5_Backup');
  fs.mkdirSync(backup);
  fs.writeFileSync(path.join(backup, 'manifest.json'), JSON.stringify({ date: '2026-09-02T10:00:00Z', replaced: [{}], added: [{}, {}] }));
  fs.writeFileSync(path.join(backup, 'manifest.json.done-123'), JSON.stringify({ date: '2026-09-02T11:00:00Z', replaced: [], added: [{}] }));

  const rows = rowsForGames([game]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].undone, true);
  assert.equal(rows[0].added, 1);
  assert.equal(rows[1].undone, false);
  assert.equal(rows[1].replaced, 1);
});

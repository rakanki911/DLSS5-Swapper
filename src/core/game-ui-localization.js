'use strict';
// Translate copied game UI files after the original payload has passed its
// integrity checks. Internal shader names and all effect values stay intact.
const fs = require('node:fs');
const path = require('node:path');
const ini = require('./feeder-config');
const journal = require('./file-journal');
const { translateShader } = require('./shader-i18n');

function changes({ gameDir, exePath, language }, manifest) {
  if (language !== 'zh') return [];
  const exeDir = path.dirname(exePath);
  const shaderRoot = path.join(exeDir, 'reshade-shaders', 'Shaders');
  const files = new Set([path.join(exeDir, 'ReShade.ini'), path.join(exeDir, 'host64', 'ReShade.ini')]);
  for (const rel of [...(manifest.added || []), ...(manifest.replaced || []).map(item => item.rel)]) {
    if (!/\.fxh?$/i.test(rel)) continue;
    const file = journal.safePath(gameDir, rel);
    const within = path.relative(shaderRoot, file);
    if (within && !within.startsWith('..') && !path.isAbsolute(within)) files.add(file);
  }
  const result = [];
  for (const file of files) {
    const rel = path.relative(gameDir, file);
    journal.safePath(gameDir, rel);
    if (!fs.existsSync(file) || fs.statSync(file).size > 4 * 1024 * 1024) continue;
    const before = fs.readFileSync(file, 'utf8');
    const shader = /\.fxh?$/i.test(file);
    const after = shader ? translateShader(before, language) : ini.setIni(before, 'OVERLAY', 'Language', 'zh-CN');
    if (after !== before) result.push({ file, rel, before, after, kind: shader ? 'shader' : 'config' });
  }
  return result;
}

async function apply(config, manifest, writeTracked) {
  const edits = changes(config, manifest);
  for (const edit of edits) await writeTracked(manifest, config.gameDir, edit.file, edit.after, { kind: edit.kind });
  return edits.length;
}

module.exports = { changes, apply };

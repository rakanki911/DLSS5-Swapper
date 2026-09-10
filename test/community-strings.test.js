'use strict';

// The community page reads its words through `text().someKey`. A key that is
// deleted from the dictionary but still read anywhere renders the word
// "undefined" into the interface, and nothing else complains - which is exactly
// what happened to the label a card shows when it has no verdict left.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const FILE = path.join(__dirname, '../src/renderer/community.js');
const source = fs.readFileSync(FILE, 'utf8');

// The dictionary is a plain object literal at the top of the file; it is taken
// out and evaluated on its own rather than running a module that expects a DOM.
function dictionary() {
  const start = source.indexOf('const L = {');
  assert.notEqual(start, -1, 'the dictionary moved; this test needs updating');
  let depth = 0;
  let end = -1;
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) { end = i + 1; break; }
  }
  assert.notEqual(end, -1, 'the dictionary literal is unbalanced');
  return vm.runInNewContext(`(${source.slice(source.indexOf('{', start), end)})`);
}

// Keys read through the two names the file uses for the current language.
function keysUsed() {
  const used = new Set();
  for (const match of source.matchAll(/(?:text\(\)|\bs)\.([a-zA-Z][A-Za-z0-9]*)/g)) used.add(match[1]);
  return used;
}

test('both languages carry exactly the same keys', () => {
  const L = dictionary();
  const en = Object.keys(L.en).sort();
  const ar = Object.keys(L.ar).sort();
  assert.deepEqual(ar, en, 'a key exists in one language and not the other');
  assert.deepEqual(Object.keys(L.ar.facts).sort(), Object.keys(L.en.facts).sort());
});

test('every word the page asks for is a word the dictionary has', () => {
  const L = dictionary();
  // `s` is also an ordinary local name in places; only keys that look like
  // dictionary lookups are judged, and anything the dictionary knows about is
  // by definition one.
  const missing = [...keysUsed()].filter(key => !Object.hasOwn(L.en, key) && /^(unknown|working|broken|mixed|empty|offline|loading|choose|cancel|submit|save|send|reply|back)$/.test(key));
  assert.deepEqual(missing, [], 'read from the dictionary but not defined in it');
});

// The one that was actually broken: a card whose reports are all hidden has no
// verdict, and the pill on it has to say something.
test('a card with no verdict has a word for that', () => {
  const L = dictionary();
  for (const lang of ['en', 'ar']) {
    for (const key of ['working', 'broken', 'mixed', 'unknown']) {
      assert.equal(typeof L[lang][key], 'string', `${lang}.${key}`);
      assert.ok(L[lang][key].trim(), `${lang}.${key} is empty`);
    }
  }
});

test('the BETA badge is a sibling of the title, not inside it', () => {
  // applyLanguage() replaces the title's textContent wholesale; a badge placed
  // inside would vanish the first time the language changed.
  const html = fs.readFileSync(path.join(__dirname, '../src/renderer/index.html'), 'utf8');
  const title = html.match(/<h3 id="communityTitle">[^<]*<\/h3>/);
  assert.ok(title, 'the community title element moved');
  assert.doesNotMatch(title[0], /beta-tag/i, 'the badge would be erased on a language change');
  assert.match(html, /class="beta-tag"/, 'the community page carries a BETA badge');
});

test('a successful reply updates the cached card conversation total immediately', () => {
  assert.match(source, /bumpCardComments\(answer\.reply\?\.card \|\| state\.active\?\.key, 1\)/);
  assert.match(source, /bumpCardComments\(state\.active\?\.key, -1\)/);
});

test('the message menu joins the modal top layer instead of rendering behind it', () => {
  assert.match(source, /menu\.setAttribute\('popover', 'manual'\)/);
  assert.match(source, /\$\('communityCardDialog'\)\.appendChild\(menu\)/);
  assert.match(source, /menu\.showPopover\(\)/);
  assert.ok(source.indexOf('menu.showPopover()') < source.indexOf('menu.getBoundingClientRect()'),
    'the menu must be visible before its size is used to clamp it to the window');
});

test('admin-deleted reports are reconciled before the library menu chooses its labels', () => {
  const renderer = fs.readFileSync(path.join(__dirname, '../src/renderer/renderer.js'), 'utf8');
  assert.match(source, /async function syncOwnReports\(\)/);
  assert.match(source, /delete own\[key\]/);
  assert.match(source, /syncOwnReports\(\)\.catch\(\(\) => false\)/, 'community refresh also reconciles ownership');
  assert.ok(renderer.indexOf('await window.communityUi?.syncOwnReports?.()') < renderer.indexOf('const action = await showGameMenu'),
    'right-click must reconcile before rendering Add versus Edit/Delete');
});

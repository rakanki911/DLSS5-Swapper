'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const wiki = require('../src/pcgamingwiki');

function reply(body, init = {}) {
  return {
    ok: init.ok !== false,
    status: init.status || 200,
    headers: new Map(Object.entries(init.headers || { 'content-type': 'application/json' })),
    json: async () => body,
    arrayBuffer: async () => init.bytes || Buffer.alloc(0)
  };
}

function router(routes) {
  return async (url) => {
    for (const [match, body] of Object.entries(routes)) {
      if (url.includes(match)) return typeof body === 'function' ? body(url) : reply(body);
    }
    throw new Error(`unexpected request: ${url}`);
  };
}

function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcgw-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

// Battlefield™ 6 finds nothing in a wiki search; Battlefield 6 does.
test('a trademark sign is dropped before the wiki is searched', () => {
  assert.equal(wiki.searchName('Battlefield™ 6'), 'Battlefield 6');
  assert.equal(wiki.searchName('CODE VEIN II'), 'CODE VEIN II');
  assert.equal(wiki.searchName('Control\u2013Resonant'), 'Control-Resonant');
});

test('the infobox cover is read as a file name, however the template wrote it', () => {
  const infobox = '{{Infobox game\n|cover = Pragmata cover.jpg\n|title = Pragmata\n}}';
  assert.equal(wiki.coverFile(infobox), 'Pragmata cover.jpg');
  assert.equal(wiki.coverFile('| cover = File:Wardogs cover.jpg'), 'Wardogs cover.jpg');
  assert.equal(wiki.coverFile('| cover = [[Code Vein 2 cover.jpg]]'), 'Code Vein 2 cover.jpg');
  assert.equal(wiki.coverFile('| cover = Shadowed cover.jpg|caption = box art'), 'Shadowed cover.jpg');
  assert.equal(wiki.coverFile('{{Infobox game}}'), null);
  assert.equal(wiki.coverFile(''), null);
});

test('a name with no extension is tried as the .jpg the wiki stores it under', () => {
  assert.deepEqual(wiki.fileCandidates('Pragmata cover.jpg'), ['Pragmata cover.jpg']);
  assert.deepEqual(wiki.fileCandidates('Pragmata cover'),
    ['Pragmata cover', 'Pragmata cover.jpg', 'Pragmata cover.png']);
  assert.deepEqual(wiki.fileCandidates(null), []);
});

test('a game Steam has no capsule for gets its box art from the wiki', async () => {
  const send = router({
    'list=search': { query: { search: [{ title: 'Pragmata' }] } },
    'action=parse': { parse: { wikitext: { '*': '{{Infobox game\n|cover = Pragmata cover.jpg\n}}' } } },
    'prop=imageinfo': {
      query: {
        pages: {
          1: { imageinfo: [{ url: 'https://images.pcgamingwiki.com/f/fb/Pragmata_cover.jpg', width: 600, height: 900 }] }
        }
      }
    }
  });
  const found = await wiki.look('PRAGMATA', { send });
  assert.equal(found.page, 'Pragmata');
  assert.equal(found.url, 'https://images.pcgamingwiki.com/f/fb/Pragmata_cover.jpg');
  assert.equal(found.height, 900);
});

test('a game the wiki has no page for reports nothing at all', async () => {
  const send = router({ 'list=search': { query: { search: [] } } });
  assert.equal(await wiki.look('Some Game Nobody Wrote About', { send }), null);
});

// The infobox is often filled in later than the page itself.
test('a page whose infobox names no cover still has one to lead with', async () => {
  const send = router({
    'list=search': { query: { search: [{ title: 'Wardogs' }] } },
    'action=parse': { parse: { wikitext: { '*': '{{Infobox game}}' } } },
    'prop=pageimages': {
      query: { pages: { 1: { thumbnail: { source: 'https://images.pcgamingwiki.com/6/64/Wardogs_cover.jpg', width: 600, height: 900 } } } }
    }
  });
  const found = await wiki.look('WARDOGS', { send });
  assert.equal(found.page, 'Wardogs');
  assert.equal(found.url, 'https://images.pcgamingwiki.com/6/64/Wardogs_cover.jpg');
});

test('a name the wiki cannot match as written is searched again as it came in', async () => {
  const seen = [];
  const send = async (url) => {
    if (!url.includes('list=search')) throw new Error(`unexpected request: ${url}`);
    seen.push(decodeURIComponent(url));
    if (seen.length === 1) return reply({ query: { search: [] } });
    return reply({ query: { search: [{ title: 'Battlefield 6' }] } });
  };
  const sendWithCover = async (url) => {
    if (url.includes('list=search')) return send(url);
    if (url.includes('action=parse')) {
      return reply({ parse: { wikitext: { '*': '|cover = Cover.jpg' } } });
    }
    return reply({ query: { pages: { 1: { imageinfo: [{ url: 'https://images.pcgamingwiki.com/c.jpg' }] } } } });
  };
  const found = await wiki.look('Battlefield™ 6', { send: sendWithCover });
  assert.equal(found.page, 'Battlefield 6');
  assert.equal(seen[0].includes('Battlefield 6'), true, 'the sanitised name is tried first');
  assert.equal(seen[1].includes('Battlefield™ 6'), true, 'then the name as it arrived');
});

test('an image is written where the app asked for it', async (t) => {
  const dest = path.join(tempDir(t), 'cover.jpg');
  const bytes = Buffer.alloc(4096, 7);
  const send = async () => reply(null, { headers: { 'content-type': 'image/jpeg' }, bytes });
  assert.equal(await wiki.download('https://images.pcgamingwiki.com/x.jpg', dest, { send }), dest);
  assert.deepEqual(fs.readFileSync(dest), bytes);
});

// Cloudflare answers a client it does not like with a challenge page, and that
// page has arrived with a 200 before now. Saving one would put "checking your
// browser" on a game card.
test('a challenge page is never saved as a cover', async (t) => {
  const dest = path.join(tempDir(t), 'cover.jpg');
  const send = async () => reply(null, {
    headers: { 'content-type': 'text/html; charset=UTF-8' },
    bytes: Buffer.alloc(6000, 32)
  });
  await assert.rejects(
    wiki.download('https://images.pcgamingwiki.com/x.jpg', dest, { send }),
    /not an image/);
  assert.equal(fs.existsSync(dest), false);
});

test('a placeholder smaller than artwork is rejected', async (t) => {
  const dest = path.join(tempDir(t), 'cover.jpg');
  const send = async () => reply(null, { headers: { 'content-type': 'image/jpeg' }, bytes: Buffer.alloc(1655) });
  await assert.rejects(
    wiki.download('https://images.pcgamingwiki.com/x.jpg', dest, { send }),
    /too small/);
  assert.equal(fs.existsSync(dest), false);
});

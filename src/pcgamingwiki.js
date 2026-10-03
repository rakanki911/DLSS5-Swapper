'use strict';
// Box art for the games Steam has no capsule for.
//
// Steam stays the first source and should stay the first source: an app id
// gives three assets from one URL shape, with no search and no chance of
// matching the wrong game. But a game that has not shipped yet has an app id
// with nothing behind it - library_600x900.jpg and library_hero.jpg both come
// back 404 - and those are exactly the cards that showed two initials.
//
// PCGamingWiki has the box art for them, and it has a MediaWiki API, so this
// needs no key and no rendering of a page.
//
// The wiki is behind Cloudflare, and it answers clients differently. Measured
// from one machine on one connection: the API answers Node's fetch with 200,
// while the image host answers Node's fetch with 403, a headless browser with a
// challenge page, and Electron's own network stack with the JPEG itself. So the
// bytes are asked for through Chromium when there is one and through global
// fetch otherwise - which is what a plain node run, and the tests, get.
const fs = require('fs');
const path = require('path');
const art = require('./steamart');

const API = 'https://www.pcgamingwiki.com/w/api.php';
const UA = 'DLSS5-Swapper';
// A missing asset can come back as a tiny placeholder rather than a 404.
const MIN_BYTES = 2000;

function transport() {
  try {
    const { net } = require('electron');
    if (net && typeof net.fetch === 'function') return (url, init) => net.fetch(url, init);
  } catch { /* not running inside Electron: the tests, or a plain node run */ }
  return (url, init) => fetch(url, init);
}

const api = (params) => `${API}?${params}&format=json&redirects=1`;
const searchUrl = (name) =>
  api(`action=query&list=search&srsearch=${encodeURIComponent(name)}&srlimit=5`);
const wikitextUrl = (title) =>
  api(`action=parse&page=${encodeURIComponent(title)}&prop=wikitext`);
const imageInfoUrl = (file) =>
  api(`action=query&titles=${encodeURIComponent(`File:${file}`)}&prop=imageinfo&iiprop=url|size`);
const pageImageUrl = (title) =>
  api(`action=query&titles=${encodeURIComponent(title)}&prop=pageimages&pithumbsize=900`);

// "Battlefield™ 6" finds nothing in a wiki search; "Battlefield 6" does.
function searchName(name) {
  return String(name || '')
    .replace(/[™®©℠]/g, ' ')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

// The cover is a named parameter of the infobox template, so it is one field to
// read rather than something to pull out of rendered HTML.
function coverFile(wikitext) {
  const match = /\|\s*cover\s*=\s*([^\n|]+)/i.exec(wikitext || '');
  if (!match) return null;
  const value = match[1].trim()
    .replace(/^\[\[|\]\]$/g, '')
    .replace(/^File:/i, '')
    .replace(/\|.*$/, '')
    .trim();
  return value || null;
}

// A template that names no extension is stored as a .jpg in practice, and a
// miss here only means the next name is tried.
function fileCandidates(file) {
  if (!file) return [];
  const names = [file];
  if (!/\.(jpe?g|png|webp)$/i.test(file)) names.push(`${file}.jpg`, `${file}.png`);
  return names;
}

function searchRows(json) {
  const hits = (json && json.query && json.query.search) || [];
  return hits.map((hit) => ({ name: hit.title, type: 'app' }));
}

function firstPage(json, read) {
  const pages = (json && json.query && json.query.pages) || {};
  for (const page of Object.values(pages)) {
    const found = read(page);
    if (found) return found;
  }
  return null;
}

const imageInfo = (json) => firstPage(json, (page) => {
  const info = page && page.imageinfo && page.imageinfo[0];
  return info && info.url
    ? { url: info.url, width: info.width || null, height: info.height || null }
    : null;
});

const pageImage = (json) => firstPage(json, (page) => {
  const thumb = page && page.thumbnail;
  return thumb && thumb.source
    ? { url: thumb.source, width: thumb.width || null, height: thumb.height || null }
    : null;
});

async function getJson(url, send) {
  const response = await send(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!response.ok) throw new Error(`PCGamingWiki replied ${response.status}`);
  return response.json();
}

// A search for a short title happily returns a longer one, so the closest page
// wins rather than the first row - the same rule the Steam lookup uses.
async function findPage(name, send) {
  const attempts = [searchName(name), String(name || '').trim()].filter(Boolean);
  for (const attempt of attempts) {
    const hit = art.pick(searchRows(await getJson(searchUrl(attempt), send)), attempt);
    if (hit) return hit.name;
  }
  return null;
}

async function coverFor(title, send) {
  let file = null;
  try {
    const parsed = await getJson(wikitextUrl(title), send);
    file = coverFile(parsed && parsed.parse && parsed.parse.wikitext && parsed.parse.wikitext['*']);
  } catch { /* the page image is still worth a try */ }

  for (const candidate of fileCandidates(file)) {
    try {
      const found = imageInfo(await getJson(imageInfoUrl(candidate), send));
      if (found) return found;
    } catch { /* try the next name */ }
  }
  try {
    return pageImage(await getJson(pageImageUrl(title), send));
  } catch {
    return null;
  }
}

// The page and the picture it leads with, or null when the wiki has no page for
// the game - a miss costs three requests and no more.
async function look(name, deps = {}) {
  const send = deps.send || transport();
  const title = await findPage(name, send);
  if (!title) return null;
  const image = await coverFor(title, send);
  return image ? { page: title, ...image } : null;
}

async function download(url, dest, deps = {}) {
  const send = deps.send || transport();
  const response = await send(url, { headers: { 'User-Agent': UA } });
  if (!response.ok) throw new Error(`download failed (${response.status})`);
  // A Cloudflare challenge is a page, and it has arrived with a 200 before now.
  // Saving one would put a "checking your browser" card in the library, so the
  // content type is checked before the bytes are trusted.
  const type = response.headers.get('content-type') || '';
  if (!/^image\//i.test(type)) throw new Error(`not an image (${type || 'no content type'})`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < MIN_BYTES) throw new Error('asset too small to be artwork');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buffer);
  return dest;
}

module.exports = {
  look, download, searchName, coverFile, fileCandidates, searchRows, imageInfo, pageImage, transport
};

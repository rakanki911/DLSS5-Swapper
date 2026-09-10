'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { CommunityClient } = require('../src/community-client');

function fixture(t, replies = [], options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-community-client-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    const reply = replies.shift() || { status: 200, body: {} };
    return new Response([204, 205, 304].includes(reply.status) ? null : JSON.stringify(reply.body), {
      status: reply.status,
      headers: { 'content-type': 'application/json', ...(reply.headers || {}) }
    });
  };
  return { calls, client: new CommunityClient({ file: path.join(root, 'community.json'), baseUrl: 'https://example.test', fetchImpl, ...options }) };
}

test('one private install id is generated and reused for writes', async (t) => {
  const { client, calls } = fixture(t, [{ body: { name: 'Rakan', icon: 3, tag: 'abcd' } }, { body: { ok: true } }]);
  await client.saveProfile({ name: 'Rakan', icon: 3 });
  await client.react(7, '🔥');
  const first = calls[0].options.headers['x-install'];
  assert.match(first, /^[A-Za-z0-9_-]{16,64}$/);
  assert.equal(calls[1].options.headers['x-install'], first);
  assert.equal(fs.readFileSync(client.file, 'utf8').includes(first), true);
});

test('reads never send the install id and encode card keys', async (t) => {
  const { client, calls } = fixture(t, [{ body: { key: 'steam:10' }, headers: { etag: '"7"' } }]);
  const result = await client.card('steam:10');
  assert.equal(calls[0].url, 'https://example.test/v1/cards/steam%3A10');
  assert.equal(calls[0].options.headers['x-install'], undefined);
  assert.equal(result.etag, '"7"');
});

test('the private report inventory identifies this install and is never a public cached read', async (t) => {
  const { client, calls } = fixture(t, [{ body: { reports: [{ id: 7, card: 'steam:10' }] } }]);
  assert.deepEqual(await client.myReports(), { reports: [{ id: 7, card: 'steam:10' }] });
  assert.equal(calls[0].url, 'https://example.test/v1/me/reports');
  assert.ok(calls[0].options.headers['x-install']);
});

test('admin avatar paths become public API URLs in cards and replies', async (t) => {
  const path = '/v1/admins/0123456789abcdefabcd/avatar.png?v=2';
  const { client } = fixture(t, [
    { body: { announcements: [{ by: { admin: true, avatar: path } }] } },
    { body: { replies: [{ by: { admin: true, avatar: path } }] } }
  ]);
  const card = await client.card('steam:10');
  const thread = await client.replies(1);
  assert.equal(card.data.announcements[0].by.avatar, 'https://example.test' + path);
  assert.equal(thread.replies[0].by.avatar, 'https://example.test' + path);
});

test('the cards page keeps the server total separate from filtered results', async (t) => {
  const { client } = fixture(t, [{ body: { cards: [{ key: 'steam:10' }], total: 1248 } }]);
  assert.deepEqual(await client.cardsPage({ status: 'working' }), {
    cards: [{ key: 'steam:10' }], total: 1248
  });
});

test('shared poster and hero paths become API URLs in the cards page', async (t) => {
  const poster = '/v1/cards/steam%3A10/art/poster.jpg?v=4';
  const hero = '/v1/cards/steam%3A10/art/hero.jpg?v=4';
  const { client } = fixture(t, [{ body: { cards: [{ key: 'steam:10', art: { poster, hero } }], total: 1 } }]);
  const page = await client.cardsPage();
  assert.equal(page.cards[0].art.poster, 'https://example.test' + poster);
  assert.equal(page.cards[0].art.hero, 'https://example.test' + hero);
});

test('a 304 is returned as a small not-modified result', async (t) => {
  const { client } = fixture(t, [{ status: 304, body: null, headers: { etag: '"9"' } }]);
  assert.deepEqual(await client.updates('steam:10', 9, '"9"'), { notModified: true, etag: '"9"' });
});

test('server rejection text survives for the settings page', async (t) => {
  const { client } = fixture(t, [{ status: 400, body: { error: 'reserved_name', message: 'That name is reserved.' } }]);
  await assert.rejects(() => client.saveProfile({ name: 'admin', icon: 0 }), error => {
    assert.equal(error.code, 'reserved_name');
    assert.equal(error.message, 'That name is reserved.');
    return true;
  });
});

test('account removal calls DELETE /v1/me and clears the local public profile', async (t) => {
  const { client, calls } = fixture(t, [
    { body: { name: 'Rakan', icon: 3, tag: 'abcd' } },
    { body: { ok: true, reports: 2, replies: 1 } }
  ]);
  await client.saveProfile({ name: 'Rakan', icon: 3 });
  const removed = await client.deleteMe();
  assert.deepEqual(removed, { ok: true, reports: 2, replies: 1 });
  assert.equal(calls[1].options.method, 'DELETE');
  assert.equal(calls[1].url, 'https://example.test/v1/me');
  assert.ok(calls[1].options.headers['x-install']);
  assert.deepEqual(client.profile(), { name: null, icon: 0 });
});

test('an administrator code is verified without ever being written to community state', async (t) => {
  const token = 'dlss5_admin_' + 'A'.repeat(43);
  const admin = { name: 'Rakanki', tag: 'ADMIN', admin: true, avatar: null };
  const { client, calls } = fixture(t, [{ body: { ok: true, admin } }], { getAdminToken: () => token });
  assert.deepEqual(await client.adminLogin(token), admin);
  assert.equal(calls[0].url, 'https://example.test/v1/admin/session');
  assert.equal(calls[0].options.headers.authorization, `Bearer ${token}`);
  assert.equal(calls[0].options.headers['x-install'], undefined);
  assert.equal(fs.readFileSync(client.file, 'utf8').includes(token), false);
  assert.deepEqual(client.profile().admin, admin);
});

test('administrator mode routes replies through the official endpoint and logout restores the normal account', async (t) => {
  const token = 'dlss5_admin_' + 'B'.repeat(43);
  const admin = { name: 'Rakanki', tag: 'ADMIN', admin: true, avatar: null };
  let activeToken = token;
  const { client, calls } = fixture(t, [
    { body: { ok: true, admin } },
    { body: { ok: true, id: 7, admin } }
  ], { getAdminToken: () => activeToken });
  await client.adminLogin(token);
  await client.reply(42, 'Official answer', ['ignored']);
  assert.equal(calls[1].url, 'https://example.test/v1/admin/replies');
  assert.equal(calls[1].options.headers.authorization, `Bearer ${token}`);
  assert.equal(calls[1].options.headers['x-install'], undefined);
  assert.deepEqual(JSON.parse(calls[1].options.body), { reportId: 42, body: 'Official answer', mentions: ['ignored'] });
  activeToken = null;
  client.adminLogout();
  assert.equal(client.profile().admin, undefined);
});

test('administrator mode edits, deletes and moderates through protected endpoints', async (t) => {
  const token = 'dlss5_admin_' + 'C'.repeat(43);
  const { client, calls } = fixture(t, [
    { body: { ok: true } }, { body: { ok: true } }, { body: { ok: true } }
  ], { getAdminToken: () => token });
  await client.editReply('admin-7', 'Corrected');
  await client.withdrawReply('admin-7');
  await client.adminModerate('reply', 12, 'hide');
  assert.deepEqual(calls.map(call => [call.options.method, call.url]), [
    ['PUT', 'https://example.test/v1/admin/replies/admin-7'],
    ['DELETE', 'https://example.test/v1/admin/replies/admin-7'],
    ['POST', 'https://example.test/v1/admin/moderate']
  ]);
  assert.ok(calls.every(call => call.options.headers.authorization === `Bearer ${token}`));
  assert.ok(calls.every(call => call.options.headers['x-install'] === undefined));
});

'use strict';

// Naming somebody in a reply. The list is only ever people already on the card,
// and what is sent is a tag chosen from that list - never a name read back out
// of the text, which two people could share and anyone could type.

const test = require('node:test');
const assert = require('node:assert/strict');
const { mentionQuery, matchNames, insertMention, stillNamed } = require('../src/renderer/mentions');

const people = [
  { name: 'GHOST', tag: 'aaaa' },
  { name: 'Nordic', tag: 'bbbb' },
  { name: 'Nord Wind', tag: 'cccc' },
  { name: 'محمد', tag: 'dddd' }
];

test('the list opens on an @ and closes when there is not one', () => {
  assert.deepEqual(mentionQuery('hello @', 7), { start: 6, query: '' });
  assert.deepEqual(mentionQuery('hello @Nor', 10), { start: 6, query: 'nor' });
  assert.equal(mentionQuery('hello there', 11), null);
  assert.equal(mentionQuery('', 0), null);
});

// An address is not a mention, and neither is an "@" glued to a word.
test('an @ inside a word does not open it', () => {
  assert.equal(mentionQuery('write to me@example.com', 23), null);
  assert.equal(mentionQuery('cost 20@£4', 10), null);
  assert.deepEqual(mentionQuery('(@Nor', 5), { start: 1, query: 'nor' }, 'but after a bracket it does not either');
});

test('it reads the text before the caret, not the whole box', () => {
  const said = 'hi @Nor and then some more text';
  assert.deepEqual(mentionQuery(said, 7), { start: 3, query: 'nor' });
  assert.equal(mentionQuery(said, said.length), null, 'the caret has left the name behind');
});

test('names starting with what was typed come first, then names holding it', () => {
  assert.deepEqual(matchNames(people, 'nor').map(person => person.name), ['Nordic', 'Nord Wind']);
  assert.deepEqual(matchNames(people, 'wind').map(person => person.name), ['Nord Wind']);
  assert.deepEqual(matchNames(people, '').map(person => person.name).length, 4, 'a bare @ offers everyone');
  assert.deepEqual(matchNames(people, 'zzz'), []);
});

test('a name with a space in it can still be picked', () => {
  const where = mentionQuery('thanks @Nord W', 14);
  assert.deepEqual(matchNames(people, where.query).map(person => person.name), ['Nord Wind']);
});

test('names are not only Latin', () => {
  const where = mentionQuery('شكرا @مح', 8);
  assert.deepEqual(matchNames(people, where.query).map(person => person.name), ['محمد']);
});

test('picking a name replaces what was typed and leaves the caret after it', () => {
  const said = 'thanks @Nor for the help';
  const where = mentionQuery(said, 11);
  const put = insertMention(said, 11, where.start, 'Nordic');
  assert.equal(put.value, 'thanks @Nordic  for the help');
  assert.equal(put.value.slice(0, put.caret), 'thanks @Nordic ');
});

// Somebody taken back out of the sentence should not be told they were in it.
test('only the people still named are sent', () => {
  const picked = [people[0], people[1]];
  assert.deepEqual(stillNamed('@GHOST and @Nordic - thanks', picked), ['aaaa', 'bbbb']);
  assert.deepEqual(stillNamed('@GHOST - thanks', picked), ['aaaa']);
  assert.deepEqual(stillNamed('thanks, everyone', picked), []);
});

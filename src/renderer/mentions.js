'use strict';
// Finding the name somebody is part-way through typing, and putting the chosen
// one back into the sentence. Kept out of the page so it can be tested without
// a textarea, and so both halves - what is offered and what is inserted - are
// read from one place.
(function (root) {
  // A name may contain spaces, so the run after "@" is allowed to; it is
  // bounded because an unbounded one would match half a paragraph and offer
  // nothing. A second "@" starts again, and a newline ends it.
  const AT = /@([^@\n]{0,24})$/u;

  /**
   * What the person is typing after an "@", if anything.
   * @returns {{start:number, query:string}|null} where the "@" is, and the
   * lower-cased text after it - or null when the caret is not in a mention.
   */
  function mentionQuery(value, caret) {
    const upTo = String(value == null ? '' : value).slice(0, Math.max(0, caret | 0));
    const found = AT.exec(upTo);
    if (!found) return null;
    // "a@b.com" is an address, not a mention: what rules an "@" out is a letter
    // or digit immediately before it. A bracket or a dash does not - people do
    // write "(@Nordic".
    const before = upTo[upTo.length - found[0].length - 1];
    if (before !== undefined && /[\p{L}\p{N}]/u.test(before)) return null;
    return { start: upTo.length - found[0].length, query: found[1].trim().toLowerCase() };
  }

  /** The names on offer for what has been typed so far, best-first, capped. */
  function matchNames(people, query, limit = 6) {
    const wanted = String(query || '').toLowerCase();
    const named = (people || []).filter(person => person && person.name);
    if (!wanted) return named.slice(0, limit);
    const starts = named.filter(person => person.name.toLowerCase().startsWith(wanted));
    const holds = named.filter(person => !starts.includes(person) && person.name.toLowerCase().includes(wanted));
    return starts.concat(holds).slice(0, limit);
  }

  /** The sentence with the chosen name in it, and where the caret belongs. */
  function insertMention(value, caret, start, name) {
    const text = String(value == null ? '' : value);
    const at = Math.max(0, caret | 0);
    const head = `${text.slice(0, start)}@${name} `;
    return { value: head + text.slice(at), caret: head.length };
  }

  /**
   * Of everyone picked while writing, the ones still named in the finished
   * sentence. Somebody deleted from it should not be told they were talked
   * about.
   */
  const stillNamed = (said, picked) => (picked || [])
    .filter(person => String(said).includes(`@${person.name}`))
    .map(person => person.tag);

  const api = { mentionQuery, matchNames, insertMention, stillNamed };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.mentions = api;
})(typeof window !== 'undefined' ? window : globalThis);

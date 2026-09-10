'use strict';
// The bridge used to require exactly eight Feeder tools whose effect string was
// the literal "Feeder 0.12.0". Adding a control, or upgrading the Feeder, made
// every status the overlay sent invalid - and the panel then showed nothing and
// said nothing about why. These hold the contract to the shape instead.
const test = require('node:test');
const assert = require('node:assert/strict');
const protocol = require('../src/overlay-protocol');

const tool = (i, over = {}) => ({
  id: 301 + i, kind: i === 0 ? 1 : 0, effect: 'Feeder 0.15.1', name: 'Control ' + i,
  min: 0, max: 1, step: 1, value: 0, available: true, ...over
});
const status = (count, over = {}) => ({
  epoch: 1, effects: true, tools: [], feedPresent: true, feedReason: 'ok',
  feedTools: Array.from({ length: count }, (_, i) => tool(i)), ...over
});

test('a Feeder that grew two controls is still accepted', () => {
  const ten = protocol.status(status(10));
  assert.equal(ten.feedTools.length, 10);
  assert.deepEqual(ten.feedTools.map(t => t.id), [301, 302, 303, 304, 305, 306, 307, 308, 309, 310]);
});

test('the eight-control overlay from an older build still works', () => {
  assert.equal(protocol.status(status(8)).feedTools.length, 8, 'nothing older is broken by the change');
});

test('any Feeder version label is a label, not a pin', () => {
  for (const effect of ['Feeder 0.12.0', 'Feeder 0.15.1', 'Feeder 1.0.0-rc.1']) {
    assert.doesNotThrow(() => protocol.status(status(8, {
      feedTools: Array.from({ length: 8 }, (_, i) => tool(i, { effect }))
    })), effect);
  }
});

test('but the shape is still the contract', () => {
  const bad = (over) => () => protocol.status(status(8, over));
  assert.throws(bad({ feedTools: [] }), /Invalid Feeder status/, 'an empty list is not a panel');
  assert.throws(bad({ feedTools: Array.from({ length: 25 }, (_, i) => tool(i)) }), /Invalid Feeder status/, 'and it is bounded');
  assert.throws(bad({ feedTools: Array.from({ length: 8 }, (_, i) => tool(i, { id: 400 + i })) }), /Invalid Feeder tool/, 'ids run from 301');
  assert.throws(bad({ feedTools: Array.from({ length: 8 }, (_, i) => tool(i, { effect: 'RenoDX 4.7' })) }), /Invalid Feeder tool/, 'and it must be the Feeder speaking');
});

// The on-screen status card: its switch lives in the app's panel, so its state
// has to travel with the status, and its command has to work when no consumer
// is connected at all - the card is the add-on's own, not RenoDX's.
test('the status card travels with the status and is commandable on its own', () => {
  const base = { epoch: 1, effects: true, tools: [] };
  assert.equal(protocol.status(base).badge, undefined, 'an overlay that has none says nothing');
  assert.equal(protocol.status({ ...base, badge: true }).badge, true);
  assert.equal(protocol.status({ ...base, badge: false }).badge, false);
  assert.throws(() => protocol.status({ ...base, badge: 1 }), /Invalid badge state/);

  const status = protocol.status({ ...base, badge: false });
  assert.doesNotThrow(() => protocol.command(status, { epoch: 1, id: 50, kind: 1, value: 1 }),
    'no RenoDX, no Feeder, and the card still answers');
  assert.throws(() => protocol.command(status, { epoch: 1, id: 50, kind: 0, value: 1 }), /./, 'but it is a toggle');
});


// The panel's consumer block is filled by whichever consumer is in the game -
// the v4.7 build or ShortFuse's DLSS Tool. Pinning the label here would have
// rejected the second while insisting the first was the only one possible.
const nrTool = (i, over = {}) => ({
  id: 101 + i, kind: i >= 12 ? 4 : [2, 3, 10, 11].includes(i) ? 1 : 0,
  effect: 'RenoDX v4.7', name: 'Control ' + i, min: 0, max: 1, step: 1, value: 0,
  available: false, ...(i >= 12 ? { options: [] } : {}), ...over
});
const nrStatus = (effect) => ({
  epoch: 1, effects: true, tools: [], nrAvailable: true, nrEnabled: true, nrReason: 'ok',
  nrTools: Array.from({ length: 15 }, (_, i) => nrTool(i, { effect }))
});

test('either consumer may fill the panel block, and nothing else may', () => {
  for (const effect of ['RenoDX v4.7', 'RenoDX v4.7']) {
    const out = protocol.status(nrStatus(effect));
    assert.equal(out.nrTools.length, 15, effect);
    assert.deepEqual(out.nrTools.map((t) => t.id).slice(0, 3), [101, 102, 103]);
  }
  assert.throws(() => protocol.status(nrStatus('OptiScaler')), /Invalid RenoDX tool/,
    'something that is not a RenoDX consumer is still refused');
  assert.throws(() => protocol.status(nrStatus('x'.repeat(40))), /Invalid RenoDX tool/);
});


'use strict';

// The colour a card is lit by comes out of its own poster. Getting it wrong is
// not a crash, it is a room painted the wrong colour, so the rules are tested
// against pictures built by hand.

const test = require('node:test');
const assert = require('node:assert/strict');
const { paletteFromPixels, mergePalettes, toHsl } = require('../src/core/palette');

/** A buffer of one repeated colour, in the order Electron hands back. */
function bgra(colours, times = 1) {
  const list = [];
  for (const [r, g, b, a = 255] of colours) {
    for (let n = 0; n < times; n++) list.push(b, g, r, a);
  }
  return Buffer.from(list);
}

test('a plain colour comes back as itself', () => {
  const red = paletteFromPixels(bgra([[220, 40, 40]], 20));
  assert.ok(red.hue < 10 || red.hue > 350, `hue ${red.hue} is not red`);
  assert.ok(red.sat > 0.6);

  const blue = paletteFromPixels(bgra([[40, 80, 220]], 20));
  assert.ok(blue.hue > 200 && blue.hue < 250, `hue ${blue.hue} is not blue`);
});

// Two reds either side of zero average to cyan if hues are averaged as plain
// numbers. They are summed as vectors for exactly this reason.
test('reds either side of zero stay red', () => {
  const wrapped = paletteFromPixels(bgra([[220, 20, 30], [220, 30, 20]], 12));
  assert.ok(wrapped.hue < 20 || wrapped.hue > 340, `hue ${wrapped.hue} wrapped the wrong way`);
});

test('black bars and white edges do not become the colour of the card', () => {
  const withBars = paletteFromPixels(bgra([
    [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0],
    [255, 255, 255], [255, 255, 255],
    [30, 160, 220]
  ], 4));
  assert.ok(withBars.hue > 180 && withBars.hue < 220, `hue ${withBars.hue} is not the blue in the picture`);
});

test('grey has no colour to give, and says so', () => {
  assert.equal(paletteFromPixels(bgra([[120, 120, 120], [60, 60, 60], [200, 200, 200]], 8)), null);
  assert.equal(paletteFromPixels(Buffer.alloc(0)), null);
  assert.equal(paletteFromPixels(null), null);
});

test('a transparent picture is not read through', () => {
  assert.equal(paletteFromPixels(bgra([[220, 40, 40, 0]], 20)), null);
});

// The dominant colour is the one most of the picture is made of, not the
// brightest speck in it.
test('the largest area wins, not the loudest pixel', () => {
  const mostlyGreen = Buffer.concat([
    bgra([[60, 180, 90]], 40),
    bgra([[255, 0, 255]], 3)
  ]);
  const found = paletteFromPixels(mostlyGreen);
  assert.ok(found.hue > 100 && found.hue < 160, `hue ${found.hue} is not the green it is mostly made of`);
});

test('the byte order is respected', () => {
  const asBgra = paletteFromPixels(bgra([[220, 40, 40]], 12), 'bgra');
  const asRgba = paletteFromPixels(Buffer.from([220, 40, 40, 255].concat(...Array(11).fill([220, 40, 40, 255]))), 'rgba');
  assert.ok(Math.abs(asBgra.hue - asRgba.hue) < 2, 'the same colour read two ways should agree');
});

test('hue, saturation and lightness are the usual ones', () => {
  assert.deepEqual(toHsl(255, 0, 0), { hue: 0, sat: 1, light: 0.5 });
  assert.equal(Math.round(toHsl(0, 255, 0).hue), 120);
  assert.equal(Math.round(toHsl(0, 0, 255).hue), 240);
  assert.equal(toHsl(90, 90, 90).sat, 0);
});

// The banner and the poster are both on screen, so a card is lit by both.
test('two pictures of the same colour agree on it', () => {
  const merged = mergePalettes([{ hue: 20, sat: .6, light: .3 }, { hue: 34, sat: .5, light: .35 }]);
  assert.ok(merged.hue > 20 && merged.hue < 34, `hue ${merged.hue} is not between the two`);
});

test('the more colourful picture pulls harder', () => {
  const merged = mergePalettes([{ hue: 0, sat: .9, light: .3 }, { hue: 60, sat: .15, light: .3 }]);
  assert.ok(merged.hue < 20, `hue ${merged.hue} let a washed-out picture win`);
});

// Averaging opposites gives the colour halfway round the wheel, which is a
// colour neither picture contains. The stronger one wins instead.
test('opposites do not average into a colour that is in neither', () => {
  const merged = mergePalettes([{ hue: 0, sat: .8, light: .3 }, { hue: 180, sat: .4, light: .3 }]);
  assert.equal(merged.hue, 0, 'the stronger picture should have been kept whole');
});

test('a picture with no colour is simply not counted', () => {
  assert.deepEqual(mergePalettes([null, { hue: 210, sat: .5, light: .3 }]), { hue: 210, sat: .5, light: .3 });
  assert.equal(mergePalettes([null, null]), null);
  assert.equal(mergePalettes([]), null);
  assert.equal(mergePalettes(null), null);
});

test('reds either side of zero still stay red when merged', () => {
  const merged = mergePalettes([{ hue: 352, sat: .7, light: .3 }, { hue: 8, sat: .7, light: .3 }]);
  assert.ok(merged.hue > 340 || merged.hue < 20, `hue ${merged.hue} wrapped the wrong way`);
});

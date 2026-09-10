'use strict';
// The colour a picture is mostly made of, so a game's card can be lit by its
// own poster instead of by a hue guessed from the letters in its title.
//
// This half takes raw pixels and nothing else - main.js hands it what Electron
// decoded - which is what lets it be tested against a buffer built by hand.

/** RGB 0..255 to hue 0..360, saturation and lightness 0..1. */
function toHsl(r, g, b) {
  const red = r / 255, green = g / 255, blue = b / 255;
  const high = Math.max(red, green, blue), low = Math.min(red, green, blue);
  const light = (high + low) / 2;
  const span = high - low;
  if (!span) return { hue: 0, sat: 0, light };
  const sat = light > 0.5 ? span / (2 - high - low) : span / (high + low);
  let hue;
  if (high === red) hue = ((green - blue) / span) % 6;
  else if (high === green) hue = (blue - red) / span + 2;
  else hue = (red - green) / span + 4;
  hue *= 60;
  return { hue: hue < 0 ? hue + 360 : hue, sat, light };
}

const BUCKETS = 24;            // fifteen degrees each
const MIN_LIGHT = 0.10;        // letterboxing and shadow say nothing
const MAX_LIGHT = 0.93;        // nor does blown-out white
const MIN_SAT = 0.16;          // grey is not a colour to paint a room with

/**
 * The dominant colour of a decoded image.
 *
 * @param {Buffer|Uint8Array} pixels four bytes per pixel.
 * @param {'bgra'|'rgba'} order Electron hands back BGRA; canvases hand back RGBA.
 * @returns {{hue:number, sat:number, light:number}|null} null when the picture
 *   has no colour worth using - a black-and-white poster, or an empty buffer.
 */
function paletteFromPixels(pixels, order = 'bgra') {
  if (!pixels || pixels.length < 4) return null;
  const blueFirst = order === 'bgra';
  // A hue is an angle, so it is summed as a vector: averaging 350 and 10 the
  // ordinary way gives 180, which is the opposite colour.
  const weight = new Float64Array(BUCKETS);
  const x = new Float64Array(BUCKETS);
  const y = new Float64Array(BUCKETS);
  const sats = new Float64Array(BUCKETS);
  const lights = new Float64Array(BUCKETS);

  for (let index = 0; index + 3 < pixels.length; index += 4) {
    const alpha = pixels[index + 3];
    if (alpha < 200) continue;
    const r = blueFirst ? pixels[index + 2] : pixels[index];
    const g = pixels[index + 1];
    const b = blueFirst ? pixels[index] : pixels[index + 2];
    const { hue, sat, light } = toHsl(r, g, b);
    if (light < MIN_LIGHT || light > MAX_LIGHT || sat < MIN_SAT) continue;
    // A strong colour in the middle of the range counts for more than a pale
    // one or one that is nearly black.
    const strength = sat * (1 - Math.abs(light - 0.5) * 1.2);
    if (strength <= 0) continue;
    const bucket = Math.min(BUCKETS - 1, Math.floor(hue / (360 / BUCKETS)));
    const radians = hue * Math.PI / 180;
    weight[bucket] += strength;
    x[bucket] += Math.cos(radians) * strength;
    y[bucket] += Math.sin(radians) * strength;
    sats[bucket] += sat * strength;
    lights[bucket] += light * strength;
  }

  let best = -1;
  for (let bucket = 0; bucket < BUCKETS; bucket++) {
    if (best < 0 || weight[bucket] > weight[best]) best = bucket;
  }
  if (best < 0 || weight[best] <= 0) return null;

  let hue = Math.atan2(y[best], x[best]) * 180 / Math.PI;
  if (hue < 0) hue += 360;
  return {
    hue: Math.round(hue),
    sat: Math.round(Math.min(1, sats[best] / weight[best]) * 100) / 100,
    light: Math.round(Math.min(1, lights[best] / weight[best]) * 100) / 100
  };
}

/**
 * One colour out of several pictures - the poster and the banner together,
 * rather than one of them standing for both. Hues are summed as vectors again,
 * weighted by how colourful each picture was, so a strongly coloured poster
 * counts for more than a washed-out banner instead of both counting the same.
 *
 * @param {Array<{hue:number,sat:number,light:number}|null>} found
 */
function mergePalettes(found) {
  const real = (found || []).filter(one => one && typeof one.hue === 'number');
  if (!real.length) return null;
  if (real.length === 1) return real[0];
  let x = 0, y = 0, sat = 0, light = 0, total = 0;
  for (const one of real) {
    const weight = Math.max(0.05, one.sat);
    const radians = one.hue * Math.PI / 180;
    x += Math.cos(radians) * weight;
    y += Math.sin(radians) * weight;
    sat += one.sat * weight;
    light += one.light * weight;
    total += weight;
  }
  // Two pictures on opposite sides of the wheel cancel out, and the average of
  // opposites is meaningless. When that happens the more colourful one wins
  // rather than the pair agreeing on grey.
  const length = Math.hypot(x, y) / total;
  if (length < 0.35) return real.slice().sort((a, b) => b.sat - a.sat)[0];
  let hue = Math.atan2(y, x) * 180 / Math.PI;
  if (hue < 0) hue += 360;
  return {
    hue: Math.round(hue),
    sat: Math.round((sat / total) * 100) / 100,
    light: Math.round((light / total) * 100) / 100
  };
}

module.exports = { paletteFromPixels, mergePalettes, toHsl };

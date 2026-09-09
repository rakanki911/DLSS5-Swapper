'use strict';

// The pre-upscale neural consumer.
//
// It drives the same NGX feature 18 the RenoDX add-on drives, but evaluates it
// on the frame the game actually rendered rather than on the frame DLSS
// produced. The model does not upscale, so its cost follows the pixel count it
// is handed: at 2972x1256 into 4K that is 44% of the pixels, and measured on an
// RTX 4090 it is 5.4-7.1 ms against 16.3-16.4 ms for the same model after the
// upscale.
//
// The saving exists only while DLSS is upscaling. In DLAA, or with the game's
// resolution scale at 100%, there is no smaller image to run ahead of and this
// is simply the same work in a different place. Say so rather than let someone
// conclude the whole idea does nothing.
//
// The file name is not a preference. The DLSS-NR snippet tests the calling
// module's own path for the substring "nvngx.dll" and refuses anything else
// with 0xBAD00002 (PlatformError), so the add-on has to land as
// nvngx.dll.addon64 whatever else it is called upstream.
const fs = require('fs');
const path = require('path');
const pe = require('./pe');
const { cached, fetchVerified } = require('./runtime-components');

const ADDON_NAME = 'nvngx.dll.addon64';

// MIT, and not bundled: a pinned release downloaded on first use and checked
// before a byte of it reaches a game folder, the same way OptiScaler arrives.
const RELEASE = Object.freeze({
  version: '0.1.0-ada-fixes',
  url: 'https://github.com/Dewkin/neural-upstream/releases/download/v0.1.0-ada-fixes/nvngx.dll.addon64',
  sha256: '93aacd98b8ed96459996658480a0907d44d48c5482cd21f5de005831a75462ec',
  licenseUrl: 'https://raw.githubusercontent.com/Dewkin/neural-upstream/34fb482dff367bb156b57027357d472978137a62/LICENSE',
  licenseHash: '52fd804eea3cca1404771eed9450fe9ee86af0791da12ca512869b332e1ac4af',
  upstream: 'https://github.com/matiasLombo/neural-upstream'
});

// Every add-on that creates NGX feature 18 for itself. Two of them in one
// folder is not a heavier install, it is a broken one: whichever loads second
// asks for a feature the first already owns, and the game either loses neural
// rendering or dies. Choosing between them is what the routes are for; this
// list is for the copies no route put there.
const CONSUMERS = Object.freeze({
  'renodx-dlss5.addon64': 'post',   // the ordinary consumer, native route
  'renodx-dlss.addon64': 'post',    // ShortFuse's DLSS Tool, renodx route
  [ADDON_NAME]: 'pre'
});

function isConsumer(name) {
  return Object.prototype.hasOwnProperty.call(CONSUMERS, String(name).toLowerCase());
}

// Consumers sitting beside the executable that are not the one being installed.
// Returned as file names so the caller can track and remove them through its
// own manifest and give them back on Restore originals.
function rivalConsumers(exeDir, keepName) {
  const keep = String(keepName || '').toLowerCase();
  let entries;
  try { entries = fs.readdirSync(exeDir); } catch { return []; }
  return entries.filter((name) => isConsumer(name) && name.toLowerCase() !== keep);
}

function fail(code, message = code) { return Object.assign(new Error(message), { code }); }

async function ensureAddon(cacheRoot) {
  const base = path.join(path.resolve(cacheRoot), 'components', `neural-upstream-${RELEASE.version}`);
  const addon = path.join(base, ADDON_NAME);
  if (!cached(addon, RELEASE.sha256)) await fetchVerified(RELEASE.url, RELEASE.sha256, addon);
  const license = path.join(base, 'neural-upstream-LICENSE.txt');
  if (!cached(license, RELEASE.licenseHash)) await fetchVerified(RELEASE.licenseUrl, RELEASE.licenseHash, license);
  // A 32-bit game cannot load it, and neither can a truncated download that
  // happened to hash correctly against a stale pin.
  if (pe.getBitness(addon) !== 64) throw fail('errNeuralUpstreamPayload');
  return addon;
}

module.exports = { ADDON_NAME, RELEASE, CONSUMERS, isConsumer, rivalConsumers, ensureAddon };

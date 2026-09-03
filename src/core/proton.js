'use strict';
// Runs Windows-only helper programs (currently ReShade Setup) in the exact
// bottle a game already uses - a Steam Play prefix, or the wine prefix Heroic
// or Lutris made for it. Copying DLLs itself is ordinary Linux IO; only the
// setup executable needs any of this.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function protonCandidates(steamRoot, prefix) {
  const common = path.join(steamRoot, 'steamapps', 'common');
  let names = [];
  try { names = fs.readdirSync(common); } catch { return []; }
  let configured = '';
  try { configured = fs.readFileSync(path.join(path.dirname(prefix), 'config_info'), 'utf8').trim(); } catch {}
  return names
    .filter((name) => /^Proton(?:\s|\d|[-_])/i.test(name))
    .sort((a, b) => Number(b.includes(configured)) - Number(a.includes(configured)))
    .map((name) => path.join(common, name, 'proton'))
    .filter((file) => fs.existsSync(file));
}

// A context is everything it takes to run a Windows program against a game's
// existing bottle: the command, the arguments that come before the program,
// and the environment that points the whole thing at the prefix.
function contextForSteamGame(game) {
  if (process.platform !== 'linux' || !game || !game.steamRoot || !game.protonPrefix) return null;
  if (!fs.existsSync(game.protonPrefix)) return null;
  const proton = protonCandidates(game.steamRoot, game.protonPrefix)[0];
  if (!proton) return null;
  return {
    command: proton,
    lead: ['run'],
    env: {
      WINEPREFIX: game.protonPrefix,
      STEAM_COMPAT_DATA_PATH: path.dirname(game.protonPrefix),
      STEAM_COMPAT_CLIENT_INSTALL_PATH: game.steamRoot,
      STEAM_COMPAT_APP_ID: game.id
    }
  };
}

// Heroic and Lutris run a game against a prefix of their own rather than a
// Steam Play one. Plain wine only needs to be pointed at it. Heroic can also
// be configured to use Proton, and points the compatibility path at the
// prefix folder it configured, with wine's own prefix one level inside.
//
// That inner `pfx` is not a second folder: Heroic drops a `pfx -> .` symlink
// inside the prefix so a compatdata-shaped path resolves back onto it. Joining
// `pfx` is therefore right for both shapes, and is not the redundant-looking
// mistake it reads as. Checked against a real Heroic Proton prefix.
function contextForWineGame(game) {
  if (process.platform !== 'linux' || !game || !game.wine) return null;
  const { bin, prefix, kind, steamPath } = game.wine;
  if (!bin || !prefix || !fs.existsSync(prefix)) return null;
  if (kind !== 'proton') return { command: bin, lead: [], env: { WINEPREFIX: prefix } };
  return {
    command: bin,
    lead: ['run'],
    env: {
      WINEPREFIX: path.join(prefix, 'pfx'),
      STEAM_COMPAT_DATA_PATH: prefix,
      STEAM_COMPAT_CLIENT_INSTALL_PATH: steamPath || prefix,
      STEAM_COMPAT_APP_ID: game.id || '0'
    }
  };
}

const contextForGame = (game) => contextForSteamGame(game) || contextForWineGame(game);

// The add-on compiles a shader at runtime through d3dcompiler_47, and Wine's
// own build is backed by vkd3d's incomplete HLSL compiler: it has no isnan, so
// the compile fails and Neural Rendering silently never runs. The add-on still
// loads and the runtime still reports itself initialised, which makes this
// close to undiagnosable from inside the game - hence the warning.
//
// Microsoft's build implements it and is an order of magnitude larger, which is
// what tells them apart: 370 KB against 4.1 MB on the two prefixes measured.
const BUILTIN_COMPILER_MAX = 1024 * 1024;

function nativeShaderCompiler(prefix) {
  if (!prefix) return false;
  let size = 0;
  try { size = fs.statSync(path.join(prefix, 'drive_c', 'windows', 'system32', 'd3dcompiler_47.dll')).size; }
  catch { return false; }
  if (size <= BUILTIN_COMPILER_MAX) return false;
  // A native DLL sitting in the prefix is only reached if the prefix prefers it.
  try { return /"\*?d3dcompiler_47"\s*=\s*"native/i.test(fs.readFileSync(path.join(prefix, 'user.reg'), 'utf8')); }
  catch { return false; }
}

function createSetupRunner(context) {
  return (setupExe, args, log) => new Promise((resolve) => {
    log('runningSetup', { setup: path.basename(setupExe), args: args.slice(1).join(' ') });
    const child = spawn(context.command, [...context.lead, setupExe, ...args], {
      cwd: path.dirname(args[0]),
      env: { ...process.env, ...context.env }
    });
    // Proton's `run` verb sends the program's own output to its log file, so
    // what arrives here is Proton's diagnostics and not the setup's: a failed
    // ReShade Setup reports an empty reason. `runinprefix` does preserve it -
    // measured against a real prefix, 7 lines of reg.exe output against none -
    // but it also skips the prefix file update and the game/Steam drive
    // mappings that `run` sets up first, which the setup may well need. Not
    // worth trading a working install for a better error message without a
    // real ReShade Setup to test it against.
    let output = '';
    child.stdout.on('data', (data) => { output += data.toString(); });
    child.stderr.on('data', (data) => { output += data.toString(); });
    // The kill timer has to be cleared: left running it keeps the event loop
    // alive for two minutes after a setup that already finished.
    const timer = setTimeout(() => { try { child.kill(); } catch {} }, 120000);
    const settle = (result) => { clearTimeout(timer); resolve(result); };
    child.on('error', (error) => settle({ code: -1, output: error.message }));
    child.on('close', (code) => settle({ code, output: output.trim() }));
  });
}

module.exports = { protonCandidates, contextForSteamGame, contextForWineGame, contextForGame, createSetupRunner, nativeShaderCompiler };

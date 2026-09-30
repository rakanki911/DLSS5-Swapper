'use strict';
// Runs Windows-only helper programs (currently ReShade Setup) in the exact
// Steam Play prefix used by a game.  Copying DLLs itself is ordinary Linux IO;
// only the setup executable needs Proton.
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

function contextForSteamGame(game) {
  if (process.platform !== 'linux' || !game || !game.steamRoot || !game.protonPrefix) return null;
  if (!fs.existsSync(game.protonPrefix)) return null;
  const proton = protonCandidates(game.steamRoot, game.protonPrefix)[0];
  return proton ? { proton, prefix: game.protonPrefix, steamRoot: game.steamRoot, appid: game.id } : null;
}

function createSetupRunner(context) {
  return (setupExe, args, log) => new Promise((resolve) => {
    log('runningSetup', { setup: path.basename(setupExe), args: args.slice(1).join(' ') });
    const child = spawn(context.command || context.proton, context.command ? [setupExe, ...args] : ['run', setupExe, ...args], {
      cwd: path.dirname(args[0]),
      env: {
        ...process.env,
        ...(context.env || {}),
        WINEPREFIX: context.prefix,
        ...(context.command ? {} : {
        STEAM_COMPAT_DATA_PATH: path.dirname(context.prefix),
        STEAM_COMPAT_CLIENT_INSTALL_PATH: context.steamRoot,
        STEAM_COMPAT_APP_ID: context.appid
        })
      }
    });
    let output = '';
    child.stdout.on('data', (data) => { output += data.toString(); });
    child.stderr.on('data', (data) => { output += data.toString(); });
    const timer = setTimeout(() => { try { child.kill(); } catch {} }, 120000);
    child.on('error', (error) => { clearTimeout(timer); resolve({ code: -1, output: error.message }); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, output: output.trim() }); });
  });
}

module.exports = { protonCandidates, contextForSteamGame, createSetupRunner };

'use strict';
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
function run(file, args) {
  return new Promise((resolve, reject) => execFile(file, args, { windowsHide: true, timeout: 20000, maxBuffer: 4 * 1024 * 1024 },
    (error, stdout) => error ? reject(error) : resolve(stdout)));
}
// A path is the game's when it is the folder itself or something under it.
// Comparison stays case-insensitive on both platforms: the executable name
// wine reports does not always match the case on disk.
function contains(gameDir, file) {
  const root = path.resolve(gameDir).toLowerCase();
  const full = path.resolve(file).toLowerCase();
  return full === root || full.startsWith(root + path.sep);
}
function matchingProcesses(processes, gameDir, exePath) {
  return processes.filter(p => {
    if (p.ProcessId === process.pid) return false;
    if (p.ExecutablePath) return contains(gameDir, p.ExecutablePath);
    // Protected processes may omit their path. Fail conservatively for a
    // matching executable/helper name, but not unrelated system processes.
    return [exePath ? path.basename(exePath).toLowerCase() : null, 'dlss5-feed-host64.exe'].includes(String(p.Name).toLowerCase());
  });
}

// ---------- process snapshots ----------
// Both platforms return the same rows: { ProcessId, Name, ExecutablePath }.

function windowsSnapshot() {
  const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
  return run(powershell, ['-NoProfile', '-NonInteractive', '-Command',
    "$ErrorActionPreference='Stop'; @(Get-CimInstance Win32_Process | Select-Object ProcessId,Name,ExecutablePath) | ConvertTo-Json -Compress"]);
}

const PROC = '/proc';
// comm is truncated to 15 characters, so a long name arrives without its
// extension; the Proton runtime path is the other half of the signal.
const WINE = /wine|proton|\.exe$/i;
const link = (file) => { try { return fs.readlinkSync(file); } catch { return null; } };
const text = (file) => { try { return fs.readFileSync(file, 'utf8'); } catch { return ''; } };

// Wine hands a program Windows-style argv. Z: is the drive it maps to /, and
// it is the only letter that resolves back to a real file without reading the
// prefix's dosdevices - the folder evidence below covers a C: path.
function unixPath(token) {
  if (/^[a-z]:[\\/]/i.test(token)) return /^z:[\\/]/i.test(token) ? path.resolve('/', token.slice(3).replace(/\\/g, '/')) : null;
  return token.startsWith('/') ? token : null;
}

// The .exe and its DLLs stay mapped for as long as the game runs, which is the
// one tie to the folder that survives a game that chdir'd away from it.
function mappedGameFile(dir, gameDir) {
  const seen = new Set();
  for (const line of text(path.join(dir, 'maps')).split('\n')) {
    // Anonymous regions ([heap], [stack]) carry no path; the address, mode,
    // offset and device fields never contain a slash.
    const start = line.indexOf('/');
    if (start < 0) continue;
    const file = line.slice(start).replace(/ \(deleted\)$/, '');
    if (seen.has(file)) continue;
    seen.add(file);
    if (contains(gameDir, file)) return file;
  }
  return null;
}

// A Proton game is a wine process: /proc/<pid>/exe points into the Proton
// runtime and never at the game, so its own path can only rule it out
// wrongly. Steam launches with the game folder as the working directory,
// which identifies the usual case without reading any maps.
function gameFile(dir, gameDir, args, exe, comm) {
  const cwd = link(path.join(dir, 'cwd'));
  if (cwd && contains(gameDir, cwd)) return cwd;
  if (exe && contains(gameDir, exe)) return exe;
  for (const arg of args) {
    const file = unixPath(arg);
    if (file && contains(gameDir, file)) return file;
  }
  const wine = WINE.test(comm) || (exe && WINE.test(exe)) || args.some((a) => /\.exe$/i.test(a));
  if (!wine) return exe;
  return mappedGameFile(dir, gameDir) || null;
}

function linuxSnapshot(gameDir) {
  // An unreadable /proc is a failed check, not an idle machine: let it throw.
  const rows = [];
  for (const pid of fs.readdirSync(PROC)) {
    if (!/^\d+$/.test(pid)) continue;
    const dir = path.join(PROC, pid);
    const args = text(path.join(dir, 'cmdline')).split('\0').filter(Boolean);
    const exe = link(path.join(dir, 'exe'));
    const comm = text(path.join(dir, 'comm')).trim();
    // The process exited while we were walking the list.
    if (!args.length && !exe && !comm) continue;
    const windowsArg = args.find((a) => /\.exe$/i.test(a));
    rows.push({
      ProcessId: Number(pid),
      Name: windowsArg ? windowsArg.split(/[\\/]/).pop() : (exe ? path.basename(exe) : comm),
      ExecutablePath: gameFile(dir, gameDir, args, exe, comm)
    });
  }
  return rows;
}

const snapshot = (gameDir) => process.platform === 'win32' ? windowsSnapshot() : linuxSnapshot(gameDir);

async function assertGameClosed(gameDir, exePath, processes = snapshot) {
  let data;
  try {
    const output = await processes(gameDir);
    data = typeof output === 'string' ? JSON.parse(output || '[]') : (output || []);
  } catch (cause) { throw Object.assign(new Error('errProcessCheck'), { code: 'errProcessCheck', cause }); }
  const matches = matchingProcesses(Array.isArray(data) ? data : [data], gameDir, exePath);
  if (matches.length) throw Object.assign(new Error(`Close the game and helper first: ${matches.map(p => p.Name).join(', ')}`), { code: 'errGameRunning' });
}
function gpuSupported(rows) {
  return rows.some(row => /\bRTX\s*50\d{2}\b/i.test(row.name) &&
    Number(String(row.driver).split('.')[0]) * 100 + Number(String(row.driver).split('.')[1]) >= 61656);
}
async function gpuInfo(runner = run) {
  try {
    const output = await runner(process.platform === 'win32' ? 'nvidia-smi.exe' : 'nvidia-smi', ['--query-gpu=name,driver_version', '--format=csv,noheader']);
    return output.trim().split(/\r?\n/).filter(Boolean).map(line => {
      const [name, driver] = line.split(',').map(s => s.trim());
      return { name, driver };
    });
  } catch { return null; }
}
function antiCheatPresent(gameDir) {
  const queue = [[gameDir, 0]];
  let examined = 0;
  while (queue.length && examined < 2000) {
    const [dir, depth] = queue.shift();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (examined >= 2000) break;
      examined++;
      if (/easyanticheat|battleye|(?:^|[-_])(?:eac|be)launcher|eaanticheat/i.test(entry.name)) return true;
      if (entry.isDirectory() && depth < 2 && !/^_DLSS5_Backup$|^node_modules$/i.test(entry.name)) queue.push([path.join(dir, entry.name), depth + 1]);
    }
  }
  return false;
}
module.exports = { assertGameClosed, matchingProcesses, gpuInfo, gpuSupported, antiCheatPresent, linuxSnapshot };

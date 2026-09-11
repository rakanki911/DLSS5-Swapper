'use strict';
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
function run(file, args) {
  return new Promise((resolve, reject) => execFile(file, args, { windowsHide: true, timeout: 20000, maxBuffer: 4 * 1024 * 1024 },
    (error, stdout) => error ? reject(error) : resolve(stdout)));
}
function matchingProcesses(processes, gameDir, exePath) {
  const root = path.resolve(gameDir).toLowerCase() + path.sep;
  return processes.filter(p => {
    if (p.ProcessId === process.pid) return false;
    if (p.ExecutablePath) return path.resolve(p.ExecutablePath).toLowerCase().startsWith(root);
    // Protected processes may omit their path. Fail conservatively for a
    // matching executable/helper name, but not unrelated system processes.
    return [exePath ? path.basename(exePath).toLowerCase() : null, 'dlss5-feed-host64.exe'].includes(String(p.Name).toLowerCase());
  });
}
// Windows keeps a running executable open for writing, so a file that can be
// opened for writing is not the image of a running process. That is the
// question this check exists to answer, and it needs neither PowerShell nor
// WMI - which is what makes it the right fallback when those are slow,
// restricted or missing.
function executableLocked(exePath) {
  let handle;
  try {
    handle = fs.openSync(exePath, 'r+');
    return false;
  } catch (error) {
    // Locked by a running process. Anything else - no such file, no rights to
    // it, a read-only volume - says nothing about the game and must not block
    // an install.
    return error && (error.code === 'EBUSY' || error.code === 'EPERM' || error.code === 'EACCES');
  } finally {
    if (handle !== undefined) { try { fs.closeSync(handle); } catch { /* already gone */ } }
  }
}

async function assertGameClosed(gameDir, exePath, runner = run, locked = executableLocked) {
  const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
  let data;
  try {
    const output = await runner(powershell, ['-NoProfile', '-NonInteractive', '-Command',
      "$ErrorActionPreference='Stop'; @(Get-CimInstance Win32_Process | Select-Object ProcessId,Name,ExecutablePath) | ConvertTo-Json -Compress"]);
    data = JSON.parse(output || '[]');
  } catch {
    // The process list is unavailable: PowerShell restricted by policy, a cold
    // WMI call past its timeout, or a machine where it simply fails. This used
    // to refuse the install outright, which is a diagnostic becoming a wall -
    // people with a closed game could not install at all. Fall back to asking
    // the executable itself.
    if (exePath && locked(exePath)) {
      throw Object.assign(new Error('Close the game first: its executable is in use.'), { code: 'errGameRunning' });
    }
    return;
  }
  const matches = matchingProcesses(Array.isArray(data) ? data : [data], gameDir, exePath);
  if (matches.length) throw Object.assign(new Error(`Close the game and helper first: ${matches.map(p => p.Name).join(', ')}`), { code: 'errGameRunning' });
}
// Two separate questions, because only one of them is a hard requirement.
// The card is: DLSS-NR runs on the RTX 50 path. The driver is not: the model
// file (nvngx_dlssnr.dll) ships with this app rather than being taken from the
// installed driver, so an older driver still runs an OptiScaler install - which
// is what people who rolled back off 616.x to keep RenoDX working are seeing.
const OPTI_DRIVER = 61656;
// The model needs a Blackwell card. That is the GeForce RTX 50 series and
// also the professional RTX PRO Blackwell boards, which nvidia-smi reports
// as "NVIDIA RTX PRO 6000 Blackwell ..." - a newer card than this gate was
// written for, and it was refused for not being called 50-something.
const blackwell = row => /\bRTX\s*50\d{2}\b/i.test(row.name) ||
  (/\bRTX\s*PRO\b/i.test(row.name) && /\bblackwell\b/i.test(row.name));
const driverNumber = row => {
  const [major, minor] = String(row.driver).split('.');
  return Number(major) * 100 + Number(minor);
};
// These are the driver builds reproduced in DLSS5-Feeder issue #54 with the
// RenoDX v4.6/v4.7 consumer. Do not extend the warning to untested releases.
const NEURAL_FAULT_DRIVERS = new Set([61664, 61686]);
function driverNeuralFault(rows) {
  return (rows || []).some(row => /nvidia|rtx|gtx/i.test(row.name) && NEURAL_FAULT_DRIVERS.has(driverNumber(row)));
}
function driverNames(rows) { return (rows || []).map(row => `${row.name} - ${row.driver}`).join(', '); }
function gpuModelSupported(rows) { return rows.some(blackwell); }
function driverSupported(rows) { return rows.some(row => blackwell(row) && driverNumber(row) >= OPTI_DRIVER); }
function gpuSupported(rows) { return gpuModelSupported(rows) && driverSupported(rows); }
async function gpuInfo(runner = run) {
  try {
    const output = await runner('nvidia-smi.exe', ['--query-gpu=name,driver_version', '--format=csv,noheader']);
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
module.exports = { assertGameClosed, executableLocked, matchingProcesses, gpuInfo, gpuSupported, gpuModelSupported, driverSupported, driverNeuralFault, driverNames, antiCheatPresent };

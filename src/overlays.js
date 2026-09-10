'use strict';
// App-owned add-ons only. Never load imported native code in Electron, replace
// ReShade, change its global configuration, or edit the main app's payload.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
const MAX_ADDON_BYTES = 64 * 1024 * 1024;

function readAt(fd, length, position) {
  const data = Buffer.alloc(length);
  let read = 0;
  while (read < length) {
    const count = fs.readSync(fd, data, read, length - read, position + read);
    if (!count) throw Error('Invalid Windows PE binary.');
    read += count;
  }
  return data;
}

function readNative(file, addon = true) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw Error('Expected a regular Windows binary.');
  const fd = fs.openSync(file, 'r');
  try {
    const opened = fs.fstatSync(fd);
    if (!opened.isFile() || opened.size < 128) throw Error('Invalid Windows PE binary.');
    if (addon && opened.size > MAX_ADDON_BYTES) throw Error('ReShade add-ons must not exceed 64 MB.');
    // Game executables only need architecture/type checks. Read the DOS and
    // COFF headers (88 bytes total), never the whole EXE or its hash. Large
    // Unreal Shipping executables must not inherit the add-on import limit.
    const dos = readAt(fd, 64, 0);
    const offset = dos.readUInt32LE(0x3c);
    if (dos.readUInt16LE(0) !== 0x5a4d || offset < 64 || offset + 24 > opened.size) throw Error('Invalid Windows PE binary.');
    const coff = readAt(fd, 24, offset);
    if (coff.readUInt32LE(0) !== 0x4550) throw Error('Invalid Windows PE binary.');
    const machine = coff.readUInt16LE(4);
    const architecture = machine === 0x8664 ? 64 : machine === 0x14c ? 32 : 0;
    if (!architecture) throw Error('Only x64 and x86 Windows binaries are supported.');
    const dll = !!(coff.readUInt16LE(22) & 0x2000);
    if (addon && (!dll || path.extname(file).toLowerCase() !== `.addon${architecture}`)) throw Error('Choose a .addon64 or .addon32 DLL with matching architecture.');
    if (!addon && (dll || path.extname(file).toLowerCase() !== '.exe')) throw Error('Choose the game executable, not a DLL.');
    if (!addon) return { architecture };
    // Only imported add-ons need their complete bytes and integrity hash.
    const data = readAt(fd, opened.size, 0);
    return { data, architecture, sha256: digest(data) };
  } finally {
    fs.closeSync(fd);
  }
}

function createOverlayLibrary(root, builtinFile, forbiddenRoots = []) {
  const base = path.resolve(root);
  const entries = path.join(base, 'entries');
  const records = path.join(base, 'installs');
  const inside = (parent, child) => { const rel = path.relative(parent, child); return !rel || (!rel.startsWith('..') && !path.isAbsolute(rel)); };
  function directory(dir) {
    fs.mkdirSync(dir, { recursive: true });
    if (fs.lstatSync(dir).isSymbolicLink() || path.resolve(fs.realpathSync(dir)).toLowerCase() !== path.resolve(dir).toLowerCase()) throw Error('Linked library directories are not allowed.');
  }
  function idCheck(id) { if (typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)) throw Error('Invalid overlay ID.'); }
  function readJson(file) {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16384) throw Error('Invalid overlay record.');
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  function custom(id) {
    idCheck(id);
    const entry = readJson(path.join(entries, `${id}.json`));
    if (entry.id !== id || ![32, 64].includes(entry.architecture)) throw Error('Invalid overlay record.');
    const file = path.join(entries, `${id}.addon${entry.architecture}`);
    const binary = readNative(file);
    if (binary.sha256 !== id) throw Error('Overlay changed since import. Import it again.');
    return { ...entry, file };
  }
  function builtin() {
    const ready = fs.existsSync(builtinFile);
    return { id: 'builtin', name: 'DLSS 5 Swapper Controls', builtin: true, architecture: 64, ready,
      sha256: ready ? readNative(builtinFile).sha256 : null,
      file: builtinFile, description: 'F8: compact panel. Keep DLSS 5 Swapper open. RenoDX v4.7 + Feeder 0.12.0 x64 controls connect automatically. Feeder + Overlay can be installed together from Games. Original tool windows stay available.' };
  }
  function resolve(id) { return id === 'builtin' ? builtin() : custom(id); }
  function installation(recordId) {
    idCheck(recordId);
    const record = readJson(path.join(records, `${recordId}.json`));
    idCheck(record.sha256);
    if (!path.isAbsolute(record.directory) || ![32, 64].includes(record.architecture) || recordId !== digest(record.directory.toLowerCase() + record.sha256)) throw Error('Invalid installation record.');
    const filename = `dlss5-lab-overlay-${record.sha256.slice(0, 16)}.addon${record.architecture}`;
    return { ...record, id: recordId, file: path.join(record.directory, filename) };
  }
  function list() {
    directory(base); directory(entries); directory(records);
    const overlays = [builtin()];
    const errors = [];
    for (const file of fs.readdirSync(entries).filter(n => /^[a-f0-9]{64}\.json$/.test(n))) {
      try { overlays.push(custom(file.slice(0, -5))); } catch (e) { errors.push(e.message); }
    }
    const installations = [];
    for (const file of fs.readdirSync(records).filter(n => /^[a-f0-9]{64}\.json$/.test(n))) {
      try { installations.push(installation(file.slice(0, -5))); } catch (e) { errors.push(e.message); }
    }
    return { overlays: overlays.map(({ file, ...entry }) => entry), installations, errors };
  }
  function add(file) {
    const binary = readNative(file);
    directory(base); directory(entries);
    const id = binary.sha256;
    const target = path.join(entries, `${id}.addon${binary.architecture}`);
    const entry = { id, name: path.basename(file), description: 'Custom native ReShade add-on. Only install code from a developer you trust.', architecture: binary.architecture, sha256: id, ready: true };
    if (!fs.existsSync(target)) fs.writeFileSync(target, binary.data, { flag: 'wx' });
    if (readNative(target).sha256 !== id) throw Error('Stored overlay checksum mismatch.');
    const metadata = path.join(entries, `${id}.json`);
    if (!fs.existsSync(metadata)) fs.writeFileSync(metadata, JSON.stringify(entry), { flag: 'wx' });
    return entry;
  }
  function remove(id) {
    const entry = custom(id);
    if (list().installations.some(i => i.overlayId === id)) throw Error('Remove this overlay from its test game first.');
    fs.unlinkSync(entry.file);
    fs.unlinkSync(path.join(entries, `${id}.json`));
  }
  function install(id, exe, knownArchitecture = null) {
    const entry = resolve(id);
    if (!entry.ready) throw Error('Build the overlay add-on first.');
    const binary = readNative(entry.file);
    const targetStat = fs.lstatSync(exe);
    if (!targetStat.isFile() || targetStat.isSymbolicLink()) throw Error('Expected a regular Windows executable.');
    const targetArchitecture = knownArchitecture === null
      ? readNative(exe, false).architecture
      : knownArchitecture;
    if (![32, 64].includes(targetArchitecture)) throw Error('Invalid executable architecture.');
    if (binary.architecture !== targetArchitecture) throw Error('Overlay and executable architectures do not match.');
    const targetDir = fs.realpathSync(path.dirname(exe));
    for (const forbidden of forbiddenRoots) if (inside(path.resolve(forbidden), targetDir)) throw Error('The main app and toolchain directories cannot be overlay targets.');
    if (list().installations.some(record => record.overlayId === id && record.directory.toLowerCase() === targetDir.toLowerCase() && record.sha256 !== binary.sha256)) throw Error('Remove the previous test overlay before installing a new build.');
    const recordId = digest(targetDir.toLowerCase() + binary.sha256);
    directory(base); directory(records);
    const recordFile = path.join(records, `${recordId}.json`);
    const destination = path.join(targetDir, `dlss5-lab-overlay-${binary.sha256.slice(0, 16)}.addon${binary.architecture}`);
    if (fs.existsSync(recordFile)) {
      const record = installation(recordId);
      if (readNative(record.file).sha256 !== binary.sha256) throw Error('Installed overlay was modified. Nothing was overwritten.');
      return record;
    }
    const record = { overlayId: id, name: entry.name, directory: targetDir, architecture: binary.architecture, sha256: binary.sha256 };
    // Exclusive creation: never overwrite any game file, including another managed copy.
    fs.writeFileSync(destination, binary.data, { flag: 'wx' });
    try { fs.writeFileSync(recordFile, JSON.stringify(record), { flag: 'wx' }); }
    catch (error) { if (readNative(destination).sha256 === binary.sha256) fs.unlinkSync(destination); throw error; }
    return installation(recordId);
  }
  function uninstall(recordId) {
    const record = installation(recordId);
    if (fs.realpathSync(record.directory) !== record.directory) throw Error('Installation directory changed. Nothing was removed.');
    if (fs.existsSync(record.file)) {
      if (readNative(record.file).sha256 !== record.sha256) throw Error('Overlay was modified. Nothing was removed.');
      fs.unlinkSync(record.file);
    }
    fs.unlinkSync(path.join(records, `${recordId}.json`));
  }
  return { list, add, remove, resolve, install, uninstall };
}
module.exports = { readNative, createOverlayLibrary };

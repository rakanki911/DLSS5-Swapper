'use strict';
// Gathers everything the published build ships with into payload/, which
// electron-builder then copies next to the executable as resources/payload.
// Run it before a build: npm run payload
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const PAYLOAD = path.join(ROOT, 'payload');

// Where the DLSS 5 files and the ReShade installer normally live on this
// machine. Override either with an argument: npm run payload -- <dlss5Dir>
const DEFAULT_SOURCES = [
  process.argv[2],
  path.resolve(ROOT, '..'),
  path.join(os.homedir(), 'OneDrive', 'Desktop', 'dlss 5 swapper'),
  path.join(os.homedir(), 'Desktop', 'dlss 5 swapper')
].filter(Boolean);

const RESHADE_DIRS = [
  path.join(os.homedir(), 'Downloads'),
  path.join(os.homedir(), 'OneDrive', 'Downloads'),
  path.join(os.homedir(), 'Desktop')
];

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  const mb = (fs.statSync(dest).size / 1048576).toFixed(1);
  console.log(`  + ${path.relative(ROOT, dest)}  (${mb} MB)`);
}

function findSource() {
  for (const dir of DEFAULT_SOURCES) {
    const streamline = fs.existsSync(path.join(dir, 'streamline'))
      ? path.join(dir, 'streamline')
      : dir;
    try {
      const files = fs.readdirSync(streamline);
      if (files.some((f) => /^nvngx_dlssnr\.dll$/i.test(f))) return { dir, streamline };
    } catch {}
  }
  return null;
}

function findAddon(dir) {
  for (const candidate of [dir, path.join(dir, 'streamline')]) {
    try {
      const found = fs.readdirSync(candidate).find((f) => /\.addon64$/i.test(f));
      if (found) return path.join(candidate, found);
    } catch {}
  }
  return null;
}

// Only an "Addon" build can load the DLSS 5 add-on; pick the newest one.
function findReShadeSetup() {
  const found = [];
  for (const dir of RESHADE_DIRS) {
    let entries = [];
    try { entries = fs.readdirSync(dir); } catch { continue; }
    for (const name of entries) {
      if (!/^ReShade_Setup_.*_Addon\.exe$/i.test(name)) continue;
      const version = (name.match(/(\d+)\.(\d+)\.(\d+)/) || []).slice(1).map(Number);
      found.push({ file: path.join(dir, name), version, name });
    }
  }
  found.sort((a, b) => {
    for (let i = 0; i < 3; i++) {
      const diff = (b.version[i] || 0) - (a.version[i] || 0);
      if (diff) return diff;
    }
    return 0;
  });
  return found[0] || null;
}

const source = findSource();
if (!source) {
  console.error('لم يتم العثور على ملفات DLSS 5 / DLSS 5 files not found.');
  console.error('Pass the folder explicitly:  npm run payload -- "C:\\path\\to\\dlss 5 swapper"');
  process.exit(1);
}

fs.rmSync(PAYLOAD, { recursive: true, force: true });
console.log(`Source: ${source.streamline}`);

for (const name of fs.readdirSync(source.streamline)) {
  if (!/\.(dll|txt)$/i.test(name)) continue;
  copyFile(path.join(source.streamline, name), path.join(PAYLOAD, 'streamline', name));
}

const addon = findAddon(source.dir);
if (!addon) {
  console.error('لم يتم العثور على ملف .addon64 / add-on not found.');
  process.exit(1);
}
copyFile(addon, path.join(PAYLOAD, path.basename(addon)));

const reshade = findReShadeSetup();
if (reshade) {
  copyFile(reshade.file, path.join(PAYLOAD, reshade.name));
} else {
  console.warn('\n! ReShade_Setup_*_Addon.exe not found — the build will ask the user for it.');
}

const total = fs
  .readdirSync(PAYLOAD, { recursive: true })
  .map((f) => path.join(PAYLOAD, f))
  .filter((f) => fs.statSync(f).isFile())
  .reduce((sum, f) => sum + fs.statSync(f).size, 0);
console.log(`\nPayload ready: ${(total / 1048576).toFixed(1)} MB in ${path.relative(ROOT, PAYLOAD)}`);

'use strict';
// Builds the Windows icon from the source artwork.
//
// Two things the artwork needs before it can pass for a real app icon:
//   1. It is 1278x1230 — not square — and Windows would stretch it.
//   2. It only fills ~82% of its canvas; the rest is transparent margin, which
//      is why it looked noticeably smaller in the taskbar than Chrome or
//      qBittorrent. The transparent border is trimmed so the badge fills the
//      icon edge to edge, the way other app icons do.
//
// The .ico is assembled here rather than left to the packager, so every size
// Windows asks for is a separate high-quality downscale of the full-bleed art.
//
// Run with:  npm run icon
const { app, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = process.argv[2] || path.join(ROOT, 'app_iocn.png');
const OUT_DIR = path.join(ROOT, 'build');
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

// A hair of breathing room so anti-aliased edges are never clipped.
const MARGIN = 0.01;
const ALPHA_FLOOR = 8;

// Smallest rectangle containing every pixel that is not effectively invisible.
function opaqueBounds(bitmap, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (bitmap[(y * width + x) * 4 + 3] > ALPHA_FLOOR) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, width, height };
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

// Centres a BGRA bitmap on a larger transparent canvas.
function centreOn(bitmap, width, height, canvasSize) {
  const canvas = Buffer.alloc(canvasSize * canvasSize * 4, 0);
  const offsetX = Math.floor((canvasSize - width) / 2);
  const offsetY = Math.floor((canvasSize - height) / 2);
  for (let y = 0; y < height; y++) {
    const from = y * width * 4;
    const to = ((y + offsetY) * canvasSize + offsetX) * 4;
    bitmap.copy(canvas, to, from, from + width * 4);
  }
  return nativeImage.createFromBitmap(canvas, { width: canvasSize, height: canvasSize });
}

// Renders the artwork at one size: content scaled to fill, centred, square.
function render(square, size) {
  const inner = Math.max(1, Math.round(size * (1 - MARGIN * 2)));
  const scaled = square.resize({ width: inner, height: inner, quality: 'best' });
  if (inner === size) return scaled;
  return centreOn(scaled.toBitmap(), inner, inner, size);
}

// ICONDIR + one ICONDIRENTRY per size, then the PNG payloads.
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  const directory = Buffer.alloc(images.length * 16);
  let offset = 6 + directory.length;

  images.forEach((image, i) => {
    const at = i * 16;
    directory[at] = image.size >= 256 ? 0 : image.size; // 0 means 256
    directory[at + 1] = image.size >= 256 ? 0 : image.size;
    directory[at + 2] = 0; // palette colours
    directory[at + 3] = 0; // reserved
    directory.writeUInt16LE(1, at + 4); // colour planes
    directory.writeUInt16LE(32, at + 6); // bits per pixel
    directory.writeUInt32LE(image.png.length, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += image.png.length;
  });

  return Buffer.concat([header, directory, ...images.map((i) => i.png)]);
}

app.whenReady().then(() => {
  const image = nativeImage.createFromPath(SOURCE);
  if (image.isEmpty()) {
    console.error(`Could not read ${SOURCE}`);
    app.exit(1);
    return;
  }

  const { width, height } = image.getSize();
  const bounds = opaqueBounds(image.toBitmap(), width, height);
  const fillBefore = ((bounds.width * bounds.height) / (width * height)) * 100;
  console.log(`source: ${width}x${height}, artwork fills ${fillBefore.toFixed(1)}% of it`);
  console.log(`trimming to ${bounds.width}x${bounds.height} at (${bounds.x},${bounds.y})`);

  const cropped = image.crop(bounds);
  const side = Math.max(bounds.width, bounds.height);
  const square = side === bounds.width && side === bounds.height
    ? cropped
    : centreOn(cropped.toBitmap(), bounds.width, bounds.height, side);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const images = ICO_SIZES.map((size) => ({ size, png: render(square, size).toPNG() }));
  const icoPath = path.join(OUT_DIR, 'icon.ico');
  fs.writeFileSync(icoPath, buildIco(images));
  console.log(`wrote build/icon.ico with ${ICO_SIZES.join(', ')} px (${(fs.statSync(icoPath).size / 1024).toFixed(0)} KB)`);

  // 1024 png kept for anything that wants a large source; 128 feeds the header.
  const big = path.join(OUT_DIR, 'icon.png');
  fs.writeFileSync(big, render(square, 1024).toPNG());
  const badge = path.join(ROOT, 'src', 'renderer', 'icon.png');
  fs.writeFileSync(badge, render(square, 128).toPNG());
  console.log('wrote build/icon.png (1024) and src/renderer/icon.png (128)');
  console.log(`artwork now fills ${((1 - MARGIN * 2) ** 2 * 100).toFixed(1)}% of the icon`);

  app.exit(0);
});

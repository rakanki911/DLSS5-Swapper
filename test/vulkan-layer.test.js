'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const layer = require('../src/core/vulkan-layer');

test('Vulkan layer stays registered until the last emulator is restored', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-vulkan-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sourceDir = path.join(root, 'source');
  const targetDir = path.join(root, 'installed');
  fs.mkdirSync(sourceDir, { recursive: true });
  for (const bits of [64, 32]) {
    fs.writeFileSync(path.join(sourceDir, `ReShade${bits}.dll`), `dll${bits}`);
    fs.writeFileSync(path.join(sourceDir, `ReShade${bits}.json`), JSON.stringify({ layer: { name: 'VK_LAYER_reshade' } }));
  }

  const values = new Set();
  const runner = async (_file, args) => {
    if (args[0] === 'query') {
      return { code: values.size ? 0 : 1, stdout: [...values].map((file) => `    ${file}    REG_DWORD    0x0`).join('\r\n'), stderr: '' };
    }
    const value = args[args.indexOf('/v') + 1];
    if (args[0] === 'add') values.add(value);
    if (args[0] === 'delete') values.delete(value);
    return { code: 0, stdout: '', stderr: '' };
  };

  const first = await layer.register({ sourceDir, targetDir, gameDir: path.join(root, 'RPCS3'), runner });
  const second = await layer.register({ sourceDir, targetDir, gameDir: path.join(root, 'Cemu'), runner });
  assert.equal(first.owned, true);
  assert.equal(second.owned, true);
  assert.equal(await layer.detach(first, path.join(root, 'RPCS3'), runner), false);
  assert.equal(values.size, 1);
  assert.equal(await layer.detach(second, path.join(root, 'Cemu'), runner), true);
  assert.equal(values.size, 0);
});

test('without a host registry the layer is refused before anything is written', { skip: process.platform === 'win32' ? 'not Windows' : false }, async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-vulkan-host-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sourceDir = path.join(root, 'source');
  const targetDir = path.join(root, 'installed');
  fs.mkdirSync(sourceDir, { recursive: true });
  for (const bits of [64, 32]) {
    fs.writeFileSync(path.join(sourceDir, `ReShade${bits}.dll`), `dll${bits}`);
    fs.writeFileSync(path.join(sourceDir, `ReShade${bits}.json`), JSON.stringify({ layer: { name: 'VK_LAYER_reshade' } }));
  }

  // Nothing has registered a layer where no registry is reachable.
  assert.equal(await layer.existing(layer.defaultRunner), null);

  await assert.rejects(
    layer.register({ sourceDir, targetDir, gameDir: path.join(root, 'RPCS3') }),
    { code: 'errVulkanLayerUnsupported' }
  );
  // The DLLs must not be lying around after a refusal.
  assert.equal(fs.existsSync(targetDir), false);
});

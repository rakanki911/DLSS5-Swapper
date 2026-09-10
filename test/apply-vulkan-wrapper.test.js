'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const manager = require('../src/core/backend-manager');
const core = require('../src/core/apply');
const layer = require('../src/core/vulkan-layer');
const { writePe } = require('./fixtures/pe');

test('Vulkan Feeder install/reinstall/restore keeps DXVK files intact for x86 and x64', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swapper-vulkan-install-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const put = (rel, text = rel) => {
    const file = path.join(root, 'payload', rel);
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); return file;
  };
  const shaderRoot = path.join(root, 'payload', 'reshade-shaders');
  for (const rel of ['Shaders/DLSS5_Feed.fx', 'Shaders/vort_Motion.fx', 'Shaders/ReShade.fxh',
    'Shaders/ReShadeUI.fxh', 'Shaders/Includes/vort_Defs.fxh', 'Textures/vort_BlueNoise.png']) put('reshade-shaders/' + rel);
  const layerDir = path.join(root, 'payload', 'vulkan');
  for (const bits of [32, 64]) {
    writePe(path.join(layerDir, `ReShade${bits}.dll`), { bitness: bits, text: 'ReShade Searching for add-ons' });
    put(`vulkan/ReShade${bits}.json`, JSON.stringify({ layer: { name: 'VK_LAYER_reshade', library_path: `ReShade${bits}.dll` } }));
  }
  const source = { hasNeuralRendering: true,
    payload: ['nvngx_dlss.dll', 'nvngx_dlssnr.dll'].map(name => ({ name, path: put(name) })),
    feeder: { ok32: true, ok64: true, vulkanOk: true, vulkanLayerDir: layerDir,
      addon32: put('dlss5-feed.addon32'), addon64: put('dlss5-feed.addon64'),
      host64: put('host64/dlss5-feed-host64.exe'), hostAddon: put('host64/renodx-dlss5.addon64'),
      shaderRoot, feedShader: path.join(shaderRoot, 'Shaders/DLSS5_Feed.fx'),
      feedLayer64: path.join(root, 'payload', 'layer-x64'),
      feedLayer32: path.join(root, 'payload', 'layer-x86') } };
  put('layer-x64/VkLayer_feed_vk.dll'); put('layer-x64/VkLayer_feed_vk.json');
  put('layer-x64/run-with-feed-layer.bat');
  put('layer-x86/VkLayer_feed_vk32.dll'); put('layer-x86/VkLayer_feed_vk32.json');
  put('layer-x86/run-with-feed-layer32.bat');
  const values = new Set();
  const runner = async (_file, args) => {
    if (args[0] === 'query') return { code: values.size ? 0 : 1,
      stdout: [...values].map(file => `    ${file}    REG_DWORD    0x0`).join('\n') };
    const file = args[args.indexOf('/v') + 1];
    if (args[0] === 'add') values.add(file);
    if (args[0] === 'delete') values.delete(file);
    return { code: 0, stdout: '' };
  };
  const detach = layer.detach;
  // Use the real detach implementation, but never touch the system registry.
  t.mock.method(layer, 'detach', (info, dir) => detach(info, dir, runner));
  for (const bitness of [32, 64]) {
    const gameDir = path.join(root, `Game${bitness}`);
    const exePath = writePe(path.join(gameDir, 'Game.exe'), { bitness, text: 'Direct3DCreate9' });
    const wrappers = ['d3d9.dll', 'dxgi.dll'].map(name => writePe(path.join(gameDir, name), { bitness, text: 'DXVK vkGetInstanceProcAddr' }));
    const originals = new Map(wrappers.map(file => [file, fs.readFileSync(file)]));
    const config = { gameDir, exePath, bitness, api: 'vulkan', apiLabel: 'Vulkan', route: 'feeder', source,
      registryRunner: runner, vulkanLayerTarget: path.join(root, 'registered-layer'),
      setupRunner: async () => { throw new Error('No external installer should run'); } };
    for (let repeat = 0; repeat < 2; repeat++) {
      const manifest = await manager.install(config);
      assert.equal(manifest.game.api, 'vulkan');
      assert.equal(manifest.vulkanLayer.owned, true);
      assert.equal(manifest.added.includes('d3d9.dll'), false);
      assert.equal(manifest.added.includes('dxgi.dll'), false);
      assert.equal(manifest.replaced.some(item => /^(dxgi|d3d9)\.dll$/i.test(item.rel)), false);
      for (const [file, bytes] of originals) assert.deepEqual(fs.readFileSync(file), bytes);
      assert.equal(values.size, bitness === 32 ? 2 : 1);
      assert.equal(fs.existsSync(path.join(gameDir, 'dgVoodoo.conf')), false);
      // Feeder's own interop layer travels with a Vulkan install: no registry
      // key, nothing global, and the launcher sits beside the game.
      const layerHome = path.join(gameDir, 'dlss5-feed-vk-layer');
      const launcher = bitness === 32 ? 'run-with-feed-layer32.bat' : 'run-with-feed-layer.bat';
      assert.equal(fs.existsSync(path.join(layerHome, launcher)), true, 'the layer launcher is installed');
      assert.equal(fs.existsSync(path.join(layerHome, bitness === 32 ? 'VkLayer_feed_vk32.dll' : 'VkLayer_feed_vk.dll')), true);
      assert.ok(manifest.added.some(item => item.includes('dlss5-feed-vk-layer')), 'and it is tracked for restore');
    }
    assert.equal(await manager.restore(gameDir), true);
    for (const [file, bytes] of originals) assert.deepEqual(fs.readFileSync(file), bytes);
    assert.equal(values.size, 0);
    assert.equal(fs.existsSync(path.join(core.backupRoot(gameDir), 'manifest.json')), false);
    assert.equal(fs.existsSync(path.join(gameDir, 'reshade-shaders')), false);
    assert.equal(fs.existsSync(path.join(gameDir, 'dlss5-feed-vk-layer')), false, 'restore removes the layer too');
  }
});

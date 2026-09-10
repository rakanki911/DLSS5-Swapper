'use strict';

// Real payload/PE architecture checks on synthetic game folders; no game,
// helper, ReShade installer, or GPU process is executed.
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('node:assert/strict');
const { scanSource } = require('../src/core/scan');
const { applySwap, restore } = require('../src/core/apply');
const pe = require('../src/core/pe');
const config = require('../src/core/feeder-config');
const { ensureDgVoodoo } = require('../src/core/runtime-components');

(async () => {
  const source = scanSource(path.join(__dirname, '../payload'));
  assert.equal(source.feeder.releaseVerified, true);
  assert.equal(source.feeder.version, require("../src/core/feeder-release").version);
  // Download/cache only within the project, never the user's application data.
  source.feeder.dgVoodooDir = await ensureDgVoodoo(path.join(__dirname, '../vendor/runtime-tests'));
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-payload-test-'));
  try {
    for (const [bitness, api] of [[32, 'd3d8'], [32, 'd3d9'], [64, 'd3d9'], [32, 'dxgi'], [64, 'dxgi']]) {
      const dir = path.join(temp, `${bitness}-${api}`);
      fs.mkdirSync(dir);
      const exePath = path.join(dir, 'game.exe');
      fs.writeFileSync(exePath, 'Synthetic fixture; never executed');
      fs.writeFileSync(path.join(dir, 'ReShade.ini'), '[RenoDX.DLSS5]\nNeuralUplift=0\n[GENERAL]\nPresetPath=.\\Original.ini\nStartupPresetPath=.\\Other.ini\n');
      fs.writeFileSync(path.join(dir, 'Original.ini'), '[DLSS5_Feed.fx]\nPreprocessorDefinitions=DLSS5_MV_PROVIDER=0\n');
      const originals = Object.fromEntries(['game.exe', 'ReShade.ini', 'Original.ini'].map(name => [name, fs.readFileSync(path.join(dir, name))]));
      // Mimic the user's incorrectly installed ReShade DX9 proxy.
      if (api === 'd3d9') fs.copyFileSync(path.join(source.feeder.vulkanLayerDir, `ReShade${bitness}.dll`), path.join(dir, 'd3d9.dll'));
      if (api === 'd3d9') originals['d3d9.dll'] = fs.readFileSync(path.join(dir, 'd3d9.dll'));
      const options = { gameDir: dir, exePath, api, bitness, route: 'feeder', source, setupRunner: () => { throw new Error('Headless setup must not be needed'); } };
      const manifest = await applySwap(options);
      // Repair an incorrectly sized helper ReShade left by an older install.
      if (bitness === 32) fs.copyFileSync(path.join(source.feeder.vulkanLayerDir, 'ReShade32.dll'), path.join(dir, 'host64/dxgi.dll'));
      await applySwap(options);
      assert.equal(manifest.feeder.version, require("../src/core/feeder-release").version);
      assert.equal(pe.getBitness(path.join(dir, 'dxgi.dll')), bitness);
      assert.equal(pe.getBitness(path.join(dir, `dlss5-feed.addon${bitness}`)), bitness);
      if (api === 'd3d8' || api === 'd3d9') {
        const name = api === 'd3d8' ? 'D3D8.dll' : 'D3D9.dll';
        assert.equal(pe.getBitness(path.join(dir, name)), bitness);
        assert.equal(fs.readFileSync(path.join(dir, name)).equals(fs.readFileSync(path.join(source.feeder.dgVoodooDir, 'MS', bitness === 32 ? 'x86' : 'x64', name))), true);
      }
      if (bitness === 32) {
        assert.equal(pe.getBitness(path.join(dir, 'host64/dxgi.dll')), 64);
        assert.equal(fs.readFileSync(path.join(dir, 'host64/dlss5-feed-host64.exe')).equals(fs.readFileSync(source.feeder.host64)), true);
        assert.equal(config.getIni(config.readText(path.join(dir, 'host64/ReShade.ini')), 'RenoDX.DLSS5', 'NeuralUplift'), '1');
      } else assert.equal(fs.existsSync(path.join(dir, 'host64')), false);
      assert.equal(config.getIni(config.readText(path.join(dir, 'Original.ini')), 'DLSS5_Feed.fx', 'PreprocessorDefinitions'), 'DLSS5_MV_PROVIDER=2');
      assert.equal(fs.existsSync(path.join(dir, 'Verify-DLSS5Feeder.ps1')), true);
      await restore(dir);
      for (const [name, bytes] of Object.entries(originals)) assert.equal(fs.readFileSync(path.join(dir, name)).equals(bytes), true, name);
      assert.equal(fs.existsSync(path.join(dir, 'host64')), false);
      assert.equal(fs.existsSync(path.join(dir, 'reshade-shaders')), false);
      console.log(`PASS: real payload ${bitness}-bit ${api}, repeat install and original restore`);
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

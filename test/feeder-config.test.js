'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const config = require('../src/core/feeder-config');

test('32-bit ReShade configuration preserves user settings and orders the feeder', () => {
  const ini = config.configureGameReShade([
    '[GENERAL]',
    'PresetPath=.\\Custom.ini',
    'EffectSearchPaths=.\\reshade-shaders\\Shaders\\**\\**,D:\\MyShaders\\**',
    'TextureSearchPaths=.\\reshade-shaders\\Textures\\**\\**',
    'PreprocessorDefinitions=OLD_SETTING=1,DLSS5_MV_PROVIDER=0',
    'PerformanceMode=1',
    '',
    '[ADDON]',
    'AddonPath=.\\addons'
  ].join('\r\n'));
  assert.match(ini, /^PresetPath=\.\\Custom\.ini$/m);
  assert.match(ini, /^PerformanceMode=1$/m);
  assert.match(ini, /^EffectSearchPaths=\.\\reshade-shaders\\Shaders\\\*\*,D:\\MyShaders\\\*\*$/m);
  assert.match(ini, /^TextureSearchPaths=\.\\reshade-shaders\\Textures\\\*\*$/m);
  assert.doesNotMatch(ini, /\\\*\*\\\*\*/);
  assert.match(ini, /^PreprocessorDefinitions=DLSS5_MV_PROVIDER=2,OLD_SETTING=1$/m);
  assert.match(ini, /^AddonPath=\.\\$/m);

  const preset = config.configurePreset([
    'Techniques=Existing@Other.fx,DLSS5_Feed@DLSS5_Feed.fx',
    'TechniqueSorting=Existing@Other.fx',
    'PreprocessorDefinitions=SOMETHING=7,DLSS5_MV_PROVIDER=0'
  ].join('\r\n'));
  assert.match(preset, /^Techniques=vort_MotionEffects@vort_Motion\.fx,DLSS5_Feed@DLSS5_Feed\.fx,Existing@Other\.fx$/m);
  assert.match(preset, /^TechniqueSorting=vort_MotionEffects@vort_Motion\.fx,DLSS5_Feed@DLSS5_Feed\.fx,Existing@Other\.fx$/m);
  assert.match(preset, /^PreprocessorDefinitions=DLSS5_MV_PROVIDER=2,SOMETHING=7$/m);
});

test('dgVoodoo configuration enables the D3D9 to D3D11 route', () => {
  const output = config.configureDgVoodoo('[General]\r\nOutputAPI=bestavailable\r\n\r\n[DirectX]\r\nVRAM=256\r\n');
  assert.match(output, /^OutputAPI=d3d11_fl11_0$/m);
  assert.match(output, /^CaptureMouse=false$/m);
  assert.match(output, /^DisableAndPassThru=false$/m);
  // 256 is dgVoodoo's own default and is exhausted in seconds by a DirectX 9
  // game at a modern resolution; the emulated ceiling has to be generous.
  assert.match(output, /^VRAM=4096$/m);
  assert.match(output, /^dgVoodooWatermark=false$/m);
});

test('SWTOR per-effect provider overrides are repaired without changing other effects', () => {
  const original = '[Other.fx]\nPreprocessorDefinitions=OTHER=7\n[DLSS5_Feed.fx]\nPreprocessorDefinitions=DLSS5_MV_PROVIDER=0,KEEP=8\n';
  const preset = config.configurePreset(original, 3);
  assert.equal(config.getIni(preset, '', 'PreprocessorDefinitions'), 'DLSS5_MV_PROVIDER=3');
  assert.equal(config.getIni(preset, 'DLSS5_Feed.fx', 'PreprocessorDefinitions'), 'DLSS5_MV_PROVIDER=3,KEEP=8');
  assert.equal(config.getIni(preset, 'Other.fx', 'PreprocessorDefinitions'), 'OTHER=7');
  assert.match(config.getIni(preset, '', 'Techniques'), /^Lumenite_Kernel@.*DLSS5_Feed@/);
  assert.equal(config.configurePreset(preset, 3), preset);
});

test('Feeder arms RenoDX and host hotkeys cannot accidentally switch NR off', () => {
  const text = '[RenoDX.DLSS5]\nEnableHooks=0\nNeuralUplift=0\nNREnableUpscaling=1\nNRStyle=2\nNRToggleKey=117\nNRIntensity=0.75\n';
  const ini = config.configureHostReShade(text);
  assert.equal(config.getIni(ini, 'RenoDX.DLSS5', 'EnableHooks'), '2');
  assert.equal(config.getIni(ini, 'RenoDX.DLSS5', 'NeuralUplift'), '1');
  assert.equal(config.getIni(ini, 'RenoDX.DLSS5', 'NREnableUpscaling'), '0');
  assert.equal(config.getIni(ini, 'RenoDX.DLSS5', 'NRStyle'), '0');
  assert.equal(config.getIni(ini, 'RenoDX.DLSS5', 'NRToggleKey'), '0');
  assert.equal(config.getIni(ini, 'RenoDX.DLSS5', 'NRIntensity'), '0.75');
});

test('Xenia mitigation disables experimental camera vectors and enables validation', () => {
  const preset = config.configurePreset('[DLSS5_Feed.fx]\nGEOM_ENABLE=1\nMV_VALIDATE=0\n', 2, { xenia: true });
  assert.equal(config.getIni(preset, 'DLSS5_Feed.fx', 'GEOM_ENABLE'), '0');
  assert.equal(config.getIni(preset, 'DLSS5_Feed.fx', 'MV_VALIDATE'), '1');
  const ini = config.configureConsumer('', { xenia: true });
  assert.equal(config.getIni(ini, 'RenoDX.DLSS5', 'NRUICorrection'), '1');
  assert.equal(config.getIni(ini, 'RenoDX.DLSS5', 'NRAutoMask'), '1');
});

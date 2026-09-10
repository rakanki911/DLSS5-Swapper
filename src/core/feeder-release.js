'use strict';

// One verified release for the shader, both client architectures and helper.
// Never mix host protocol versions. Digest supplied by GitHub's release API.
module.exports = {
  version: '0.15.1',
  archive: ['DLSS5-Feeder-0.15.1.zip', 'https://github.com/jlrouzies-fr/DLSS5-Feeder/releases/download/v0.15.1/DLSS5-Feeder-0.15.1.zip', '2e44e81e691e75e532b9b7babc278a12615cb7f0fd9ef854da50e6ef17b272f4'],
  // The overlay pins dlss5-feed.addon64 by size and digest before it will
  // drive Feeder's sliders, so the number lives here too and a build-time
  // check holds the two in step. #225 was this pin going stale unnoticed.
  addon64Size: 297472,
  hashes: {
    'dlss5-feed.addon32': 'fb69357075cba536b42f2e693992fde0c1775058b1fd9f10fbdf1e7eba3443e7',
    'dlss5-feed.addon64': '3afc8efb5f516e94a2a068b2e90eaed360d1e30ca2c29b623e0cfadc1f05d50d',
    'dlss5-feed-host64.exe': '034e6cdf382e6ea9164afd63c5b8a8aa0312894cb342593bc933e9fa435f8d02',
    'reshade-shaders/Shaders/DLSS5_Feed.fx': 'cdac08a721b14b97187dd86c5b5bead157c9063d7ee859a0f131a8ee791695f1',
    // Feeder's own loader layer. A Vulkan game whose driver does not expose
    // the KHR external-interop extensions needs it for one launch.
    'layer-x64/VkLayer_feed_vk.dll': 'a789badd4bb43eb26d694d347d8b17cc57c36006154fbb677c08e5e9c713984e',
    'layer-x64/VkLayer_feed_vk.json': 'c15967b3f8847a145e21058a1e57e92c595ee17fc5dd23ab3278b0148ad6e9d1',
    'layer-x64/run-with-feed-layer.bat': 'bc9aa7964742e23653556be978f540f503f3cef928b6de7a38f77c570bb764f9',
    'layer-x86/VkLayer_feed_vk32.dll': '7ed337ff071cf8c94408c90c8d4fea796436fc8a0335e6017632ec57536d9c42',
    'layer-x86/VkLayer_feed_vk32.json': '28f8174eb8fed02266bafa6910eab07922ec6d2bdb33110699c586f74b254921',
    'layer-x86/run-with-feed-layer32.bat': '75d4584ad01619402a10e0d8342b114613057a1d3b0ac8dbe9280b740090c3e8'
  }
};

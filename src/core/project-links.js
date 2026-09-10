'use strict';

// Only these destinations may be opened by the renderer, never arbitrary URLs.
const links = Object.freeze({
  github: 'https://github.com/rakanki911/DLSS5-Swapper',
  releases: 'https://github.com/rakanki911/DLSS5-Swapper/releases/latest',
  coffee: 'https://buymeacoffee.com/rakanki911'
});
function projectUrl(key) {
  return typeof key === 'string' && Object.hasOwn(links, key) ? links[key] : null;
}
module.exports = { links, projectUrl };

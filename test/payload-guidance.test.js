'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { missingPayload } = require('../src/core/payload-guidance');

test('an installed app gives recovery guidance when its payload is missing', () => {
  const result = missingPayload({
    packaged: true,
    resourcesPath: path.join('C:', 'Program Files', 'DLSS 5 Swapper', 'resources'),
    appRoot: path.join('C:', 'source')
  });

  assert.equal(result.code, 'errPayloadMissing');
  assert.match(result.message, /resources[\\/]payload/);
  assert.match(result.message, /antivirus quarantine/i);
  assert.match(result.message, /reinstall DLSS 5 Swapper/i);
  assert.match(result.message, /No game files were changed/i);
  assert.doesNotMatch(result.message, /npm run payload/i);
});

test('a source checkout keeps the payload build command', () => {
  const result = missingPayload({
    packaged: false,
    resourcesPath: path.join('C:', 'installed', 'resources'),
    appRoot: path.join('C:', 'source')
  });

  assert.equal(result.code, 'errPayloadMissing');
  assert.match(result.message, /source[\\/]payload/);
  assert.match(result.message, /npm run payload/i);
  assert.doesNotMatch(result.message, /reinstall DLSS 5 Swapper/i);
});

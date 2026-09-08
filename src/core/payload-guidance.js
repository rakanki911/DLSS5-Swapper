'use strict';

const path = require('node:path');

function missingPayload({ packaged, resourcesPath, appRoot }) {
  const directory = path.join(packaged ? resourcesPath : appRoot, 'payload');
  if (!packaged) {
    return {
      code: 'errPayloadMissing',
      message: `The payload is missing or incomplete at ${directory}. Run "npm run payload" from the project directory.`
    };
  }
  return {
    code: 'errPayloadMissing',
    message: `Required DLSS files are missing or incomplete at ${directory}. Check antivirus quarantine, then restore and allow the files or reinstall DLSS 5 Swapper. No game files were changed.`
  };
}

module.exports = { missingPayload };

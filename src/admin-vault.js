'use strict';

const fs = require('node:fs');
const path = require('node:path');

const TOKEN_PATTERN = /^dlss5_admin_[A-Za-z0-9_-]{43}$/;

class AdminVault {
  constructor({ file, storage }) {
    this.file = file;
    this.storage = storage;
    this.cached = undefined;
  }

  load() {
    if (this.cached !== undefined) return this.cached;
    this.cached = null;
    if (!this.storage || !this.storage.isEncryptionAvailable()) return null;
    try {
      const token = this.storage.decryptString(fs.readFileSync(this.file));
      if (TOKEN_PATTERN.test(token)) this.cached = token;
    } catch { /* no saved credential, or Windows can no longer decrypt it */ }
    return this.cached;
  }

  save(token) {
    const clean = String(token || '').trim();
    if (!TOKEN_PATTERN.test(clean)) throw new Error('Invalid administrator access code.');
    if (!this.storage || !this.storage.isEncryptionAvailable()) throw new Error('Secure credential storage is unavailable.');
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, this.storage.encryptString(clean), { mode: 0o600 });
    fs.renameSync(temporary, this.file);
    this.cached = clean;
  }

  clear() {
    this.cached = null;
    try { fs.unlinkSync(this.file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

module.exports = { AdminVault, TOKEN_PATTERN };

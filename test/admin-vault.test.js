'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { AdminVault } = require('../src/admin-vault');

test('the administrator credential is encrypted on disk and can be removed', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-admin-vault-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'admin.bin');
  const storage = {
    isEncryptionAvailable: () => true,
    encryptString: value => Buffer.from([...Buffer.from(value)].map(byte => byte ^ 0x5a)),
    decryptString: value => Buffer.from([...value].map(byte => byte ^ 0x5a)).toString('utf8')
  };
  const token = 'dlss5_admin_' + 'C'.repeat(43);
  const vault = new AdminVault({ file, storage });
  vault.save(token);
  assert.equal(fs.readFileSync(file).includes(Buffer.from(token)), false, 'the bearer code is never plaintext');
  assert.equal(new AdminVault({ file, storage }).load(), token);
  vault.clear();
  assert.equal(fs.existsSync(file), false);
});

test('the vault refuses plaintext fallback when secure storage is unavailable', () => {
  const vault = new AdminVault({ file: 'unused', storage: { isEncryptionAvailable: () => false } });
  assert.throws(() => vault.save('dlss5_admin_' + 'D'.repeat(43)), /Secure credential storage/);
});

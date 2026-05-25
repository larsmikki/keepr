import os from 'os';
import path from 'path';
import fs from 'fs';

const testVault = fs.mkdtempSync(path.join(os.tmpdir(), 'vaulty-test-'));
process.env.VAULT_ROOT = testVault;

process.on('exit', () => {
  try {
    fs.rmSync(testVault, { recursive: true, force: true });
  } catch {}
});

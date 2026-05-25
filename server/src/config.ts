import path from 'path';

export const config = {
  port: parseInt(process.env.PORT || '3111', 10),
  vaultRoot: process.env.VAULT_ROOT || path.join(process.cwd(), 'vault'),
};

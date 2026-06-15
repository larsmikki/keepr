import { initDb } from './db/connection.js';
import { runMigrations } from './db/migrate.js';
import { createApp } from './app.js';
import { config } from './config.js';

process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  console.error(`[server] Unhandled promise rejection at ${new Date().toISOString()}`);
  console.error('[server] Message:', err.message);
  console.error('[server] Stack:', err.stack);
  if ((err as { cause?: unknown }).cause) console.error('[server] Cause:', (err as { cause?: unknown }).cause);
});

process.on('uncaughtException', (err) => {
  console.error(`[server] Uncaught exception at ${new Date().toISOString()}`);
  console.error('[server] Message:', err.message);
  console.error('[server] Stack:', err.stack);
  if ((err as { cause?: unknown }).cause) console.error('[server] Cause:', (err as { cause?: unknown }).cause);
});

async function main() {
  await initDb();
  runMigrations();
  console.log('Database initialized');

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`Documentr server running on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

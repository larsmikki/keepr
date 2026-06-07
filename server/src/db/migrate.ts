import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb, saveDb } from './connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function runMigrations(): void {
  const db = getDb();

  db.run(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const migrationsDir = path.join(__dirname, 'migrations');

  let migrationFiles: string[] = [];
  if (fs.existsSync(migrationsDir)) {
    migrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
  }

  for (const file of migrationFiles) {
    const [row] = db.exec(`SELECT name FROM _migrations WHERE name = '${file}'`);
    if (row && row.values.length > 0) continue;

    console.log(`Running migration: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

    // Run each statement individually so FTS5 failures don't block non-FTS5 DDL.
    // sql.js (used in tests) ships without the FTS5 extension.
    const statements = sql
      .split(/;\s*(?=\n|$)/m)
      .map(s => s.trim())
      .filter(Boolean);

    for (const stmt of statements) {
      try {
        db.run(stmt);
      } catch (err: any) {
        const isFts5 = /fts5|documents_fts/i.test(stmt);
        if (isFts5) {
          console.warn(`[migrate] Skipping FTS5 statement in ${file} (not supported in this SQLite build)`);
        } else {
          throw err;
        }
      }
    }

    db.run(`INSERT INTO _migrations (name) VALUES ('${file}')`);
  }

  saveDb();
}

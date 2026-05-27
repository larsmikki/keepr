// @ts-expect-error sql.js has no bundled types for this import
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

let db: SqlJsDatabase | null = null;

const dbPath = path.join(config.vaultRoot, 'vaulty.db');

class Statement {
  constructor(private rawDb: SqlJsDatabase, private sql: string) {}

  all(...params: any[]): any[] {
    const args = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const stmt = this.rawDb.prepare(this.sql);
    if (args.length) stmt.bind(args);
    const results: any[] = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  }

  get(...params: any[]): any {
    const args = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const stmt = this.rawDb.prepare(this.sql);
    if (args.length) stmt.bind(args);
    const result = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return result;
  }

  run(...params: any[]): { changes: number } {
    const args = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const stmt = this.rawDb.prepare(this.sql);
    if (args.length) stmt.bind(args);
    stmt.step();
    stmt.free();
    return { changes: this.rawDb.getRowsModified() };
  }
}

class DatabaseWrapper {
  prepare(sql: string): Statement {
    if (!db) throw new Error('Database not initialized. Call initDb() first.');
    return new Statement(db, sql);
  }

  exec(sql: string): void {
    if (!db) throw new Error('Database not initialized. Call initDb() first.');
    db.run(sql);
  }

  transaction<T>(fn: (...args: any[]) => T): (...args: any[]) => T {
    return (...args: any[]) => {
      if (!db) throw new Error('Database not initialized. Call initDb() first.');
      db.run('BEGIN TRANSACTION');
      try {
        const result = fn(...args);
        db.run('COMMIT');
        return result;
      } catch (err) {
        db.run('ROLLBACK');
        throw err;
      }
    };
  }
}

const dbWrapper = new DatabaseWrapper();

export async function initDb(): Promise<void> {
  if (db) return;

  const SQL = await initSqlJs();

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');
}

export function getDb(): SqlJsDatabase {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

export function saveDb(): void {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.writeFileSync(dbPath, buffer);
}

export default dbWrapper;

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import db, { saveDb } from '../db/connection.js';
import { calculateChecksum } from './checksumService.js';
import { config } from '../config.js';

export interface RescanResult {
  newFiles: string[];
  missingFiles: string[];
  movedFiles: string[];
  checksumMismatches: string[];
  sidecarConflicts: string[];
  deletedFromDb: string[];
  importedNewFiles: number;
  cleanedSidecarDocs: number;
}

export const rescanVault = async (deleteMissing = false, importNew = false): Promise<RescanResult> => {
  console.log('Starting vault rescan...');
  const result: RescanResult = {
    newFiles: [],
    missingFiles: [],
    movedFiles: [],
    checksumMismatches: [],
    sidecarConflicts: [],
    deletedFromDb: [],
    importedNewFiles: 0,
    cleanedSidecarDocs: 0,
  };

  const DOCS_ROOT = path.join(config.vaultRoot, 'documents');

  const filesOnDisk = await findFiles(DOCS_ROOT);
  const docFiles = filesOnDisk.filter(f => !f.endsWith('.sidecar.json'));

  const dbDocs = db.prepare('SELECT id, filePath, sidecarPath FROM documents').all() as { id: string, filePath: string, sidecarPath: string }[];
  for (const doc of dbDocs) {
    try {
      await fs.access(doc.filePath);
    } catch {
      result.missingFiles.push(doc.id);
      if (deleteMissing) {
        db.prepare('DELETE FROM documents WHERE id = ?').run(doc.id);
        try {
          await fs.unlink(doc.sidecarPath);
        } catch {}
        result.deletedFromDb.push(doc.id);
      }
    }
  }

  for (const filePath of docFiles) {
    const sidecarPath = filePath + '.sidecar.json';

    const doc = db.prepare('SELECT id, checksum FROM documents WHERE filePath = ?').get(filePath) as any;

    if (!doc) {
      const checksum = await calculateChecksum(filePath);
      const duplicate = db.prepare('SELECT id FROM documents WHERE checksum = ?').get(checksum) as any;
      if (!duplicate) {
        result.newFiles.push(filePath);
      }
    } else {
      const currentChecksum = await calculateChecksum(filePath);
      if (currentChecksum !== doc.checksum) {
        result.checksumMismatches.push(doc.id);
      }
    }

    try {
      await fs.access(sidecarPath);
      if (!doc) {
        result.sidecarConflicts.push(sidecarPath);
      }
    } catch {
      if (doc) {
        result.sidecarConflicts.push(filePath);
      }
    }
  }

  let dbDirty = deleteMissing && result.deletedFromDb.length > 0;

  if (importNew && result.newFiles.length > 0) {
    const insert = db.prepare(`
      INSERT INTO documents (id, title, originalFilename, storedFilename, filePath, sidecarPath, checksum, fileSize, documentDate, description, tags, notes, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    for (const filePath of result.newFiles) {
      try {
        const stat = await fs.stat(filePath);
        const checksum = await calculateChecksum(filePath);
        const id = crypto.randomUUID();
        const storedFilename = path.basename(filePath);
        const sidecarPath = filePath + '.sidecar.json';

        let title = path.basename(storedFilename, path.extname(storedFilename));
        let originalFilename = storedFilename;
        let documentDate: string | null = null;
        let description: string | null = null;
        let tags: string | null = null;
        let notes: string | null = null;

        try {
          const sidecarRaw = await fs.readFile(sidecarPath, 'utf8');
          const sidecar = JSON.parse(sidecarRaw);
          if (sidecar.title) title = sidecar.title;
          if (sidecar.originalFilename) originalFilename = sidecar.originalFilename;
          if (sidecar.documentDate) documentDate = sidecar.documentDate;
          if (sidecar.description) description = sidecar.description;
          if (sidecar.tags) tags = Array.isArray(sidecar.tags) ? JSON.stringify(sidecar.tags) : sidecar.tags;
          if (sidecar.notes) notes = sidecar.notes;
        } catch {
          // no sidecar — fallback values already set above
        }

        insert.run(id, title, originalFilename, storedFilename, filePath, sidecarPath, checksum, stat.size, documentDate, description, tags, notes);
        result.importedNewFiles++;
      } catch (err) {
        console.error('[rescan] Failed to import new file:', filePath, err);
      }
    }
    dbDirty = true;
  }

  if (dbDirty) saveDb();

  console.log('Rescan complete.', result);
  return result;
};

async function findFiles(dir: string, files: string[] = []): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const res = path.resolve(dir, entry.name);
      if (entry.isDirectory()) {
        await findFiles(res, files);
      } else {
        files.push(res);
      }
    }
  } catch {
    // dir doesn't exist yet
  }
  return files;
}

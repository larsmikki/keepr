import fs from 'fs/promises';
import path from 'path';
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
}

export const rescanVault = async (deleteMissing = false): Promise<RescanResult> => {
  console.log('Starting vault rescan...');
  const result: RescanResult = {
    newFiles: [],
    missingFiles: [],
    movedFiles: [],
    checksumMismatches: [],
    sidecarConflicts: [],
    deletedFromDb: [],
  };

  const DOCS_ROOT = path.join(config.vaultRoot, 'documents');

  const filesOnDisk = await findFiles(DOCS_ROOT);
  const docFiles = filesOnDisk.filter(f => !f.endsWith('.vaulty.json'));

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
    const sidecarPath = filePath + '.vaulty.json';

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

  if (deleteMissing && result.deletedFromDb.length > 0) {
    saveDb();
  }

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

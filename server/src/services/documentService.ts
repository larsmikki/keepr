import fs from 'fs/promises';
import path from 'path';
import db from '../db/connection.js';
import { saveDb } from '../db/connection.js';
import { calculateChecksum } from './checksumService.js';
import { generateSafeFilename } from '../utils/fileUtils.js';
import { buildSidecar } from '../utils/sidecarUtils.js';
import { DocumentInput } from '../models/document.js';
import { config } from '../config.js';
import crypto from 'crypto';
import { extractDocumentText } from './textExtractionService.js';

const DOCS_ROOT = path.join(config.vaultRoot, 'documents');

const decodeUploadName = (name: string) =>
  /[ÃÂâ]/.test(name) ? Buffer.from(name, 'latin1').toString('utf8') : name;

type FolderOrganization = 'year-month' | 'flat';

export const getFolderPattern = (): FolderOrganization => {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'folder_organization'").get() as { value: string } | undefined;
  const pattern = row?.value || 'year-month';
  return ['year-month', 'flat'].includes(pattern) ? pattern as FolderOrganization : 'year-month';
};

const getTargetPath = (date: string): string => {
  const pattern = getFolderPattern();
  if (pattern === 'flat') return DOCS_ROOT;
  const [year, month = '00'] = date.split('-');
  return path.join(DOCS_ROOT, year, month);
};

export const ensureVaultExists = async () => {
  await fs.mkdir(DOCS_ROOT, { recursive: true });
};

export const saveDocument = async (file: {
  path: string;
  originalname: string;
  mimetype: string;
  size: number;
}, metadata: DocumentInput, fileLastModified?: number) => {
  await ensureVaultExists();

  const originalName = decodeUploadName(file.originalname);
  const checksum = await calculateChecksum(file.path);

  const existing = db.prepare('SELECT id, filePath FROM documents WHERE checksum = ?').get(checksum) as any;
  if (existing) return { duplicate: true, documentId: existing.id, filePath: existing.filePath };

  const mergedMetadata = { ...metadata };
  if (!mergedMetadata.title) {
    mergedMetadata.title = path.basename(originalName, path.extname(originalName));
  }
  const ext = path.extname(originalName);
  const storedFilename = generateSafeFilename(mergedMetadata, ext);
  const date = mergedMetadata.documentDate || new Date().toISOString().split('T')[0];
  const targetDir = getTargetPath(date);
  await fs.mkdir(targetDir, { recursive: true });

  const filePath = path.join(targetDir, storedFilename);
  const sidecarPath = filePath + '.sidecar.json';

  try {
    await fs.rename(file.path, filePath);
  } catch (err: any) {
    if (err?.code === 'EXDEV') {
      await fs.copyFile(file.path, filePath);
      await fs.unlink(file.path);
    } else {
      throw err;
    }
  }

  if (fileLastModified) {
    const mtime = new Date(fileLastModified);
    await fs.utimes(filePath, mtime, mtime);
  }

  const id = `doc_${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  const docRecord = {
    id,
    title: mergedMetadata.title || null,
    description: mergedMetadata.description || null,
    documentDate: mergedMetadata.documentDate || null,
    tags: JSON.stringify(mergedMetadata.tags || []),
    notes: mergedMetadata.notes || null,
    folder: (mergedMetadata as any).folder || null,
    originalFilename: originalName,
    storedFilename,
    filePath,
    sidecarPath,
    checksum,
    fileSize: file.size,
    createdAt: now,
    updatedAt: now,
  };

  await fs.writeFile(sidecarPath, JSON.stringify(buildSidecar(docRecord), null, 2));

  db.prepare(`
    INSERT INTO documents (
      id, title, description,
      documentDate, tags, notes, folder,
      originalFilename, storedFilename, filePath, sidecarPath, checksum, fileSize
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    docRecord.title, docRecord.description, docRecord.documentDate,
    docRecord.tags, docRecord.notes, docRecord.folder,
    originalName, storedFilename, filePath, sidecarPath, checksum, file.size
  );

  // Add to FTS index
  try {
    db.prepare(
      `INSERT INTO documents_fts (document_id, title, description, notes, tags, extracted_text)
       VALUES (?, ?, ?, ?, ?, '')`
    ).run(id, docRecord.title ?? '', docRecord.description ?? '', docRecord.notes ?? '', docRecord.tags ?? '');
  } catch {}

  saveDb();
  return { duplicate: false, documentId: id, filePath };
};

// ─── FTS sync helper — call after any documents table change ─────────────────

export function syncDocumentFts(id: string): void {
  try {
    db.prepare('DELETE FROM documents_fts WHERE document_id = ?').run(id);
    db.prepare(`
      INSERT INTO documents_fts (document_id, title, description, notes, tags, extracted_text)
      SELECT id,
        COALESCE(title, ''),
        COALESCE(description, ''),
        COALESCE(notes, ''),
        COALESCE(tags, ''),
        COALESCE(extractedText, '')
      FROM documents WHERE id = ?
    `).run(id);
  } catch {}
}

// ─── Background OCR — run after upload, store result in DB + FTS ─────────────

export async function extractAndStoreText(docId: string): Promise<void> {
  const doc = db.prepare(
    'SELECT filePath, storedFilename, originalFilename FROM documents WHERE id = ?'
  ).get(docId) as { filePath: string; storedFilename: string; originalFilename: string } | null;

  if (!doc) return;

  try {
    const extracted = await extractDocumentText(
      doc.filePath,
      doc.storedFilename || doc.originalFilename
    );

    if (extracted.text) {
      db.prepare('UPDATE documents SET extractedText = ? WHERE id = ?').run(extracted.text, docId);
      syncDocumentFts(docId);
      saveDb();
      console.log(`[extract] stored ${extracted.text.length} chars for ${docId}`);
    }
  } catch (err: any) {
    console.warn(`[extract] background extraction failed for ${docId}:`, err.message);
  }
}

import fs from 'fs/promises';
import path from 'path';
import db from '../db/connection.js';
import { saveDb } from '../db/connection.js';
import { calculateChecksum } from './checksumService.js';
import { generateSafeFilename } from '../utils/fileUtils.js';
import { DocumentInput } from '../models/document.js';
import { config } from '../config.js';
import crypto from 'crypto';

const DOCS_ROOT = path.join(config.vaultRoot, 'documents');

const decodeUploadName = (name: string) =>
  /[ÃÂâ]/.test(name) ? Buffer.from(name, 'latin1').toString('utf8') : name;

type FolderOrganization = 'year-month' | 'category-year' | 'year-category' | 'type-year' | 'flat';

export const getFolderPattern = (): FolderOrganization => {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'folder_organization'").get() as { value: string } | undefined;
  const pattern = row?.value || 'year-month';
  if (['year-month', 'category-year', 'year-category', 'type-year', 'flat'].includes(pattern)) {
    return pattern as FolderOrganization;
  }
  return 'year-month';
};

const getTargetPath = (metadata: DocumentInput, date: string): string => {
  const pattern = getFolderPattern();
  const year = date.split('-')[0];
  const month = date.split('-')[1] || '00';

  if (pattern === 'flat') {
    return DOCS_ROOT;
  }

  if (pattern === 'category-year') {
    const category = metadata.category || 'Uncategorized';
    return path.join(DOCS_ROOT, category, year);
  }

  if (pattern === 'year-category') {
    const category = metadata.category || 'Uncategorized';
    return path.join(DOCS_ROOT, year, category);
  }

  if (pattern === 'type-year') {
    const docType = metadata.documentType || 'Other';
    return path.join(DOCS_ROOT, docType, year);
  }

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
}, metadata: DocumentInput) => {
  await ensureVaultExists();

  const originalName = decodeUploadName(file.originalname);
  const checksum = await calculateChecksum(file.path);

  const existing = db.prepare('SELECT id, filePath FROM documents WHERE checksum = ?').get(checksum);
  if (existing) {
    return { duplicate: true, documentId: existing.id, filePath: existing.filePath };
  }

  const mergedMetadata = { ...metadata };
  if (!mergedMetadata.title) {
    mergedMetadata.title = path.basename(originalName, path.extname(originalName));
  }
  const ext = path.extname(originalName);
  const storedFilename = generateSafeFilename(mergedMetadata, ext);

  const date = mergedMetadata.documentDate || new Date().toISOString().split('T')[0];
  const targetDir = getTargetPath(mergedMetadata, date);
  await fs.mkdir(targetDir, { recursive: true });

  const filePath = path.join(targetDir, storedFilename);
  const sidecarPath = filePath + '.vaulty.json';

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

  const sidecar = {
    vaultyVersion: 1,
    ...mergedMetadata,
    originalFilename: originalName,
    storedFilename,
    filePath,
    sidecarPath,
    checksum,
    fileSize: file.size,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(sidecarPath, JSON.stringify(sidecar, null, 2));

  const id = `doc_${crypto.randomUUID()}`;
  db.prepare(`
    INSERT INTO documents (
      id, title, description, category, documentType, amount, currency,
      documentDate, tags, notes,
      originalFilename, storedFilename, filePath, sidecarPath, checksum, fileSize
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    mergedMetadata.title || null,
    mergedMetadata.description || null,
    mergedMetadata.category || null,
    mergedMetadata.documentType || null,
    mergedMetadata.amount ?? null,
    mergedMetadata.currency || null,
    mergedMetadata.documentDate || null,
    JSON.stringify(mergedMetadata.tags || []),
    mergedMetadata.notes || null,
    originalName,
    storedFilename,
    filePath,
    sidecarPath,
    checksum,
    file.size
  );

  saveDb();
  return { duplicate: false, documentId: id, filePath };
};

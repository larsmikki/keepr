import express from 'express';
import db, { saveDb } from '../db/connection.js';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { config } from '../config.js';

const router = express.Router();

router.post('/import-folder', async (req, res) => {
  try {
    const { folderPath } = req.body;
    if (!folderPath) {
      return res.status(400).json({ error: 'Folder path is required' });
    }

    if (!fs.existsSync(folderPath)) {
      return res.status(400).json({ error: 'Folder does not exist' });
    }

    if (!fs.statSync(folderPath).isDirectory()) {
      return res.status(400).json({ error: 'Path is not a directory' });
    }

    fs.mkdirSync(config.vaultRoot, { recursive: true });

    const existing = db.prepare('SELECT filePath FROM documents').all() as { filePath: string }[];
    const existingPaths = new Set(existing.map(e => e.filePath));

    const files = fs.readdirSync(folderPath);
    let imported = 0;
    let skipped = 0;

    for (const file of files) {
      const sourcePath = path.join(folderPath, file);
      const fileStat = fs.statSync(sourcePath);

      if (!fileStat.isFile()) continue;

      if (existingPaths.has(sourcePath)) {
        skipped++;
        continue;
      }

      const ext = path.extname(file);
      const id = crypto.randomUUID();
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');

      const destDir = path.join(config.vaultRoot, 'documents', String(year), month);
      fs.mkdirSync(destDir, { recursive: true });

      const storedFilename = `${id}${ext}`;
      const destPath = path.join(destDir, storedFilename);

      fs.copyFileSync(sourcePath, destPath);

      const fileBuffer = fs.readFileSync(destPath);
      const checksum = `sha256:${crypto.createHash('sha256').update(fileBuffer).digest('hex')}`;

      const title = path.basename(file, ext);
      db.prepare(`
        INSERT INTO documents (id, title, documentDate, originalFilename, storedFilename, filePath, checksum, fileSize, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(id, title, '', file, storedFilename, destPath, checksum, fileStat.size);

      imported++;
    }

    saveDb();

    res.json({ imported, skipped, message: `Imported ${imported} files, skipped ${skipped} existing files` });
  } catch (err: any) {
    console.error('Import folder error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

import express from 'express';
import db from '../db/database.js';
import fs from 'fs';
import JSZip from 'jszip';
import { buildSidecar } from '../utils/sidecarUtils.js';

const router = express.Router();

router.get('/metadata/:id', (req, res) => {
  try {
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id) as any;
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json(buildSidecar(doc));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/all-metadata', (req, res) => {
  try {
    const docs = db.prepare('SELECT id FROM documents').all() as any[];
    res.json({ count: docs.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/download/:id', (req, res) => {
  try {
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id) as any;
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.download(doc.filePath, doc.originalFilename || doc.storedFilename);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Streaming ZIP export â€” avoids loading all files into memory at once
router.post('/batch', async (req, res) => {
  try {
    const { ids, includeSidecars = true } = req.body as { ids: string[]; includeSidecars?: boolean };
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No document IDs provided' });
    }

    const zip = new JSZip();
    const errors: string[] = [];

    for (const id of ids) {
      const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as any;
      if (!doc) { errors.push(`Document ${id} not found`); continue; }
      try {
        // Read file as a Node.js stream to avoid loading all into RAM simultaneously
        const fileStream = fs.createReadStream(doc.filePath);
        const filename = doc.originalFilename || doc.storedFilename || `document-${id}`;
        zip.file(filename, fileStream);
        if (includeSidecars) zip.file(`${filename}.sidecar.json`, JSON.stringify(buildSidecar(doc), null, 2));
      } catch (err: any) {
        errors.push(`Failed to read ${doc.title}: ${err.message}`);
      }
    }

    const date = new Date().toISOString().split('T')[0];
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="keepr-export-${date}.zip"`,
    });

    // Pipe the ZIP stream directly to the response â€” no full buffer in memory
    zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
      .pipe(res)
      .on('error', err => {
        if (!res.headersSent) res.status(500).json({ error: (err as Error).message });
      });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/csv', (req, res) => {
  try {
    const docs = db.prepare('SELECT * FROM documents ORDER BY createdAt DESC').all() as any[];
    const headers = [
      'id', 'title', 'description', 'documentDate', 'tags', 'notes',
      'originalFilename', 'storedFilename', 'filePath', 'checksum',
      'fileSize', 'folder', 'favorite', 'createdAt', 'updatedAt',
    ];
    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
      return str;
    };
    const rows = docs.map(doc => headers.map(h => {
      let v = doc[h];
      if (h === 'tags') { try { v = JSON.parse(v || '[]').join('; '); } catch { v = ''; } }
      return escapeCSV(v);
    }).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="keepr-index-${new Date().toISOString().split('T')[0]}.csv"`,
    });
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;


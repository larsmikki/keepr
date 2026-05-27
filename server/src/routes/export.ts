import express from 'express';
import db from '../db/database.js';
import fs from 'fs';
import JSZip from 'jszip';

const router = express.Router();

router.get('/metadata/:id', (req, res) => {
  try {
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id) as any;
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const sidecar = {
      vaultyVersion: 1,
      documentId: doc.id,
      title: doc.title,
      description: doc.description,
      category: doc.category,
      documentType: doc.documentType,
      amount: doc.amount,
      currency: doc.currency,
      documentDate: doc.documentDate,
      tags: JSON.parse(doc.tags || '[]'),
      notes: doc.notes,
      originalFilename: doc.originalFilename,
      storedFilename: doc.storedFilename,
      checksum: doc.checksum,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };

    res.json(sidecar);
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

router.post('/batch', async (req, res) => {
  try {
    const { ids } = req.body as { ids: string[] };
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No document IDs provided' });
    }

    const zip = new JSZip();
    const errors: string[] = [];

    for (const id of ids) {
      const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as any;
      if (!doc) {
        errors.push(`Document ${id} not found`);
        continue;
      }

      try {
        const fileData = await fs.promises.readFile(doc.filePath);
        const filename = doc.originalFilename || doc.storedFilename || `document-${id}`;
        zip.file(filename, fileData);

        const sidecarData = JSON.stringify({
          vaultyVersion: 1,
          documentId: doc.id,
          title: doc.title,
          description: doc.description,
          category: doc.category,
          documentType: doc.documentType,
          amount: doc.amount,
          currency: doc.currency,
          documentDate: doc.documentDate,
          tags: JSON.parse(doc.tags || '[]'),
          notes: doc.notes,
          originalFilename: doc.originalFilename,
          storedFilename: doc.storedFilename,
          checksum: doc.checksum,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        }, null, 2);
        zip.file(`${filename}.vaulty.json`, sidecarData);
      } catch (err: any) {
        errors.push(`Failed to read file for ${doc.title}: ${err.message}`);
      }
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="vaulty-export-${new Date().toISOString().split('T')[0]}.zip"`,
      'Content-Length': zipBuffer.length,
    });

    res.send(zipBuffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/csv', (req, res) => {
  try {
    const docs = db.prepare('SELECT * FROM documents ORDER BY createdAt DESC').all() as any[];
    
    const headers = [
      'id', 'title', 'description', 'category', 'documentType',
      'amount', 'currency', 'documentDate',
      'tags', 'notes', 'originalFilename', 'storedFilename',
      'filePath', 'checksum', 'fileSize', 'createdAt', 'updatedAt', 'favorite', 'archived'
    ];
    
    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    
    const rows = docs.map(doc => {
      return headers.map(header => {
        let value = doc[header];
        if (header === 'tags') {
          try {
            value = JSON.parse(value || '[]').join('; ');
          } catch {
            value = '';
          }
        }
        return escapeCSV(value);
      }).join(',');
    });
    
    const csv = [headers.join(','), ...rows].join('\n');
    
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="vaulty-index-${new Date().toISOString().split('T')[0]}.csv"`,
    });
    
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

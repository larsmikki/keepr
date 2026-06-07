import express from 'express';
import multer from 'multer';
import db, { saveDb } from '../db/database.js';
import path from 'path';
import fs from 'fs/promises';
import { saveDocument, extractAndStoreText } from '../services/documentService.js';
import { parseTags } from '../utils/fileUtils.js';

const router = express.Router();
const upload = multer({ dest: path.join(process.cwd(), 'temp') });
const decodeUploadName = (name: string) =>
  /[ÃÂâ]/.test(name) ? Buffer.from(name, 'latin1').toString('utf8') : name;

// ─── List documents ───────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  try {
    const hasPagination = req.query.limit !== undefined || req.query.offset !== undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 10000, 10000);
    const offset = parseInt(req.query.offset as string) || 0;
    const search = req.query.search as string || '';
    const favorite = req.query.favorite as string || '';
    const archived = req.query.archived as string || '';
    const sortBy = req.query.sortBy as string || 'createdAt';
    const sortDir = (req.query.sortDir as string || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const dateFrom = req.query.dateFrom as string || '';
    const dateTo = req.query.dateTo as string || '';
    const tag = req.query.tag as string || '';
    const folder = req.query.folder as string || '';
    const fileSizeMin = req.query.fileSizeMin ? parseInt(req.query.fileSizeMin as string) : null;
    const fileSizeMax = req.query.fileSizeMax ? parseInt(req.query.fileSizeMax as string) : null;
    const noMetadata = req.query.noMetadata === 'true';

    const allowedSortFields = ['createdAt', 'updatedAt', 'documentDate', 'title', 'fileSize'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const conditions: string[] = [];
    const params: any[] = [];

    if (search) {
      conditions.push('(title LIKE ? OR tags LIKE ? OR notes LIKE ? OR description LIKE ?)');
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    if (favorite === 'true') conditions.push('favorite = 1');
    else if (favorite === 'false') conditions.push('favorite = 0');
    if (archived === 'true') conditions.push('archived = 1');
    else if (archived === 'false') conditions.push('archived = 0');
    if (dateFrom) { conditions.push('documentDate >= ?'); params.push(dateFrom); }
    if (dateTo) { conditions.push('documentDate <= ?'); params.push(dateTo); }
    if (tag) { conditions.push('tags LIKE ?'); params.push(`%${tag}%`); }
    if (folder) { conditions.push('folder = ?'); params.push(folder); }
    if (fileSizeMin !== null) { conditions.push('fileSize >= ?'); params.push(fileSizeMin); }
    if (fileSizeMax !== null) { conditions.push('fileSize <= ?'); params.push(fileSizeMax); }
    if (noMetadata) conditions.push('(tags IS NULL OR tags = "" OR tags = "[]")');

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const docs = db.prepare(
      `SELECT * FROM documents ${whereClause} ORDER BY ${safeSortBy} ${sortDir} LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    if (hasPagination) {
      const total = (db.prepare(`SELECT COUNT(*) as total FROM documents ${whereClause}`).get(...params) as any)?.total || 0;
      res.json({ documents: docs, total, limit, offset });
    } else {
      res.json(docs);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Tags — single SQL aggregation ───────────────────────────────────────────

router.get('/tags', (req, res) => {
  try {
    const rows = db.prepare(
      'SELECT tags FROM documents WHERE tags IS NOT NULL AND tags != "" AND tags != "[]"'
    ).all() as { tags: string }[];
    const tagSet = new Set<string>();
    for (const row of rows) parseTags(row.tags).forEach(t => tagSet.add(t));
    res.json(Array.from(tagSet).sort());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Folders ──────────────────────────────────────────────────────────────────

router.get('/folders', (req, res) => {
  try {
    const rows = db.prepare(
      'SELECT DISTINCT folder FROM documents WHERE folder IS NOT NULL AND folder != "" ORDER BY folder'
    ).all() as { folder: string }[];
    res.json(rows.map(r => r.folder));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Activity — SQL GROUP BY instead of JS aggregation ───────────────────────

router.get('/activity', (req, res) => {
  try {
    const months = Math.min(parseInt(req.query.months as string) || 12, 120);
    const rows = db.prepare(`
      SELECT
        strftime('%Y-%m', createdAt) AS month,
        COUNT(*) AS count,
        SUM(COALESCE(fileSize, 0)) AS totalSize
      FROM documents
      WHERE createdAt IS NOT NULL
        AND createdAt >= date('now', ? || ' months')
      GROUP BY month
      ORDER BY month ASC
    `).all(`-${months}`) as { month: string; count: number; totalSize: number }[];

    // Fill gaps so the chart has a continuous x-axis
    const now = new Date();
    const filled: { month: string; count: number; totalSize: number }[] = [];
    const byMonth = new Map(rows.map(r => [r.month, r]));
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      filled.push(byMonth.get(key) ?? { month: key, count: 0, totalSize: 0 });
    }
    res.json(filled);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Duplicates ───────────────────────────────────────────────────────────────

router.get('/duplicates', (req, res) => {
  try {
    const groups = db.prepare(`
      SELECT checksum, COUNT(*) as count, GROUP_CONCAT(id) as ids
      FROM documents
      WHERE checksum IS NOT NULL AND checksum != ''
      GROUP BY checksum
      HAVING count > 1
    `).all() as { checksum: string; count: number; ids: string }[];

    const result: Record<string, any[]> = {};
    for (const g of groups) {
      const ids = g.ids.split(',');
      const docs = db.prepare(
        `SELECT * FROM documents WHERE id IN (${ids.map(() => '?').join(',')})`
      ).all(...ids);
      const label = `${g.checksum.split(':')[1]?.substring(0, 8) ?? g.checksum} (${g.count} files)`;
      result[label] = docs;
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Check missing files ──────────────────────────────────────────────────────

router.get('/check-missing', async (req, res) => {
  try {
    const docs = db.prepare('SELECT id, title, filePath, sidecarPath FROM documents').all() as any[];
    const missing: any[] = [];
    const orphanedSidecars: any[] = [];

    for (const doc of docs) {
      try { await fs.access(doc.filePath); } catch {
        missing.push({ id: doc.id, title: doc.title, filePath: doc.filePath });
      }
      if (doc.sidecarPath) {
        try { await fs.access(doc.sidecarPath); } catch {
          orphanedSidecars.push({ id: doc.id, title: doc.title, sidecarPath: doc.sidecarPath });
        }
      }
    }
    res.json({ missing, orphanedSidecars });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Single document ──────────────────────────────────────────────────────────

router.get('/:id', (req, res) => {
  try {
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json(doc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Serve file ───────────────────────────────────────────────────────────────

router.get('/file/:id', (req, res) => {
  try {
    const doc = db.prepare('SELECT filePath, storedFilename FROM documents WHERE id = ?').get(req.params.id) as any;
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.sendFile(doc.filePath, err => {
      if (err && !res.headersSent) res.status(500).json({ error: 'Could not serve file' });
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Upload ───────────────────────────────────────────────────────────────────

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const metadata = JSON.parse(req.body.metadata || '{}');
    const result = await saveDocument(req.file, metadata);
    if (result.duplicate) {
      return res.status(409).json({ error: 'Document already exists', existingDocumentId: result.documentId });
    }
    res.json({ documentId: result.documentId, filePath: result.filePath });
    // Fire-and-forget background OCR/extraction
    extractAndStoreText(result.documentId).catch(() => {});
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/upload-batch', upload.array('files'), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

    const metadata = JSON.parse(req.body.metadata || '{}');
    const fileLastModified = JSON.parse(req.body.fileLastModified || '[]') as number[];
    const results = [];

    for (let idx = 0; idx < files.length; idx++) {
      const file = files[idx];
      try {
        const fileMetadata = {
          ...metadata,
          title: (metadata.title?.trim()) ? metadata.title : decodeUploadName(file.originalname).replace(/\.[^/.]+$/, ''),
        };
        const result = await saveDocument(file, fileMetadata, fileLastModified[idx]);
        results.push({ documentId: result.documentId, filePath: result.filePath, filename: file.originalname, duplicate: result.duplicate, existingDocumentId: result.documentId });
        if (!result.duplicate) extractAndStoreText(result.documentId).catch(() => {});
      } catch (err: any) {
        results.push({ documentId: '', filePath: '', filename: file.originalname, error: err.message });
      }
    }
    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Re-extract text / OCR ───────────────────────────────────────────────────

router.post('/:id/reextract', async (req, res) => {
  try {
    const doc = db.prepare('SELECT id FROM documents WHERE id = ?').get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json({ success: true, message: 'Text extraction started in background' });
    extractAndStoreText(req.params.id).catch(() => {});
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Delete ───────────────────────────────────────────────────────────────────

router.delete('/:id', async (req, res) => {
  try {
    const doc = db.prepare('SELECT filePath, sidecarPath FROM documents WHERE id = ?').get(req.params.id) as any;
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (doc.filePath) try { await fs.unlink(doc.filePath); } catch {}
    if (doc.sidecarPath) try { await fs.unlink(doc.sidecarPath); } catch {}
    db.prepare('DELETE FROM documents WHERE id = ?').run([req.params.id]);
    try { db.prepare('DELETE FROM documents_fts WHERE document_id = ?').run([req.params.id]); } catch {}
    saveDb();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

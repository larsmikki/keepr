import express from 'express';
import multer from 'multer';
import db, { saveDb } from '../db/database.js';
import path from 'path';
import fs from 'fs/promises';
import { saveDocument } from '../services/documentService.js';

const router = express.Router();
const upload = multer({ dest: path.join(process.cwd(), 'temp') });
const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const decodeUploadName = (name: string) =>
  /[ÃÂâ]/.test(name) ? Buffer.from(name, 'latin1').toString('utf8') : name;

router.get('/', (req, res) => {
  try {
    const hasPagination = req.query.limit !== undefined || req.query.offset !== undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 10000, 10000);
    const offset = parseInt(req.query.offset as string) || 0;
    const search = req.query.search as string || '';
    const category = req.query.category as string || '';
    const documentType = req.query.documentType as string || '';
    const favorite = req.query.favorite as string || '';
    const archived = req.query.archived as string || '';
    const sortBy = req.query.sortBy as string || 'createdAt';
    const sortDir = (req.query.sortDir as string || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const dateFrom = req.query.dateFrom as string || '';
    const dateTo = req.query.dateTo as string || '';
    const tag = req.query.tag as string || '';
    const amountMin = req.query.amountMin ? parseFloat(req.query.amountMin as string) : null;
    const amountMax = req.query.amountMax ? parseFloat(req.query.amountMax as string) : null;
    const currency = req.query.currency as string || '';
    const fileSizeMin = req.query.fileSizeMin ? parseInt(req.query.fileSizeMin as string) : null;
    const fileSizeMax = req.query.fileSizeMax ? parseInt(req.query.fileSizeMax as string) : null;
    const noMetadata = req.query.noMetadata === 'true';

    const allowedSortFields = ['createdAt', 'updatedAt', 'documentDate', 'title', 'category', 'documentType', 'amount', 'fileSize'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    let whereClause = '';
    const params: any[] = [];
    const conditions: string[] = [];

    if (search) {
      conditions.push('(title LIKE ? OR category LIKE ? OR documentType LIKE ? OR tags LIKE ? OR notes LIKE ? OR description LIKE ?)');
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }
    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }
    if (documentType) {
      conditions.push('documentType = ?');
      params.push(documentType);
    }
    if (favorite === 'true') {
      conditions.push('favorite = 1');
    } else if (favorite === 'false') {
      conditions.push('favorite = 0');
    }
    if (archived === 'true') {
      conditions.push('archived = 1');
    } else if (archived === 'false') {
      conditions.push('archived = 0');
    }
    if (dateFrom) {
      conditions.push('documentDate >= ?');
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push('documentDate <= ?');
      params.push(dateTo);
    }
    if (tag) {
      conditions.push('tags LIKE ?');
      params.push(`%${tag}%`);
    }
    if (amountMin !== null) {
      conditions.push('amount >= ?');
      params.push(amountMin);
    }
    if (amountMax !== null) {
      conditions.push('amount <= ?');
      params.push(amountMax);
    }
    if (currency) {
      conditions.push('currency = ?');
      params.push(currency);
    }
    if (fileSizeMin !== null) {
      conditions.push('fileSize >= ?');
      params.push(fileSizeMin);
    }
    if (fileSizeMax !== null) {
      conditions.push('fileSize <= ?');
      params.push(fileSizeMax);
    }
    if (noMetadata) {
      conditions.push('(category IS NULL OR category = "" OR documentType IS NULL OR documentType = "")');
    }

    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }

    const docs = db.prepare(`SELECT * FROM documents ${whereClause} ORDER BY ${safeSortBy} ${sortDir} LIMIT ? OFFSET ?`).all(...params, limit, offset);

    if (hasPagination) {
      const countStmt = db.prepare(`SELECT COUNT(*) as total FROM documents ${whereClause}`);
      const total = (countStmt.get(...params) as any)?.total || 0;
      res.json({ documents: docs, total, limit, offset });
    } else {
      res.json(docs);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tags', (req, res) => {
  try {
    const docs = db.prepare('SELECT tags FROM documents WHERE tags IS NOT NULL AND tags != ""').all() as any[];
    const tagSet = new Set<string>();
    for (const doc of docs) {
      try {
        const arr = JSON.parse(doc.tags);
        if (Array.isArray(arr)) {
          arr.forEach((t: string) => tagSet.add(t));
        }
      } catch {}
    }
    const tags = Array.from(tagSet).sort();
    res.json(tags);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/types', (req, res) => {
  try {
    const docs = db.prepare('SELECT documentType FROM documents WHERE documentType IS NOT NULL AND documentType != ""').all() as any[];
    const typeSet = new Set<string>();
    for (const doc of docs) {
      typeSet.add(doc.documentType);
    }
    const types = Array.from(typeSet).sort();
    res.json(types);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/activity', (req, res) => {
  try {
    const months = parseInt(req.query.months as string) || 12;
    const now = new Date();

    const docs = db.prepare(`
      SELECT id, createdAt, fileSize FROM documents
      WHERE createdAt IS NOT NULL AND createdAt != ''
      ORDER BY createdAt DESC
    `).all() as any[];

    const latestCreatedAt = docs
      .map(doc => new Date(String(doc.createdAt).replace(' ', 'T')))
      .filter(date => !Number.isNaN(date.getTime()))
      .sort((a, b) => b.getTime() - a.getTime())[0];
    const endDate = latestCreatedAt && latestCreatedAt > now ? latestCreatedAt : now;
    const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - months + 1, 1);
    const startStr = `${monthKey(startDate)}-01`;

    const activityByMonth: Record<string, { count: number; totalSize: number }> = {};
    
    for (let i = 0; i < months; i++) {
      const d = new Date(endDate.getFullYear(), endDate.getMonth() - i, 1);
      const key = monthKey(d);
      activityByMonth[key] = { count: 0, totalSize: 0 };
    }

    for (const doc of docs) {
      if (doc.createdAt && doc.createdAt >= startStr) {
        const monthKey = doc.createdAt.slice(0, 7);
        if (activityByMonth[monthKey]) {
          activityByMonth[monthKey].count++;
          activityByMonth[monthKey].totalSize += doc.fileSize || 0;
        }
      }
    }

    const result = Object.entries(activityByMonth)
      .map(([month, data]) => ({
        month,
        count: data.count,
        totalSize: data.totalSize,
      }))
      .reverse();

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/duplicates', (req, res) => {
  try {
    const duplicates = db.prepare(`
      SELECT checksum, COUNT(*) as count, GROUP_CONCAT(id) as ids
      FROM documents
      WHERE checksum IS NOT NULL AND checksum != ''
      GROUP BY checksum
      HAVING count > 1
    `).all() as any[];

    const result: Record<string, any[]> = {};
    for (const group of duplicates) {
      const ids = group.ids.split(',');
      const docs = db.prepare(`SELECT * FROM documents WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids) as any[];
      const checksumLabel = group.checksum.split(':')[1]?.substring(0, 8) || group.checksum;
      result[`${checksumLabel} (${group.count} files)`] = docs;
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json(doc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/file/:id', (req, res) => {
  try {
    const doc = db.prepare('SELECT filePath, storedFilename FROM documents WHERE id = ?').get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    res.sendFile(doc.filePath, (err) => {
      if (err) {
        console.error(`Error sending file ${doc.filePath}:`, err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Could not serve file' });
        }
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/check-missing', async (req, res) => {
  try {
    const docs = db.prepare('SELECT id, title, filePath, sidecarPath FROM documents').all() as any[];
    const missing: any[] = [];
    const orphanedSidecars: any[] = [];

    for (const doc of docs) {
      try {
        await fs.access(doc.filePath);
      } catch {
        missing.push({ id: doc.id, title: doc.title, filePath: doc.filePath });
      }

      if (doc.sidecarPath) {
        try {
          await fs.access(doc.sidecarPath);
        } catch {
          orphanedSidecars.push({ id: doc.id, title: doc.title, sidecarPath: doc.sidecarPath });
        }
      }
    }

    res.json({ missing, orphanedSidecars });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const metadata = JSON.parse(req.body.metadata || '{}');
    
    const result = await saveDocument(req.file, metadata);
    
    if (result.duplicate) {
      return res.status(409).json({ 
        error: 'Document already exists',
        existingDocumentId: result.documentId 
      });
    }

    res.json({ documentId: result.documentId, filePath: result.filePath });
  } catch (err: any) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/upload-batch', upload.array('files'), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const metadata = JSON.parse(req.body.metadata || '{}');
    const results = [];

    for (const file of files) {
      try {
        const fileMetadata = {
          ...metadata,
          title: (metadata.title && metadata.title.trim()) ? metadata.title : decodeUploadName(file.originalname).replace(/\.[^/.]+$/, ''),
        };
        const result = await saveDocument(file, fileMetadata);
        results.push({
          documentId: result.documentId,
          filePath: result.filePath,
          filename: file.originalname,
          duplicate: result.duplicate,
          existingDocumentId: result.documentId,
        });
      } catch (err: any) {
        results.push({
          documentId: '',
          filePath: '',
          filename: file.originalname,
          error: err.message,
        });
      }
    }

    res.json({ results });
  } catch (err: any) {
    console.error('Batch upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const doc = db.prepare('SELECT filePath, sidecarPath FROM documents WHERE id = ?').get(req.params.id) as any;
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    if (doc.filePath) {
      try { await fs.unlink(doc.filePath); } catch {}
    }
    if (doc.sidecarPath) {
      try { await fs.unlink(doc.sidecarPath); } catch {}
    }

    db.prepare('DELETE FROM documents WHERE id = ?').run([req.params.id]);
    saveDb();

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

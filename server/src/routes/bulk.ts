import express from 'express';
import { z } from 'zod';
import db from '../db/database.js';
import { saveDb } from '../db/database.js';
import fs from 'fs/promises';
import { buildSidecar } from '../utils/sidecarUtils.js';
import { syncDocumentFts } from '../services/documentService.js';

const router = express.Router();

const BulkIdsSchema = z.object({
  ids: z.array(z.string()).min(1),
});

const BulkUpdateSchema = z.object({
  ids: z.array(z.string()).min(1),
  updates: z.object({
    title:        z.string().min(1).max(500).optional(),
    description:  z.string().max(5000).optional(),
    documentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    tags:         z.union([z.string().max(2000), z.array(z.string().max(100))]).optional(),
    notes:        z.string().max(10000).optional(),
    folder:       z.string().max(200).optional().nullable(),
  }).strict(),
});

router.delete('/', async (req, res) => {
  try {
    const parsed = BulkIdsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'A list of document IDs is required' });
    const { ids } = parsed.data;

    const placeholders = ids.map(() => '?').join(',');
    const docs = db.prepare(
      `SELECT id, filePath, sidecarPath FROM documents WHERE id IN (${placeholders})`
    ).all(ids) as any[];

    for (const doc of docs) {
      try { await fs.unlink(doc.filePath).catch(() => {}); } catch {}
      try { await fs.unlink(doc.sidecarPath).catch(() => {}); } catch {}
    }

    db.prepare(`DELETE FROM documents WHERE id IN (${placeholders})`).run(ids);
    try { db.prepare(`DELETE FROM documents_fts WHERE document_id IN (${placeholders})`).run(ids); } catch {}
    saveDb();

    res.json({ success: true, deletedCount: ids.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/', async (req, res) => {
  try {
    const parsed = BulkUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map(i => i.message).join('; ') });
    }
    const { ids, updates } = parsed.data;

    const allowedFields = ['title', 'description', 'documentDate', 'tags', 'notes', 'folder'];
    const filteredKeys = Object.keys(updates).filter(k => allowedFields.includes(k));

    if (filteredKeys.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    const setClause = filteredKeys.map(f => `${f} = ?`).join(', ');
    const values = filteredKeys.map(f => {
      const val = (updates as any)[f];
      return Array.isArray(val) ? JSON.stringify(val) : val;
    });

    const stmt = db.prepare(
      `UPDATE documents SET ${setClause}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`
    );
    const transaction = db.transaction((idsToUpdate: string[]) => {
      for (const id of idsToUpdate) stmt.run(...values, id);
    });
    transaction(ids);

    // Sync sidecars
    const docs = db.prepare(
      `SELECT * FROM documents WHERE id IN (${ids.map(() => '?').join(',')})`
    ).all(ids) as any[];

    for (const doc of docs) {
      if (doc.sidecarPath) {
        await fs.writeFile(doc.sidecarPath, JSON.stringify(buildSidecar(doc), null, 2));
      }
      syncDocumentFts(doc.id);
    }

    saveDb();
    res.json({ success: true, updatedCount: ids.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

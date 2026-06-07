import express from 'express';
import { z } from 'zod';
import db, { saveDb } from '../db/database.js';
import { suggestMetadataFromFilename } from '../utils/filenameUtils.js';
import { recordHistory } from './history.js';
import { buildSidecar } from '../utils/sidecarUtils.js';
import { syncDocumentFts } from '../services/documentService.js';

const router = express.Router();

const MetadataUpdateSchema = z.object({
  title:        z.string().min(1).max(500).optional(),
  description:  z.string().max(5000).optional(),
  documentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  tags:         z.union([z.string().max(2000), z.array(z.string().max(100))]).optional(),
  notes:        z.string().max(10000).optional(),
  favorite:     z.union([z.literal(0), z.literal(1), z.boolean()]).optional(),
  archived:     z.union([z.literal(0), z.literal(1), z.boolean()]).optional(),
  folder:       z.string().max(200).optional().nullable(),
}).strict();

router.get('/suggest', (req, res) => {
  try {
    const filename = req.query.filename as string;
    if (!filename) return res.status(400).json({ error: 'filename query parameter is required' });
    res.json(suggestMetadataFromFilename(filename));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const parsed = MetadataUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map(i => i.message).join('; ') });
    }

    const updates = parsed.data;
    const allowedFields = ['title', 'description', 'documentDate', 'tags', 'notes', 'favorite', 'archived', 'folder'];
    const filteredKeys = Object.keys(updates).filter(k => allowedFields.includes(k));

    if (filteredKeys.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    // Read current values for history recording
    const before = db.prepare(`SELECT ${filteredKeys.join(', ')} FROM documents WHERE id = ?`).get(id) as any;
    if (!before) return res.status(404).json({ error: 'Document not found' });

    const setClause = filteredKeys.map(f => `${f} = ?`).join(', ');
    const values = filteredKeys.map(f => {
      const val = (updates as any)[f];
      return Array.isArray(val) ? JSON.stringify(val) : val;
    });

    const result = db.prepare(
      `UPDATE documents SET ${setClause}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`
    ).run([...values, id]);

    if (result.changes === 0) return res.status(404).json({ error: 'Document not found' });

    // Record history entries for changed fields
    for (let i = 0; i < filteredKeys.length; i++) {
      const field = filteredKeys[i];
      recordHistory(id, field, before[field], values[i]);
    }

    // Update FTS index (preserves extractedText)
    const updated = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as any;
    syncDocumentFts(id);

    // Sync sidecar
    if (updated.sidecarPath) {
      const fsModule = await import('fs/promises');
      await fsModule.writeFile(updated.sidecarPath, JSON.stringify(buildSidecar(updated), null, 2));
    }

    saveDb();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

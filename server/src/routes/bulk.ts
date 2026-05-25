import express from 'express';
import db from '../db/database.js';
import { saveDb } from '../db/database.js';
import fs from 'fs/promises';

const router = express.Router();

router.delete('/bulk', async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'A list of document IDs is required' });
    }

    const placeholders = new Array(ids.length).fill('?');
    const docs = db.prepare(`SELECT id, filePath, sidecarPath FROM documents WHERE id IN (${placeholders.join(',')})`).all(ids) as any[];

    for (const doc of docs) {
      try {
        await fs.unlink(doc.filePath).catch(() => {});
        await fs.unlink(doc.sidecarPath).catch(() => {});
      } catch {}
    }

    db.prepare(`DELETE FROM documents WHERE id IN (${placeholders.join(',')})`).run(ids);
    saveDb();

    res.json({ success: true, deletedCount: ids.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/bulk', async (req, res) => {
  try {
    const { ids, updates } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'A list of document IDs is required' });
    }

    const allowedFields = [
      'title', 'description', 'category', 'documentType',
      'amount', 'currency', 'documentDate',
      'tags', 'notes'
    ];

    const filteredUpdates = Object.keys(updates || {}).filter(key => allowedFields.includes(key));

    if (filteredUpdates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const setClause = filteredUpdates.map(field => `${field} = ?`).join(', ');
    const values = filteredUpdates.map(field => {
      const val = updates[field];
      return Array.isArray(val) ? JSON.stringify(val) : val;
    });

    const stmt = db.prepare(`UPDATE documents SET ${setClause}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`);

    // Use a transaction for efficiency and atomicity
    const transaction = db.transaction((idsToUpdate: string[]) => {
      for (const id of idsToUpdate) {
        stmt.run(...values, id);
      }
    });

    transaction(ids);

    // Update sidecars for all affected documents
    const docs = db.prepare('SELECT id, sidecarPath FROM documents WHERE id IN (' +
      new Array(ids.length).fill('?').join(',') +
      ')').all(ids) as any[];

    const fs = await import('fs/promises');
    for (const doc of docs) {
      if (doc.sidecarPath) {
        let sidecar = JSON.parse(await fs.readFile(doc.sidecarPath, 'utf8'));
        filteredUpdates.forEach(field => {
          sidecar[field] = updates[field];
        });
        sidecar.updatedAt = new Date().toISOString();
        await fs.writeFile(doc.sidecarPath, JSON.stringify(sidecar, null, 2));
      }
    }

    res.json({ success: true, updatedCount: ids.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

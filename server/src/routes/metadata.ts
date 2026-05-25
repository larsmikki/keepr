import express from 'express';
import db, { saveDb } from '../db/database.js';
import { suggestMetadataFromFilename } from '../utils/filenameUtils.js';

const router = express.Router();

router.get('/suggest', (req, res) => {
  try {
    const filename = req.query.filename as string;
    if (!filename) {
      return res.status(400).json({ error: 'filename query parameter is required' });
    }
    const suggestions = suggestMetadataFromFilename(filename);
    res.json(suggestions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = [
      'title', 'description', 'category', 'documentType',
      'amount', 'currency', 'documentDate',
      'tags', 'notes', 'favorite', 'archived'
    ];

    const filteredUpdates = Object.keys(updates).filter(key => allowedFields.includes(key));

    if (filteredUpdates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const setClause = filteredUpdates.map(field => `${field} = ?`).join(', ');
    const values = filteredUpdates.map(field => {
      const val = updates[field];
      return Array.isArray(val) ? JSON.stringify(val) : val;
    });

    const stmt = db.prepare(`UPDATE documents SET ${setClause}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`);
    const result = stmt.run([...values, id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as any;
    const sidecarPath = doc.sidecarPath;

    if (sidecarPath) {
      const fs = await import('fs/promises');
      let sidecar = JSON.parse(await fs.readFile(sidecarPath, 'utf8'));

      filteredUpdates.forEach(field => {
        sidecar[field] = updates[field];
      });

      sidecar.updatedAt = new Date().toISOString();
      await fs.writeFile(sidecarPath, JSON.stringify(sidecar, null, 2));
    }

    saveDb();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

import express from 'express';
import db from '../db/database.js';
import { saveDb } from '../db/database.js';

const router = express.Router();

// GET /api/links/:id  — list both directions
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const linked = db.prepare(`
      SELECT d.id, d.title, d.storedFilename, d.documentDate, d.fileSize
      FROM document_links l
      JOIN documents d ON (
        CASE WHEN l.from_id = ? THEN l.to_id ELSE l.from_id END = d.id
      )
      WHERE l.from_id = ? OR l.to_id = ?
    `).all(id, id, id);
    res.json(linked);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/links  — create link
router.post('/', (req, res) => {
  try {
    const { from_id, to_id } = req.body;
    if (!from_id || !to_id || from_id === to_id) {
      return res.status(400).json({ error: 'from_id and to_id are required and must differ' });
    }
    db.prepare(
      'INSERT OR IGNORE INTO document_links (from_id, to_id) VALUES (?, ?)'
    ).run(from_id, to_id);
    saveDb();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/links  — remove link
router.delete('/', (req, res) => {
  try {
    const { from_id, to_id } = req.body;
    db.prepare(
      `DELETE FROM document_links
       WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)`
    ).run(from_id, to_id, to_id, from_id);
    saveDb();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

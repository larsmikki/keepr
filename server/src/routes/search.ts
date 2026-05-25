import express from 'express';
import db from '../db/database.js';

const router = express.Router();

router.get('/search', (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const query = `%${q}%`;
    const docs = db.prepare(`
      SELECT * FROM documents
      WHERE title LIKE ?
      OR category LIKE ?
      OR tags LIKE ?
      OR description LIKE ?
      ORDER BY createdAt DESC
    `).all(query, query, query, query);

    res.json(docs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

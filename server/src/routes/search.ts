import express from 'express';
import db from '../db/database.js';

const router = express.Router();

router.get('/search', (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string' || !q.trim()) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Try FTS5 first; fall back to LIKE if the FTS table doesn't exist yet
    try {
      const ftsQuery = q.trim()
        .split(/\s+/)
        .filter(Boolean)
        .map(word => `"${word.replace(/"/g, '""')}"*`)
        .join(' ');

      const docs = db.prepare(`
        SELECT d.* FROM documents d
        WHERE d.id IN (
          SELECT document_id FROM documents_fts
          WHERE documents_fts MATCH ?
          ORDER BY rank
          LIMIT 200
        )
      `).all(ftsQuery);

      return res.json(docs);
    } catch {
      // FTS table not available — fall back to LIKE
      const likeQuery = `%${q}%`;
      const docs = db.prepare(`
        SELECT * FROM documents
        WHERE title LIKE ? OR tags LIKE ? OR description LIKE ? OR notes LIKE ?
        ORDER BY createdAt DESC
        LIMIT 200
      `).all(likeQuery, likeQuery, likeQuery, likeQuery);
      return res.json(docs);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

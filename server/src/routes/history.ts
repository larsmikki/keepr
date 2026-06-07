import express from 'express';
import db from '../db/database.js';

const router = express.Router();

router.get('/:id', (req, res) => {
  try {
    const history = db.prepare(
      `SELECT id, field, old_value, new_value, changed_at
       FROM document_history
       WHERE document_id = ?
       ORDER BY changed_at DESC
       LIMIT 200`
    ).all(req.params.id);
    res.json(history);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export function recordHistory(
  documentId: string,
  field: string,
  oldValue: unknown,
  newValue: unknown
) {
  const old = oldValue === null || oldValue === undefined ? null : String(oldValue);
  const next = newValue === null || newValue === undefined ? null : String(newValue);
  if (old === next) return;
  db.prepare(
    `INSERT INTO document_history (document_id, field, old_value, new_value)
     VALUES (?, ?, ?, ?)`
  ).run(documentId, field, old, next);
}

export default router;

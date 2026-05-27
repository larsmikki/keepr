import express from 'express';
import db, { saveDb } from '../db/database.js';

const router = express.Router();

interface FilterPreset {
  id?: number;
  name: string;
  search?: string;
  category?: string;
  documentType?: string;
  favorite?: number;
  archived?: number;
  dateFrom?: string;
  dateTo?: string;
  tag?: string;
  amountMin?: number;
  amountMax?: number;
  currency?: string;
  fileSizeMin?: number;
  fileSizeMax?: number;
  noMetadata?: number;
  sortBy?: string;
  sortDir?: string;
  createdAt?: string;
}

router.get('/', (_req, res) => {
  try {
    const presets = db.prepare('SELECT * FROM filter_presets ORDER BY name ASC').all() as FilterPreset[];
    res.json(presets.map(p => ({
      id: p.id,
      name: p.name,
      search: p.search || undefined,
      category: p.category || undefined,
      documentType: p.documentType || undefined,
      favorite: p.favorite !== undefined && p.favorite !== null ? Boolean(p.favorite) : undefined,
      archived: p.archived !== undefined && p.archived !== null ? Boolean(p.archived) : undefined,
      dateFrom: p.dateFrom || undefined,
      dateTo: p.dateTo || undefined,
      tag: p.tag || undefined,
      amountMin: p.amountMin || undefined,
      amountMax: p.amountMax || undefined,
      currency: p.currency || undefined,
      fileSizeMin: p.fileSizeMin || undefined,
      fileSizeMax: p.fileSizeMax || undefined,
      noMetadata: p.noMetadata !== undefined && p.noMetadata !== null ? Boolean(p.noMetadata) : undefined,
      sortBy: p.sortBy || undefined,
      sortDir: p.sortDir || undefined,
      createdAt: p.createdAt,
    })));
  } catch {
    res.status(500).json({ error: 'Failed to fetch filter presets' });
  }
});

router.post('/', (req, res) => {
  try {
    const preset = req.body as FilterPreset;
    if (!preset.name) {
      return res.status(400).json({ error: 'Preset name is required' });
    }

    const existing = db.prepare('SELECT id FROM filter_presets WHERE name = ?').get(preset.name);
    if (existing) {
      return res.status(409).json({ error: 'Preset with this name already exists' });
    }

    const stmt = db.prepare(`
      INSERT INTO filter_presets (
        name, search, category, documentType, favorite, archived,
        dateFrom, dateTo, tag, amountMin, amountMax, currency,
        fileSizeMin, fileSizeMax, noMetadata,
        sortBy, sortDir
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      preset.name,
      preset.search || null,
      preset.category || null,
      preset.documentType || null,
      preset.favorite !== undefined ? (preset.favorite ? 1 : 0) : null,
      preset.archived !== undefined ? (preset.archived ? 1 : 0) : null,
      preset.dateFrom || null,
      preset.dateTo || null,
      preset.tag || null,
      preset.amountMin || null,
      preset.amountMax || null,
      preset.currency || null,
      preset.fileSizeMin || null,
      preset.fileSizeMax || null,
      preset.noMetadata !== undefined ? (preset.noMetadata ? 1 : 0) : null,
      preset.sortBy || null,
      preset.sortDir || null
    );

    saveDb();

    const saved = db.prepare('SELECT * FROM filter_presets WHERE name = ?').get(preset.name) as FilterPreset;
    res.status(201).json({ id: saved.id, name: saved.name });
  } catch {
    res.status(500).json({ error: 'Failed to save filter preset' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid preset ID' });
    }

    const result = db.prepare('DELETE FROM filter_presets WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    saveDb();
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete filter preset' });
  }
});

export default router;

import express from 'express';
import fs from 'fs';
import path from 'path';
import db, { saveDb } from '../db/database.js';
import { config } from '../config.js';

const router = express.Router();

const SETTINGS_KEYS = new Set([
  'ai_provider',
  'ai_model',
  'ai_api_key',
  'ai_base_url',
  'ai_ollama_url',
  'folder_organization',
]);

router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.key === 'ai_api_key' && row.value ? '***' : row.value;
  }
  res.json(settings);
});

router.put('/', (req, res) => {
  const updates = req.body as Record<string, string>;
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

  for (const [key, value] of Object.entries(updates)) {
    if (!SETTINGS_KEYS.has(key)) continue;
    if (key === 'ai_api_key') {
      const current = db.prepare("SELECT value FROM settings WHERE key = 'ai_api_key'").get() as { value: string } | undefined;
      const hasExistingKey = !!(current?.value && current.value.trim());
      const nextValue = String(value ?? '').trim();

      if (nextValue === '***' || (hasExistingKey && !nextValue)) continue;
    }
    stmt.run(key, String(value ?? ''));
  }

  saveDb();

  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.key === 'ai_api_key' && row.value ? '***' : row.value;
  }
  res.json(settings);
});

router.get('/storage-stats', (_req, res) => {
  try {
    const docs = db.prepare('SELECT id, category, documentType, fileSize FROM documents').all() as Array<{ id: string; category: string | null; documentType: string | null; fileSize: number | null }>;

    let totalSize = 0;
    const byCategory: Record<string, { count: number; size: number }> = {};
    const byType: Record<string, { count: number; size: number }> = {};

    for (const doc of docs) {
      const size = doc.fileSize || 0;
      totalSize += size;

      const cat = doc.category || 'Uncategorized';
      if (!byCategory[cat]) byCategory[cat] = { count: 0, size: 0 };
      byCategory[cat].count++;
      byCategory[cat].size += size;

      const type = doc.documentType || 'Unknown';
      if (!byType[type]) byType[type] = { count: 0, size: 0 };
      byType[type].count++;
      byType[type].size += size;
    }

    const vaultPath = config.vaultRoot;
    let diskUsage = { used: 0, free: 0, total: 0 };
    try {
      const documentsPath = path.join(vaultPath, 'documents');
      if (fs.existsSync(documentsPath)) {
        const size = getDirectorySize(documentsPath);
        diskUsage = { used: size, free: 0, total: size };
      }
    } catch {
      // Ignore disk usage errors
    }

    res.json({
      totalDocuments: docs.length,
      totalSize,
      byCategory: Object.entries(byCategory)
        .map(([category, data]) => ({ category, ...data }))
        .sort((a, b) => b.size - a.size),
      byType: Object.entries(byType)
        .map(([documentType, data]) => ({ documentType, ...data }))
        .sort((a, b) => b.size - a.size),
      diskUsage,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get storage stats' });
  }
});

function getDirectorySize(dirPath: string): number {
  let size = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        size += getDirectorySize(fullPath);
      } else {
        try {
          const stat = fs.statSync(fullPath);
          size += stat.size;
        } catch {
          // Ignore inaccessible files
        }
      }
    }
  } catch {
    // Ignore inaccessible directories
  }
  return size;
}

export default router;

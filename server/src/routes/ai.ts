import express from 'express';
import { listLocalModels, suggestDocumentMetadata, testAiConnection } from '../services/aiService.js';

const router = express.Router();

router.post('/bulk-suggest-metadata', async (req, res) => {
  try {
    const { documentIds } = req.body;
    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      res.status(400).json({ error: 'documentIds array is required' });
      return;
    }
    if (documentIds.length > 20) {
      res.status(400).json({ error: 'Maximum 20 documents per batch' });
      return;
    }
    const results: Array<{ id: string; success: boolean; suggestion?: any; error?: string }> = [];
    for (const id of documentIds) {
      try {
        const suggestion = await suggestDocumentMetadata(id);
        results.push({ id, success: true, suggestion });
      } catch (err: any) {
        results.push({ id, success: false, error: err.message });
      }
    }
    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Bulk AI request failed' });
  }
});

router.post('/documents/:id/suggest-metadata', async (req, res) => {
  try {
    const suggestion = await suggestDocumentMetadata(req.params.id);
    res.json(suggestion);
  } catch (err: any) {
    const message = err instanceof Error ? err.message : 'AI request failed';
    const status = message === 'Document not found' ? 404 : 500;
    res.status(status).json({ error: message });
  }
});

router.get('/local-models', async (req, res) => {
  try {
    const ollamaUrl = typeof req.query.url === 'string' ? req.query.url : undefined;
    const models = await listLocalModels(ollamaUrl);
    res.json({ models });
  } catch (err: any) {
    res.json({ models: [], error: err.message || String(err) });
  }
});

router.get('/test', async (_req, res) => {
  try {
    res.json(await testAiConnection());
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

export default router;

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import documentRoutes from './routes/documents.js';
import rescanRoutes from './routes/rescan.js';
import metadataRoutes from './routes/metadata.js';
import bulkRoutes from './routes/bulk.js';
import searchRoutes from './routes/search.js';
import previewRoutes from './routes/preview.js';
import importRoutes from './routes/import.js';
import exportRoutes from './routes/export.js';
import aiRoutes from './routes/ai.js';
import settingsRoutes from './routes/settings.js';
import filterPresetsRoutes from './routes/filterPresets.js';
import historyRoutes from './routes/history.js';
import linksRoutes from './routes/links.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  const isProduction = process.env.NODE_ENV === 'production';

  app.use(compression());
  app.use(cors());
  app.use(morgan('dev'));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/config', (_req, res) => {
    res.json({ vaultRoot: config.vaultRoot, port: config.port });
  });

  app.use('/api/documents', documentRoutes);
  app.use('/api/rescan', rescanRoutes);
  app.use('/api/metadata', metadataRoutes);
  app.use('/api/bulk', bulkRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/preview', previewRoutes);
  app.use('/api/import', importRoutes);
  app.use('/api/export', exportRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/filter-presets', filterPresetsRoutes);
  app.use('/api/history', historyRoutes);
  app.use('/api/links', linksRoutes);

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[server] Unhandled Express error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  if (isProduction) {
    const clientDist = path.join(__dirname, '../../client/dist');
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  return app;
}

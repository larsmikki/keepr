import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs/promises';
import { initDb } from '../src/db/database.js';
import { runMigrations } from '../src/db/migrate.js';
import documentRoutes from '../src/routes/documents.js';
import searchRoutes from '../src/routes/search.js';
import bulkRoutes from '../src/routes/bulk.js';
import metadataRoutes from '../src/routes/metadata.js';
import rescanRoutes from '../src/routes/rescan.js';
import importRoutes from '../src/routes/import.js';
import exportRoutes from '../src/routes/export.js';

describe('Documents API', () => {
  let app: express.Application;
  const tempFile = path.join(process.cwd(), 'temp', 'test-crud.txt');
  let docId: string;

  beforeAll(async () => {
    await initDb();
    runMigrations();

    app = express();
    app.use(cors());
    app.use(express.json());
    app.use('/api/documents', documentRoutes);
    app.use('/api/search', searchRoutes);
    app.use('/api/bulk', bulkRoutes);
    app.use('/api/metadata', metadataRoutes);
    app.use('/api/rescan', rescanRoutes);
    app.use('/api/import', importRoutes);
    app.use('/api/export', exportRoutes);

    await fs.mkdir(path.dirname(tempFile), { recursive: true });
    await fs.writeFile(tempFile, 'CRUD lifecycle test content');
  });

  afterAll(async () => {
    await fs.unlink(tempFile).catch(() => {});
  });

  it('rejects upload without a file', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .field('metadata', JSON.stringify({ title: 'Test' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent document', async () => {
    const res = await request(app).get('/api/documents/non-existent-id');
    expect(res.status).toBe(404);
  });

  it('returns 404 when patching non-existent document', async () => {
    const res = await request(app)
      .patch('/api/metadata/non-existent-id')
      .send({ title: 'Test' });
    expect(res.status).toBe(404);
  });

  it('CREATE: uploads a document', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .attach('file', tempFile)
      .field('metadata', JSON.stringify({
        title: 'CRUD Test',
        category: 'Other',
        documentType: 'Record',
        documentDate: '2026-05-10',
      }));

    expect(res.status).toBe(200);
    expect(res.body.documentId).toBeDefined();
    docId = res.body.documentId;
  });

  it('READ: retrieves the uploaded document', async () => {
    const res = await request(app).get(`/api/documents/${docId}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('CRUD Test');
    expect(res.body.category).toBe('Other');
  });

  it('UPDATE: patches metadata', async () => {
    const updateRes = await request(app)
      .patch(`/api/metadata/${docId}`)
      .send({ title: 'Updated Title', category: 'Finance' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);

    const getRes = await request(app).get(`/api/documents/${docId}`);
    expect(getRes.body.title).toBe('Updated Title');
    expect(getRes.body.category).toBe('Finance');
  });

  it('DELETE: removes the document', async () => {
    const res = await request(app).delete(`/api/documents/${docId}`);
    expect(res.status).toBe(200);

    const getRes = await request(app).get(`/api/documents/${docId}`);
    expect(getRes.status).toBe(404);
  });
});

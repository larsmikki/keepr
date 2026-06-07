CREATE TABLE IF NOT EXISTS documents_new (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  documentType TEXT,
  documentDate TEXT,
  fileModifiedDate TEXT,
  tags TEXT,
  notes TEXT,
  originalFilename TEXT,
  storedFilename TEXT,
  filePath TEXT NOT NULL,
  sidecarPath TEXT,
  checksum TEXT,
  fileSize INTEGER,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
  favorite INTEGER DEFAULT 0
);

INSERT OR IGNORE INTO documents_new (
  id, title, description, category, documentType,
  documentDate, fileModifiedDate, tags, notes, originalFilename, storedFilename, filePath,
  sidecarPath, checksum, fileSize, createdAt, updatedAt, favorite
)
SELECT
  id, title, description, category, documentType,
  documentDate, fileModifiedDate, tags, notes, originalFilename, storedFilename, filePath,
  sidecarPath, checksum, fileSize, createdAt, updatedAt,
  COALESCE(favorite, 0)
FROM documents;

DROP TABLE documents;
ALTER TABLE documents_new RENAME TO documents;

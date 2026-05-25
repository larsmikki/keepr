CREATE TABLE IF NOT EXISTS documents_new (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  documentType TEXT,
  amount REAL,
  currency TEXT,
  documentDate TEXT,
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
  favorite INTEGER DEFAULT 0,
  archived INTEGER DEFAULT 0
);

INSERT OR IGNORE INTO documents_new (
  id, title, description, category, documentType, amount, currency,
  documentDate, tags, notes, originalFilename, storedFilename, filePath,
  sidecarPath, checksum, fileSize, createdAt, updatedAt, favorite, archived
)
SELECT
  id, title, description, category, documentType, amount, currency,
  documentDate, tags, notes, originalFilename, storedFilename, filePath,
  sidecarPath, checksum, fileSize, createdAt, updatedAt,
  COALESCE(favorite, 0), COALESCE(archived, 0)
FROM documents;

DROP TABLE documents;
ALTER TABLE documents_new RENAME TO documents;
DROP TABLE IF EXISTS people;
DROP TABLE IF EXISTS assets;

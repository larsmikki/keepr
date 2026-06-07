-- Recreate documents table without category and documentType columns
CREATE TABLE IF NOT EXISTS documents_new (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
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
  id, title, description,
  documentDate, fileModifiedDate, tags, notes, originalFilename, storedFilename, filePath,
  sidecarPath, checksum, fileSize, createdAt, updatedAt, favorite
)
SELECT
  id, title, description,
  documentDate, fileModifiedDate, tags, notes, originalFilename, storedFilename, filePath,
  sidecarPath, checksum, fileSize, createdAt, updatedAt,
  COALESCE(favorite, 0)
FROM documents;

DROP TABLE documents;
ALTER TABLE documents_new RENAME TO documents;

DROP INDEX IF EXISTS idx_documents_category;
DROP INDEX IF EXISTS idx_documents_category_title;

-- Recreate filter_presets table without category and documentType columns
CREATE TABLE IF NOT EXISTS filter_presets_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  search TEXT,
  favorite INTEGER,
  archived INTEGER,
  dateFrom TEXT,
  dateTo TEXT,
  tag TEXT,
  fileSizeMin INTEGER,
  fileSizeMax INTEGER,
  noMetadata INTEGER,
  sortBy TEXT,
  sortDir TEXT,
  createdAt TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO filter_presets_new (
  id, name, search, favorite, archived,
  dateFrom, dateTo, tag,
  fileSizeMin, fileSizeMax, noMetadata, sortBy, sortDir, createdAt
)
SELECT
  id, name, search, favorite, archived,
  dateFrom, dateTo, tag,
  fileSizeMin, fileSizeMax, noMetadata, sortBy, sortDir, createdAt
FROM filter_presets;

DROP TABLE filter_presets;
ALTER TABLE filter_presets_new RENAME TO filter_presets;

CREATE INDEX IF NOT EXISTS idx_filter_presets_name ON filter_presets(name);

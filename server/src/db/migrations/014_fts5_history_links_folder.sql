-- FTS5 virtual table for full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
  document_id UNINDEXED,
  title,
  description,
  notes,
  tags,
  tokenize='porter ascii'
);

-- Populate FTS index from existing documents
INSERT OR IGNORE INTO documents_fts (document_id, title, description, notes, tags)
SELECT
  id,
  COALESCE(title, ''),
  COALESCE(description, ''),
  COALESCE(notes, ''),
  COALESCE(tags, '')
FROM documents;

-- Audit trail for metadata changes
CREATE TABLE IF NOT EXISTS document_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id TEXT    NOT NULL,
  changed_at  TEXT    DEFAULT CURRENT_TIMESTAMP,
  field       TEXT    NOT NULL,
  old_value   TEXT,
  new_value   TEXT
);

CREATE INDEX IF NOT EXISTS idx_history_document_id ON document_history(document_id);

-- Document-to-document links
CREATE TABLE IF NOT EXISTS document_links (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id    TEXT NOT NULL,
  to_id      TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(from_id, to_id)
);

CREATE INDEX IF NOT EXISTS idx_links_from ON document_links(from_id);
CREATE INDEX IF NOT EXISTS idx_links_to   ON document_links(to_id);

-- Logical folder / project grouping
ALTER TABLE documents ADD COLUMN folder TEXT;

CREATE TABLE IF NOT EXISTS filter_presets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  search TEXT,
  category TEXT,
  documentType TEXT,
  favorite INTEGER,
  archived INTEGER,
  dateFrom TEXT,
  dateTo TEXT,
  tag TEXT,
  amountMin REAL,
  amountMax REAL,
  currency TEXT,
  fileSizeMin INTEGER,
  fileSizeMax INTEGER,
  noMetadata INTEGER,
  sortBy TEXT,
  sortDir TEXT,
  createdAt TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_filter_presets_name ON filter_presets(name);

CREATE TABLE IF NOT EXISTS documents (
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
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  name TEXT PRIMARY KEY
);

INSERT OR IGNORE INTO categories (name) VALUES
  ('Identity'), ('Family'), ('Housing'), ('Utilities'), ('Finance'),
  ('Employment'), ('Insurance'), ('Health'), ('Vehicles'), ('Purchases'),
  ('Education'), ('Tax'), ('Legal'), ('Government'), ('Travel'), ('Other');

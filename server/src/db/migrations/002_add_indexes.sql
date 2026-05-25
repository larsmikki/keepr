CREATE INDEX IF NOT EXISTS idx_documents_title ON documents(title);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_checksum ON documents(checksum);
CREATE INDEX IF NOT EXISTS idx_documents_filePath ON documents(filePath);
CREATE INDEX IF NOT EXISTS idx_documents_createdAt ON documents(createdAt);
CREATE INDEX IF NOT EXISTS idx_documents_documentDate ON documents(documentDate);
CREATE INDEX IF NOT EXISTS idx_documents_category_title ON documents(category, title);

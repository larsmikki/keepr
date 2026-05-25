ALTER TABLE documents ADD COLUMN archived INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_documents_archived ON documents(archived);
-- Add column for OCR / extracted text results
ALTER TABLE documents ADD COLUMN extractedText TEXT;

-- Rebuild FTS5 table to include extracted_text
-- (FTS5 virtual tables don't support ALTER TABLE ADD COLUMN)
DROP TABLE IF EXISTS documents_fts;

CREATE VIRTUAL TABLE documents_fts USING fts5(
  document_id UNINDEXED,
  title,
  description,
  notes,
  tags,
  extracted_text,
  tokenize='porter ascii'
);

INSERT INTO documents_fts (document_id, title, description, notes, tags, extracted_text)
SELECT
  id,
  COALESCE(title, ''),
  COALESCE(description, ''),
  COALESCE(notes, ''),
  COALESCE(tags, ''),
  COALESCE(extractedText, '')
FROM documents;

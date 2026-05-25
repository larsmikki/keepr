CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('ai_provider', 'openai'),
  ('ai_model', 'gpt-4o-mini'),
  ('ai_api_key', ''),
  ('ai_base_url', 'https://api.openai.com/v1'),
  ('ai_ollama_url', 'http://localhost:11434');

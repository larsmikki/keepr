INSERT OR IGNORE INTO categories (name) VALUES
  ('Utilities'),
  ('Government');

DELETE FROM categories WHERE name IN ('Warranties', 'Manuals');

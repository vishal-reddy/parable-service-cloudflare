-- FTS5 virtual table for full-text search on puritan works
CREATE VIRTUAL TABLE IF NOT EXISTS puritan_works_fts USING fts5(
  title,
  content,
  content='puritan_works',
  content_rowid='rowid'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS puritan_works_ai AFTER INSERT ON puritan_works BEGIN
  INSERT INTO puritan_works_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
END;

CREATE TRIGGER IF NOT EXISTS puritan_works_ad AFTER DELETE ON puritan_works BEGIN
  INSERT INTO puritan_works_fts(puritan_works_fts, rowid, title, content) VALUES('delete', old.rowid, old.title, old.content);
END;

CREATE TRIGGER IF NOT EXISTS puritan_works_au AFTER UPDATE ON puritan_works BEGIN
  INSERT INTO puritan_works_fts(puritan_works_fts, rowid, title, content) VALUES('delete', old.rowid, old.title, old.content);
  INSERT INTO puritan_works_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
END;

-- Enable foreign keys
PRAGMA foreign_keys = ON;

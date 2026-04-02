-- Seed data for parable-service-cloudflare (D1/SQLite)
-- Run with: wrangler d1 execute parable-db --local --file=scripts/seed.sql

PRAGMA foreign_keys = ON;

-- ─── Sample Stories ────────────────────────────────────────────────────────

INSERT OR IGNORE INTO stories (id, title, description, created_at, updated_at) VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001', 'Jalaal''s Tax', 'A young tax collector in ancient Mesopotamia discovers that the empire''s greatest treasure is not gold, but mercy.', datetime('now'), datetime('now')),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'Victorian Holiday', 'A family of modest means in 1880s London navigates the social pressures of the Christmas season.', datetime('now'), datetime('now'));

-- Acts for Jalaal's Tax
INSERT OR IGNORE INTO acts (id, story_id, title, description, type, position) VALUES
  ('b1b2c3d4-0001-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000001', 'The Commission', 'Jalaal receives his posting as tax collector.', 'first', 0),
  ('b1b2c3d4-0002-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000001', 'The Reckoning', 'Jalaal confronts the cost of his role.', 'second', 1),
  ('b1b2c3d4-0003-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000001', 'The Mercy', 'Jalaal chooses a different path.', 'third', 2);

-- Beats for Act 1
INSERT OR IGNORE INTO beats (id, act_id, description, type, position) VALUES
  ('c1b2c3d4-0001-4000-8000-000000000001', 'b1b2c3d4-0001-4000-8000-000000000001', 'Jalaal arrives at the provincial capital, awed by its grandeur.', 'opening-hook', 0),
  ('c1b2c3d4-0002-4000-8000-000000000001', 'b1b2c3d4-0001-4000-8000-000000000001', 'He is assigned to collect taxes from the poorest district.', 'inciting-incident', 1);

-- Characters for Jalaal's Tax
INSERT OR IGNORE INTO characters (id, story_id, name, age, gender, build, height, temperament_major, temperament_minor) VALUES
  ('d1b2c3d4-0001-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000001', 'Jalaal', 24, 'male', 'slim', 'average', 'melancholic', 'choleric'),
  ('d1b2c3d4-0002-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000001', 'Miriam', 45, 'female', 'average', 'short', 'phlegmatic', 'sanguine');

-- Locations for Jalaal's Tax
INSERT OR IGNORE INTO locations (id, story_id, title, resemblance) VALUES
  ('e1b2c3d4-0001-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000001', 'Provincial Capital', 'Ancient Nineveh with towering ziggurats'),
  ('e1b2c3d4-0002-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000001', 'The Poor Quarter', 'Dusty narrow streets with clay brick homes');

-- Acts for Victorian Holiday
INSERT OR IGNORE INTO acts (id, story_id, title, description, type, position) VALUES
  ('b1b2c3d4-0004-4000-8000-000000000002', 'a1b2c3d4-0002-4000-8000-000000000002', 'Preparations', 'The family prepares for the holiday season.', 'first', 0),
  ('b1b2c3d4-0005-4000-8000-000000000002', 'a1b2c3d4-0002-4000-8000-000000000002', 'The Invitation', 'An unexpected invitation changes everything.', 'second', 1);

-- Characters for Victorian Holiday
INSERT OR IGNORE INTO characters (id, story_id, name, age, gender, build, height, temperament_major, temperament_minor) VALUES
  ('d1b2c3d4-0003-4000-8000-000000000002', 'a1b2c3d4-0002-4000-8000-000000000002', 'Eleanor', 34, 'female', 'slim', 'tall', 'sanguine', 'melancholic'),
  ('d1b2c3d4-0004-4000-8000-000000000002', 'a1b2c3d4-0002-4000-8000-000000000002', 'Thomas', 38, 'male', 'average', 'average', 'choleric', 'phlegmatic');

-- ─── Sample Puritan Authors & Works ────────────────────────────────────────

INSERT OR IGNORE INTO puritan_authors (id, name, years, created_at) VALUES
  ('f1b2c3d4-0001-4000-8000-000000000001', 'John Bunyan', '1628-1688', datetime('now')),
  ('f1b2c3d4-0002-4000-8000-000000000002', 'Thomas Watson', '1620-1686', datetime('now')),
  ('f1b2c3d4-0003-4000-8000-000000000003', 'John Owen', '1616-1683', datetime('now'));

INSERT OR IGNORE INTO puritan_works (id, author_id, title, content, file_path, created_at) VALUES
  ('g1b2c3d4-0001-4000-8000-000000000001', 'f1b2c3d4-0001-4000-8000-000000000001', 'The Pilgrim''s Progress (Excerpt)', 'As I walked through the wilderness of this world, I lighted on a certain place where was a Den, and I laid me down in that place to sleep; and, as I slept, I dreamed a dream. I dreamed, and behold, I saw a man clothed with rags, standing in a certain place, with his face from his own house, a book in his hand, and a great burden upon his back.', 'bunyan/pilgrims_progress.md', datetime('now')),
  ('g1b2c3d4-0002-4000-8000-000000000002', 'f1b2c3d4-0002-4000-8000-000000000002', 'The Doctrine of Repentance (Excerpt)', 'Repentance is a grace of God''s Spirit whereby a sinner is inwardly humbled and visibly reformed. For a further amplification, know that repentance is a spiritual medicine made up of six special ingredients.', 'watson/doctrine_repentance.md', datetime('now')),
  ('g1b2c3d4-0003-4000-8000-000000000003', 'f1b2c3d4-0003-4000-8000-000000000003', 'The Mortification of Sin (Excerpt)', 'Do you mortify; do you make it your daily work; be always at it whilst you live; cease not a day from this work; be killing sin or it will be killing you.', 'owen/mortification_of_sin.md', datetime('now'));

-- ─── Sample Search Tokens ──────────────────────────────────────────────────

INSERT OR IGNORE INTO search_tokens (id, token, source_key, created_at) VALUES
  ('h1b2c3d4-0001-4000-8000-000000000001', 'Scripture', 'lbc2_chapter_1_scripture', datetime('now')),
  ('h1b2c3d4-0002-4000-8000-000000000002', 'God and the Holy Trinity', 'lbc2_chapter_2_god_trinity', datetime('now')),
  ('h1b2c3d4-0003-4000-8000-000000000003', 'Repentance unto Life and Salvation', 'lbc2_chapter_15_repentance', datetime('now')),
  ('h1b2c3d4-0004-4000-8000-000000000004', 'Sanctification', 'lbc2_chapter_13_sanctification', datetime('now')),
  ('h1b2c3d4-0005-4000-8000-000000000005', 'Sin and Its Punishment', 'lbc2_chapter_6_sin', datetime('now'));

-- ─── Sample Work-Token Mappings ────────────────────────────────────────────

INSERT OR IGNORE INTO puritan_work_tokens (id, work_id, token_id, match_count, snippet, created_at) VALUES
  ('i1b2c3d4-0001-4000-8000-000000000001', 'g1b2c3d4-0002-4000-8000-000000000002', 'h1b2c3d4-0003-4000-8000-000000000003', 12, '...Repentance is a grace of God''s Spirit whereby a sinner is inwardly humbled...', datetime('now')),
  ('i1b2c3d4-0002-4000-8000-000000000002', 'g1b2c3d4-0003-4000-8000-000000000003', 'h1b2c3d4-0004-4000-8000-000000000004', 8, '...do you mortify; do you make it your daily work...', datetime('now')),
  ('i1b2c3d4-0003-4000-8000-000000000003', 'g1b2c3d4-0003-4000-8000-000000000003', 'h1b2c3d4-0005-4000-8000-000000000005', 5, '...be killing sin or it will be killing you...', datetime('now'));

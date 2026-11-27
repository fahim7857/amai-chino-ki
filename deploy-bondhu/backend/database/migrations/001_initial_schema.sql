-- Migration 001: Initial Schema for Who Knows Me Better?
-- SQLite-compatible DDL with strict constraints and foreign keys.

PRAGMA foreign_keys = ON;

-- Table 1: users (Local application-level user references mapped to external/Supabase UUID)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supabase_user_id TEXT UNIQUE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Supporting profile cache & username uniqueness lookup (no passwords stored here)
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) >= 1 AND length(name) <= 80),
  username TEXT UNIQUE NOT NULL CHECK (length(username) >= 3 AND length(username) <= 24),
  created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Local auth fallback credentials (only used when external Supabase Auth env vars are not configured; stores salted scrypt hash, never plaintext)
CREATE TABLE IF NOT EXISTS auth_identities (
  user_id INTEGER PRIMARY KEY,
  internal_alias TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table 2: quizzes
CREATE TABLE IF NOT EXISTS quizzes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) >= 1 AND length(title) <= 120),
  slug TEXT UNIQUE NOT NULL CHECK (length(trim(slug)) >= 3 AND length(slug) <= 64),
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  current_version_id INTEGER,
  created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table 3: quiz_versions
CREATE TABLE IF NOT EXISTS quiz_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quiz_id INTEGER NOT NULL,
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (quiz_id, version_number),
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

-- Table 4: questions
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quiz_version_id INTEGER NOT NULL,
  question_text TEXT NOT NULL CHECK (length(trim(question_text)) >= 1 AND length(question_text) <= 280),
  category TEXT DEFAULT 'Custom',
  question_order INTEGER NOT NULL CHECK (question_order >= 1),
  created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (quiz_version_id) REFERENCES quiz_versions(id) ON DELETE CASCADE
);

-- Table 5: answer_options
CREATE TABLE IF NOT EXISTS answer_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL,
  option_text TEXT NOT NULL CHECK (length(trim(option_text)) >= 1 AND length(option_text) <= 140),
  is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
  option_order INTEGER NOT NULL CHECK (option_order >= 1 AND option_order <= 5),
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

-- Table 6: quiz_submissions
CREATE TABLE IF NOT EXISTS quiz_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quiz_id INTEGER NOT NULL,
  quiz_version_id INTEGER NOT NULL,
  participant_user_id INTEGER NOT NULL,
  total_questions INTEGER NOT NULL CHECK (total_questions >= 1),
  correct_answers INTEGER NOT NULL CHECK (correct_answers >= 0 AND correct_answers <= total_questions),
  match_percentage REAL NOT NULL CHECK (match_percentage >= 0.0 AND match_percentage <= 100.0),
  submitted_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (quiz_id, participant_user_id),
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
  FOREIGN KEY (quiz_version_id) REFERENCES quiz_versions(id) ON DELETE RESTRICT,
  FOREIGN KEY (participant_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table 7: submitted_answers
CREATE TABLE IF NOT EXISTS submitted_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  selected_option_id INTEGER NOT NULL,
  is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
  UNIQUE (submission_id, question_id),
  FOREIGN KEY (submission_id) REFERENCES quiz_submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  FOREIGN KEY (selected_option_id) REFERENCES answer_options(id) ON DELETE CASCADE
);

-- Table 8: user_settings
CREATE TABLE IF NOT EXISTS user_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL,
  leaderboard_visibility TEXT NOT NULL DEFAULT 'public' CHECK (leaderboard_visibility IN ('public', 'private')),
  created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

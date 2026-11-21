-- Complete Executable SQLite Schema for Who Knows Me Better?
-- Combines schema tables, constraints, indexes, and triggers.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supabase_user_id TEXT UNIQUE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) >= 1 AND length(name) <= 80),
  username TEXT UNIQUE NOT NULL CHECK (length(username) >= 3 AND length(username) <= 24),
  created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth_identities (
  user_id INTEGER PRIMARY KEY,
  internal_alias TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

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

CREATE TABLE IF NOT EXISTS quiz_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quiz_id INTEGER NOT NULL,
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (quiz_id, version_number),
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quiz_version_id INTEGER NOT NULL,
  question_text TEXT NOT NULL CHECK (length(trim(question_text)) >= 1 AND length(question_text) <= 280),
  category TEXT DEFAULT 'Custom',
  question_order INTEGER NOT NULL CHECK (question_order >= 1),
  created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (quiz_version_id) REFERENCES quiz_versions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS answer_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL,
  option_text TEXT NOT NULL CHECK (length(trim(option_text)) >= 1 AND length(option_text) <= 140),
  is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
  option_order INTEGER NOT NULL CHECK (option_order >= 1 AND option_order <= 5),
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

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

CREATE TABLE IF NOT EXISTS user_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL,
  leaderboard_visibility TEXT NOT NULL DEFAULT 'public' CHECK (leaderboard_visibility IN ('public', 'private')),
  created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);
CREATE INDEX IF NOT EXISTS idx_quizzes_user_id ON quizzes(user_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_slug ON quizzes(slug);
CREATE INDEX IF NOT EXISTS idx_quizzes_status ON quizzes(status);
CREATE INDEX IF NOT EXISTS idx_quiz_versions_quiz_id ON quiz_versions(quiz_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_questions_version_order ON questions(quiz_version_id, question_order ASC);
CREATE INDEX IF NOT EXISTS idx_answer_options_question_order ON answer_options(question_id, option_order ASC);
CREATE INDEX IF NOT EXISTS idx_submissions_leaderboard ON quiz_submissions(quiz_id, match_percentage DESC, correct_answers DESC, submitted_at ASC);
CREATE INDEX IF NOT EXISTS idx_submissions_participant ON quiz_submissions(participant_user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_submitted_answers_submission ON submitted_answers(submission_id);

CREATE TRIGGER IF NOT EXISTS trg_answer_options_max_five
BEFORE INSERT ON answer_options
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN (SELECT COUNT(*) FROM answer_options WHERE question_id = NEW.question_id) >= 5
    THEN RAISE(ABORT, 'A question cannot have more than 5 answer options')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_answer_options_single_correct_insert
BEFORE INSERT ON answer_options
FOR EACH ROW
WHEN NEW.is_correct = 1
BEGIN
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM answer_options WHERE question_id = NEW.question_id AND is_correct = 1)
    THEN RAISE(ABORT, 'A question can have only one correct answer option')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_answer_options_single_correct_update
BEFORE UPDATE OF is_correct ON answer_options
FOR EACH ROW
WHEN NEW.is_correct = 1 AND OLD.is_correct = 0
BEGIN
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM answer_options WHERE question_id = NEW.question_id AND is_correct = 1 AND id != NEW.id)
    THEN RAISE(ABORT, 'A question can have only one correct answer option')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_questions_immutable_published_update
BEFORE UPDATE ON questions
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN (SELECT status FROM quiz_versions WHERE id = OLD.quiz_version_id) = 'published'
    THEN RAISE(ABORT, 'Cannot modify questions of a published quiz version; create a new version instead')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_questions_immutable_published_delete
BEFORE DELETE ON questions
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN (SELECT status FROM quiz_versions WHERE id = OLD.quiz_version_id) = 'published'
    THEN RAISE(ABORT, 'Cannot delete questions from a published quiz version; create a new version instead')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_quiz_version_publish_validate
BEFORE UPDATE OF status ON quiz_versions
FOR EACH ROW
WHEN NEW.status = 'published'
BEGIN
  SELECT CASE
    WHEN (SELECT COUNT(*) FROM questions WHERE quiz_version_id = NEW.id) < 1
    THEN RAISE(ABORT, 'Cannot publish a quiz version with zero questions')
  END;
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM questions q
      WHERE q.quiz_version_id = NEW.id
      AND (
        (SELECT COUNT(*) FROM answer_options ao WHERE ao.question_id = q.id) < 4
        OR (SELECT COUNT(*) FROM answer_options ao WHERE ao.question_id = q.id) > 5
        OR (SELECT COUNT(*) FROM answer_options ao WHERE ao.question_id = q.id AND ao.is_correct = 1) != 1
      )
    )
    THEN RAISE(ABORT, 'Every question in a published quiz version must have 4 or 5 options and exactly 1 correct answer')
  END;
END;

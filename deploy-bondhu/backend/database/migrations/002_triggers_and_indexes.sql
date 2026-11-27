-- Migration 002: Indexes and Integrity Triggers for Who Knows Me Better?

-- Indexes for fast lookups and deterministic leaderboard sorting
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

-- Trigger 1: Enforce maximum 5 options per question
CREATE TRIGGER IF NOT EXISTS trg_answer_options_max_five
BEFORE INSERT ON answer_options
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN (SELECT COUNT(*) FROM answer_options WHERE question_id = NEW.question_id) >= 5
    THEN RAISE(ABORT, 'A question cannot have more than 5 answer options')
  END;
END;

-- Trigger 2: Enforce at most one correct answer option per question on INSERT
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

-- Trigger 3: Enforce at most one correct answer option per question on UPDATE
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

-- Trigger 4: Prevent mutating questions inside an already published quiz version
CREATE TRIGGER IF NOT EXISTS trg_questions_immutable_published_update
BEFORE UPDATE ON questions
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN (SELECT status FROM quiz_versions WHERE id = OLD.quiz_version_id) = 'published'
    THEN RAISE(ABORT, 'Cannot modify questions of a published quiz version; create a new version instead')
  END;
END;

-- Trigger 5: Prevent deleting questions from an already published quiz version
CREATE TRIGGER IF NOT EXISTS trg_questions_immutable_published_delete
BEFORE DELETE ON questions
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN (SELECT status FROM quiz_versions WHERE id = OLD.quiz_version_id) = 'published'
    THEN RAISE(ABORT, 'Cannot delete questions from a published quiz version; create a new version instead')
  END;
END;

-- Trigger 6: Prevent publishing a quiz version if any question does not have 4-5 options or exactly 1 correct option
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

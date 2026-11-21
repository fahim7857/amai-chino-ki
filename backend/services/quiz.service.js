import { AppError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { slugify, validateQuestionPayload } from '../utils/validators.js';

function generateUniqueSlug(db, baseSlug) {
  const clean = slugify(baseSlug);
  const existing = db.prepare('SELECT id FROM quizzes WHERE slug = ?').get(clean);
  if (!existing) {
    return clean;
  }
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${clean}-${i}`;
    if (!db.prepare('SELECT id FROM quizzes WHERE slug = ?').get(candidate)) {
      return candidate;
    }
  }
  return `${clean}-${Date.now()}`;
}

function loadVersionQuestions(db, versionId, includeCorrect) {
  const questions = db
    .prepare(
      `SELECT id, question_text, COALESCE(category, 'Custom') as category, question_order
       FROM questions
       WHERE quiz_version_id = ?
       ORDER BY question_order ASC, id ASC`
    )
    .all(versionId);

  if (questions.length === 0) {
    return [];
  }

  const optionStmt = includeCorrect
    ? db.prepare(
        `SELECT id, option_text, is_correct, option_order
         FROM answer_options
         WHERE question_id = ?
         ORDER BY option_order ASC, id ASC`
      )
    : db.prepare(
        `SELECT id, option_text, option_order
         FROM answer_options
         WHERE question_id = ?
         ORDER BY option_order ASC, id ASC`
      );

  return questions.map((q) => {
    const rawOptions = optionStmt.all(q.id);
    return {
      id: q.id,
      question_text: q.question_text,
      category: q.category,
      question_order: q.question_order,
      options: rawOptions.map((opt) => {
        if (includeCorrect) {
          return {
            id: opt.id,
            option_text: opt.option_text,
            option_order: opt.option_order,
            is_correct: opt.is_correct,
          };
        }
        return {
          id: opt.id,
          option_text: opt.option_text,
          option_order: opt.option_order,
        };
      }),
    };
  });
}

function getLatestEditableVersion(db, quizId) {
  const draft = db
    .prepare(
      `SELECT id, version_number, status
       FROM quiz_versions
       WHERE quiz_id = ? AND status = 'draft'
       ORDER BY version_number DESC
       LIMIT 1`
    )
    .get(quizId);

  if (draft) {
    return draft;
  }

  const latest = db
    .prepare(
      `SELECT id, version_number, status
       FROM quiz_versions
       WHERE quiz_id = ?
       ORDER BY version_number DESC
       LIMIT 1`
    )
    .get(quizId);

  if (!latest) {
    throw new NotFoundError('Quiz version not found');
  }
  return latest;
}

function ensureEditableDraftVersion(db, quizId) {
  const latest = getLatestEditableVersion(db, quizId);
  if (latest.status === 'draft') {
    return latest.id;
  }

  const nextVersionNumber = latest.version_number + 1;
  const newVersionRes = db
    .prepare(
      `INSERT INTO quiz_versions (quiz_id, version_number, status)
       VALUES (?, ?, 'draft')`
    )
    .run(quizId, nextVersionNumber);
  const newVersionId = Number(newVersionRes.lastInsertRowid);

  const existingQuestions = loadVersionQuestions(db, latest.id, true);
  const insertQuestion = db.prepare(
    `INSERT INTO questions (quiz_version_id, question_text, category, question_order)
     VALUES (?, ?, ?, ?)`
  );
  const insertOption = db.prepare(
    `INSERT INTO answer_options (question_id, option_text, is_correct, option_order)
     VALUES (?, ?, ?, ?)`
  );

  for (const q of existingQuestions) {
    const qRes = insertQuestion.run(newVersionId, q.question_text, q.category, q.question_order);
    const newQuestionId = Number(qRes.lastInsertRowid);
    for (const opt of q.options) {
      insertOption.run(newQuestionId, opt.option_text, opt.is_correct ?? 0, opt.option_order);
    }
  }

  return newVersionId;
}

export function createQuiz(db, userId, username, input) {
  const rawTitle = typeof input.title === 'string' ? input.title.trim() : '';
  if (rawTitle.length < 1 || rawTitle.length > 120) {
    throw new AppError('Quiz title must be between 1 and 120 characters.', 400, 'INVALID_TITLE');
  }
  const description =
    typeof input.description === 'string' ? input.description.trim().slice(0, 400) : '';
  const requestedSlug =
    typeof input.slug === 'string' && input.slug.trim() ? input.slug.trim() : username;
  const slug = generateUniqueSlug(db, requestedSlug);

  const quizId = db.transaction(() => {
    const quizRes = db
      .prepare(
        `INSERT INTO quizzes (user_id, title, slug, description, status)
         VALUES (?, ?, ?, ?, 'draft')`
      )
      .run(userId, rawTitle, slug, description);
    const createdQuizId = Number(quizRes.lastInsertRowid);

    const verRes = db
      .prepare(
        `INSERT INTO quiz_versions (quiz_id, version_number, status)
         VALUES (?, 1, 'draft')`
      )
      .run(createdQuizId);
    const versionId = Number(verRes.lastInsertRowid);

    db.prepare('UPDATE quizzes SET current_version_id = ? WHERE id = ?').run(
      versionId,
      createdQuizId
    );

    return createdQuizId;
  })();

  return getQuizForOwner(db, quizId, userId);
}

export function getMyQuizzes(db, userId) {
  const rows = db
    .prepare('SELECT id FROM quizzes WHERE user_id = ? ORDER BY updated_at DESC, id DESC')
    .all(userId);

  return rows.map((r) => getQuizForOwner(db, r.id, userId));
}

export function getQuizForOwner(db, quizId, userId) {
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(quizId);

  if (!quiz) {
    throw new NotFoundError('Quiz not found.');
  }
  if (quiz.user_id !== userId) {
    throw new ForbiddenError('You do not own this quiz.');
  }

  const editableVersion = getLatestEditableVersion(db, quiz.id);
  const questions = loadVersionQuestions(db, editableVersion.id, true);
  const participantCountRow = db
    .prepare('SELECT COUNT(*) as cnt FROM quiz_submissions WHERE quiz_id = ?')
    .get(quiz.id);

  const hasUnpublishedChanges =
    quiz.status === 'published' && editableVersion.status === 'draft';

  return {
    id: quiz.id,
    user_id: quiz.user_id,
    title: quiz.title,
    slug: quiz.slug,
    description: quiz.description || '',
    status: quiz.status,
    current_version_id: quiz.current_version_id,
    active_version_id: editableVersion.id,
    active_version_number: editableVersion.version_number,
    active_version_status: editableVersion.status,
    has_unpublished_changes: hasUnpublishedChanges,
    question_count: questions.length,
    participant_count: participantCountRow.cnt,
    created_at: quiz.created_at,
    updated_at: quiz.updated_at,
    questions,
  };
}

export function updateQuizMetadata(db, quizId, userId, input) {
  const existing = getQuizForOwner(db, quizId, userId);

  const title =
    typeof input.title === 'string' && input.title.trim()
      ? input.title.trim()
      : existing.title;
  if (title.length < 1 || title.length > 120) {
    throw new AppError('Quiz title must be between 1 and 120 characters.', 400, 'INVALID_TITLE');
  }
  const description =
    typeof input.description === 'string'
      ? input.description.trim().slice(0, 400)
      : existing.description;

  db.prepare(
    `UPDATE quizzes
     SET title = ?, description = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ? AND user_id = ?`
  ).run(title, description, quizId, userId);

  return getQuizForOwner(db, quizId, userId);
}

export function deleteQuiz(db, quizId, userId) {
  const quiz = db.prepare('SELECT id, user_id FROM quizzes WHERE id = ?').get(quizId);
  if (!quiz) {
    throw new NotFoundError('Quiz not found.');
  }
  if (quiz.user_id !== userId) {
    throw new ForbiddenError('You do not own this quiz.');
  }

  db.transaction(() => {
    db.prepare('DELETE FROM quiz_submissions WHERE quiz_id = ?').run(quizId);
    db.prepare('DELETE FROM quizzes WHERE id = ?').run(quizId);
  })();
}

export function addQuestionToQuiz(db, quizId, userId, body) {
  getQuizForOwner(db, quizId, userId);
  const validated = validateQuestionPayload(body);

  db.transaction(() => {
    const draftVersionId = ensureEditableDraftVersion(db, quizId);
    const maxOrderRow = db
      .prepare('SELECT COALESCE(MAX(question_order), 0) as max_order FROM questions WHERE quiz_version_id = ?')
      .get(draftVersionId);
    const nextOrder = maxOrderRow.max_order + 1;

    const qRes = db
      .prepare(
        `INSERT INTO questions (quiz_version_id, question_text, category, question_order)
         VALUES (?, ?, ?, ?)`
      )
      .run(draftVersionId, validated.question_text, validated.category, nextOrder);
    const questionId = Number(qRes.lastInsertRowid);

    const optStmt = db.prepare(
      `INSERT INTO answer_options (question_id, option_text, is_correct, option_order)
       VALUES (?, ?, ?, ?)`
    );
    for (const opt of validated.options) {
      optStmt.run(questionId, opt.option_text, opt.is_correct, opt.option_order);
    }

    db.prepare("UPDATE quizzes SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(
      quizId
    );
  })();

  return getQuizForOwner(db, quizId, userId);
}

export function updateQuestion(db, questionId, userId, body) {
  const row = db
    .prepare(
      `SELECT q.id, q.quiz_version_id, q.question_order, qv.quiz_id, qz.user_id
       FROM questions q
       JOIN quiz_versions qv ON qv.id = q.quiz_version_id
       JOIN quizzes qz ON qz.id = qv.quiz_id
       WHERE q.id = ?`
    )
    .get(questionId);

  if (!row) {
    throw new NotFoundError('Question not found.');
  }
  if (row.user_id !== userId) {
    throw new ForbiddenError('You do not own this question.');
  }

  const validated = validateQuestionPayload(body);

  db.transaction(() => {
    const editableVersionId = ensureEditableDraftVersion(db, row.quiz_id);

    let targetQuestionId = row.id;
    if (editableVersionId !== row.quiz_version_id) {
      const cloned = db
        .prepare('SELECT id FROM questions WHERE quiz_version_id = ? AND question_order = ?')
        .get(editableVersionId, row.question_order);
      if (!cloned) {
        throw new NotFoundError('Cloned draft question not found.');
      }
      targetQuestionId = cloned.id;
    }

    db.prepare(
      `UPDATE questions
       SET question_text = ?, category = ?
       WHERE id = ?`
    ).run(validated.question_text, validated.category, targetQuestionId);

    db.prepare('DELETE FROM answer_options WHERE question_id = ?').run(targetQuestionId);
    const optStmt = db.prepare(
      `INSERT INTO answer_options (question_id, option_text, is_correct, option_order)
       VALUES (?, ?, ?, ?)`
    );
    for (const opt of validated.options) {
      optStmt.run(targetQuestionId, opt.option_text, opt.is_correct, opt.option_order);
    }

    db.prepare("UPDATE quizzes SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(
      row.quiz_id
    );
  })();

  return getQuizForOwner(db, row.quiz_id, userId);
}

export function deleteQuestion(db, questionId, userId) {
  const row = db
    .prepare(
      `SELECT q.id, q.quiz_version_id, q.question_order, qv.quiz_id, qz.user_id
       FROM questions q
       JOIN quiz_versions qv ON qv.id = q.quiz_version_id
       JOIN quizzes qz ON qz.id = qv.quiz_id
       WHERE q.id = ?`
    )
    .get(questionId);

  if (!row) {
    throw new NotFoundError('Question not found.');
  }
  if (row.user_id !== userId) {
    throw new ForbiddenError('You do not own this question.');
  }

  db.transaction(() => {
    const editableVersionId = ensureEditableDraftVersion(db, row.quiz_id);
    let targetQuestionId = row.id;
    if (editableVersionId !== row.quiz_version_id) {
      const cloned = db
        .prepare('SELECT id FROM questions WHERE quiz_version_id = ? AND question_order = ?')
        .get(editableVersionId, row.question_order);
      if (!cloned) {
        throw new NotFoundError('Cloned draft question not found.');
      }
      targetQuestionId = cloned.id;
    }

    db.prepare('DELETE FROM questions WHERE id = ?').run(targetQuestionId);

    const remaining = db
      .prepare('SELECT id FROM questions WHERE quiz_version_id = ? ORDER BY question_order ASC, id ASC')
      .all(editableVersionId);
    const updateOrder = db.prepare('UPDATE questions SET question_order = ? WHERE id = ?');
    remaining.forEach((q, idx) => {
      updateOrder.run(idx + 1, q.id);
    });

    db.prepare("UPDATE quizzes SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(
      row.quiz_id
    );
  })();

  return getQuizForOwner(db, row.quiz_id, userId);
}

export function reorderQuestions(db, quizId, userId, orderedQuestionIds) {
  getQuizForOwner(db, quizId, userId);
  if (!Array.isArray(orderedQuestionIds) || orderedQuestionIds.length === 0) {
    throw new AppError('orderedQuestionIds must be a non-empty array.', 400, 'INVALID_ORDER');
  }

  db.transaction(() => {
    const latestBefore = getLatestEditableVersion(db, quizId);
    const originalQuestions = db
      .prepare('SELECT id, question_order FROM questions WHERE quiz_version_id = ? ORDER BY question_order ASC')
      .all(latestBefore.id);

    const editableVersionId = ensureEditableDraftVersion(db, quizId);

    let targetIds;
    if (editableVersionId !== latestBefore.id) {
      const clonedRows = db
        .prepare('SELECT id, question_order FROM questions WHERE quiz_version_id = ?')
        .all(editableVersionId);
      const orderToClonedId = new Map(clonedRows.map((r) => [r.question_order, r.id]));
      const origIdToOrder = new Map(originalQuestions.map((r) => [r.id, r.question_order]));
      targetIds = orderedQuestionIds.map((id) => {
        const order = origIdToOrder.get(Number(id));
        const mapped = order ? orderToClonedId.get(order) : undefined;
        if (!mapped) {
          throw new AppError('Invalid question ID in reorder list.', 400, 'INVALID_ORDER');
        }
        return mapped;
      });
    } else {
      targetIds = orderedQuestionIds.map((id) => Number(id));
    }

    const currentRows = db
      .prepare('SELECT id FROM questions WHERE quiz_version_id = ?')
      .all(editableVersionId);
    const currentSet = new Set(currentRows.map((r) => r.id));

    if (targetIds.length !== currentSet.size || targetIds.some((id) => !currentSet.has(id))) {
      throw new AppError('Reorder list must contain every question in the quiz.', 400, 'INVALID_ORDER');
    }

    const stmt = db.prepare('UPDATE questions SET question_order = ? WHERE id = ?');
    targetIds.forEach((id, idx) => {
      stmt.run(idx + 1, id);
    });

    db.prepare("UPDATE quizzes SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(
      quizId
    );
  })();

  return getQuizForOwner(db, quizId, userId);
}

export function publishQuiz(db, quizId, userId) {
  const quiz = getQuizForOwner(db, quizId, userId);
  if (quiz.question_count < 1) {
    throw new AppError('Add at least 1 question before publishing your quiz.', 400, 'EMPTY_QUIZ');
  }

  for (const q of quiz.questions) {
    if (q.options.length < 4 || q.options.length > 5) {
      throw new AppError(
        `Question "${q.question_text}" must have 4 or 5 options.`,
        400,
        'INVALID_OPTIONS'
      );
    }
    const correctCount = q.options.filter((o) => o.is_correct === 1).length;
    if (correctCount !== 1) {
      throw new AppError(
        `Question "${q.question_text}" must have exactly 1 correct answer.`,
        400,
        'INVALID_CORRECT_OPTION'
      );
    }
  }

  db.transaction(() => {
    const editable = getLatestEditableVersion(db, quizId);
    if (editable.status === 'draft') {
      db.prepare(
        `UPDATE quiz_versions
         SET status = 'archived'
         WHERE quiz_id = ? AND status = 'published' AND id != ?`
      ).run(quizId, editable.id);

      db.prepare("UPDATE quiz_versions SET status = 'published' WHERE id = ?").run(editable.id);
      db.prepare(
        `UPDATE quizzes
         SET status = 'published',
             current_version_id = ?,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?`
      ).run(editable.id, quizId);
    } else if (quiz.status !== 'published') {
      db.prepare(
        `UPDATE quizzes
         SET status = 'published',
             current_version_id = ?,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?`
      ).run(editable.id, quizId);
    }
  })();

  return getQuizForOwner(db, quizId, userId);
}

export function resolvePublishedQuizBySlugOrUsername(db, slugOrUsername) {
  const key = slugOrUsername.trim().toLowerCase();

  let quiz = db
    .prepare(
      `SELECT q.id as quiz_id, q.user_id as owner_user_id, q.title, q.slug, q.description,
              up.name as owner_name, up.username as owner_username
       FROM quizzes q
       JOIN user_profiles up ON up.user_id = q.user_id
       WHERE q.slug = ? AND q.status = 'published'
       LIMIT 1`
    )
    .get(key);

  if (!quiz) {
    quiz = db
      .prepare(
        `SELECT q.id as quiz_id, q.user_id as owner_user_id, q.title, q.slug, q.description,
                up.name as owner_name, up.username as owner_username
         FROM quizzes q
         JOIN user_profiles up ON up.user_id = q.user_id
         WHERE up.username = ? AND q.status = 'published'
         ORDER BY q.updated_at DESC, q.id DESC
         LIMIT 1`
      )
      .get(key);
  }

  if (!quiz) {
    throw new NotFoundError('This quiz does not exist or has not been published yet.');
  }

  const publishedVersion = db
    .prepare(
      `SELECT id
       FROM quiz_versions
       WHERE quiz_id = ? AND status = 'published'
       ORDER BY version_number DESC
       LIMIT 1`
    )
    .get(quiz.quiz_id);

  if (!publishedVersion) {
    throw new NotFoundError('No published version found for this quiz.');
  }

  return {
    quizId: quiz.quiz_id,
    quizVersionId: publishedVersion.id,
    ownerUserId: quiz.owner_user_id,
    ownerName: quiz.owner_name,
    ownerUsername: quiz.owner_username,
    title: quiz.title,
    slug: quiz.slug,
    description: quiz.description || '',
  };
}

export function getPublicQuiz(db, slugOrUsername, viewerUserId) {
  const resolved = resolvePublishedQuizBySlugOrUsername(db, slugOrUsername);
  const questions = loadVersionQuestions(db, resolved.quizVersionId, false);

  let existingSubmissionId = null;
  if (viewerUserId) {
    const sub = db
      .prepare(
        'SELECT id FROM quiz_submissions WHERE quiz_id = ? AND participant_user_id = ?'
      )
      .get(resolved.quizId, viewerUserId);
    if (sub) {
      existingSubmissionId = sub.id;
    }
  }

  const participantCountRow = db
    .prepare('SELECT COUNT(*) as cnt FROM quiz_submissions WHERE quiz_id = ?')
    .get(resolved.quizId);

  return {
    id: resolved.quizId,
    quizVersionId: resolved.quizVersionId,
    title: resolved.title,
    slug: resolved.slug,
    description: resolved.description,
    owner: {
      name: resolved.ownerName,
      username: resolved.ownerUsername,
    },
    participantCount: participantCountRow.cnt,
    isOwner: viewerUserId ? resolved.ownerUserId === viewerUserId : false,
    existingSubmissionId,
    questions,
  };
}

export function getPublicUserProfile(db, rawUsername) {
  const username = rawUsername.trim().toLowerCase();
  const profile = db
    .prepare(
      `SELECT u.id, up.name, up.username, u.created_at,
              COALESCE(us.leaderboard_visibility, 'public') as leaderboard_visibility
       FROM user_profiles up
       JOIN users u ON u.id = up.user_id
       LEFT JOIN user_settings us ON us.user_id = u.id
       WHERE up.username = ?`
    )
    .get(username);

  if (!profile) {
    throw new NotFoundError('User profile not found.');
  }

  const quizzes = db
    .prepare(
      `SELECT q.id, q.title, q.slug, q.description, q.status, q.updated_at,
              (SELECT COUNT(*) FROM questions qu WHERE qu.quiz_version_id = q.current_version_id) as question_count,
              (SELECT COUNT(*) FROM quiz_submissions qs WHERE qs.quiz_id = q.id) as participant_count
       FROM quizzes q
       WHERE q.user_id = ? AND q.status = 'published'
       ORDER BY q.updated_at DESC`
    )
    .all(profile.id);

  return {
    name: profile.name,
    username: profile.username,
    createdAt: profile.created_at,
    leaderboardVisibility: profile.leaderboard_visibility,
    quizzes,
  };
}

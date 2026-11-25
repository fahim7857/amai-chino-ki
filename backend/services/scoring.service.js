import { AppError, ConflictError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { resolvePublishedQuizBySlugOrUsername } from './quiz.service.js';

export function calculateMatchPercentage(correctAnswers, totalQuestions) {
  if (totalQuestions <= 0) {
    return 0;
  }
  return Math.round((correctAnswers / totalQuestions) * 10000) / 100;
}

export function getFriendlyResultMessage(percentage, ownerFirstName) {
  if (percentage >= 90) {
    return `True bestie status! You practically share a brain with ${ownerFirstName}.`;
  }
  if (percentage >= 70) {
    return `Impressive! You really pay attention to ${ownerFirstName}'s favourites.`;
  }
  if (percentage >= 50) {
    return `Solid effort! You know ${ownerFirstName} pretty well, with a few surprises left.`;
  }
  if (percentage >= 25) {
    return `Getting there! Time to grab a coffee and catch up with ${ownerFirstName}.`;
  }
  return `Plot twist! Looks like ${ownerFirstName} still has plenty of secrets for you to discover.`;
}

export function submitQuizAnswers(db, slugOrUsername, participantUserId, rawAnswers) {
  const resolved = resolvePublishedQuizBySlugOrUsername(db, slugOrUsername);

  if (resolved.ownerUserId === participantUserId) {
    throw new ForbiddenError('You cannot submit answers to your own quiz.');
  }

  const existingSubmission = db
    .prepare('SELECT id FROM quiz_submissions WHERE quiz_id = ? AND participant_user_id = ?')
    .get(resolved.quizId, participantUserId);
  if (existingSubmission) {
    throw new ConflictError('You have already submitted answers for this quiz.');
  }

  if (!Array.isArray(rawAnswers) || rawAnswers.length === 0) {
    throw new AppError('Please answer all questions before submitting.', 400, 'INVALID_ANSWERS');
  }

  const versionQuestions = db
    .prepare('SELECT id FROM questions WHERE quiz_version_id = ? ORDER BY question_order ASC')
    .all(resolved.quizVersionId);

  if (versionQuestions.length === 0) {
    throw new AppError('This quiz has no questions.', 400, 'EMPTY_QUIZ');
  }

  const expectedQuestionIds = new Set(versionQuestions.map((q) => q.id));
  const answerMap = new Map();

  for (const item of rawAnswers) {
    if (!item || typeof item !== 'object') {
      throw new AppError('Malformed answer item.', 400, 'INVALID_ANSWERS');
    }
    const qId = Number(item.questionId);
    const optId = Number(item.selectedOptionId);
    if (!Number.isInteger(qId) || !Number.isInteger(optId)) {
      throw new AppError('Invalid question or option identifier.', 400, 'INVALID_ANSWERS');
    }
    if (!expectedQuestionIds.has(qId)) {
      throw new AppError('One or more answers do not belong to this quiz.', 400, 'INVALID_ANSWERS');
    }
    if (answerMap.has(qId)) {
      throw new AppError('Duplicate answer for the same question.', 400, 'DUPLICATE_ANSWERS');
    }
    answerMap.set(qId, optId);
  }

  if (answerMap.size !== expectedQuestionIds.size) {
    throw new AppError(
      `Please answer all ${expectedQuestionIds.size} questions before submitting.`,
      400,
      'INCOMPLETE_QUIZ'
    );
  }

  const optionLookupStmt = db.prepare(
    'SELECT id, question_id, is_correct FROM answer_options WHERE id = ? AND question_id = ?'
  );

  const evaluatedAnswers = [];
  let correctCount = 0;

  for (const [questionId, selectedOptionId] of answerMap.entries()) {
    const optionRow = optionLookupStmt.get(selectedOptionId, questionId);
    if (!optionRow) {
      throw new AppError(
        'Selected option does not belong to its corresponding question.',
        400,
        'INVALID_OPTION_MATCH'
      );
    }
    if (optionRow.is_correct === 1) {
      correctCount += 1;
    }
    evaluatedAnswers.push({
      questionId,
      selectedOptionId,
      isCorrect: optionRow.is_correct === 1 ? 1 : 0,
    });
  }

  const totalQuestions = versionQuestions.length;
  const matchPercentage = calculateMatchPercentage(correctCount, totalQuestions);

  const submissionId = db.transaction(() => {
    const subRes = db
      .prepare(
        `INSERT INTO quiz_submissions
           (quiz_id, quiz_version_id, participant_user_id, total_questions, correct_answers, match_percentage)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        resolved.quizId,
        resolved.quizVersionId,
        participantUserId,
        totalQuestions,
        correctCount,
        matchPercentage
      );
    const createdSubmissionId = Number(subRes.lastInsertRowid);

    const ansStmt = db.prepare(
      `INSERT INTO submitted_answers (submission_id, question_id, selected_option_id, is_correct)
       VALUES (?, ?, ?, ?)`
    );
    for (const ans of evaluatedAnswers) {
      ansStmt.run(createdSubmissionId, ans.questionId, ans.selectedOptionId, ans.isCorrect);
    }

    return createdSubmissionId;
  })();

  return getSubmissionResult(db, submissionId, participantUserId);
}

export function getSubmissionResult(db, submissionId, viewerUserId) {
  const row = db
    .prepare(
      `SELECT qs.id, qs.quiz_id, qs.quiz_version_id, qs.participant_user_id,
              qs.total_questions, qs.correct_answers, qs.match_percentage, qs.submitted_at,
              qz.title as quiz_title, qz.slug as quiz_slug, qz.user_id as owner_user_id,
              owner_p.name as owner_name, owner_p.username as owner_username, owner_p.avatar_url as owner_avatar_url,
              part_p.name as participant_name, part_p.username as participant_username, part_p.avatar_url as participant_avatar_url
       FROM quiz_submissions qs
       JOIN quizzes qz ON qz.id = qs.quiz_id
       JOIN user_profiles owner_p ON owner_p.user_id = qz.user_id
       JOIN user_profiles part_p ON part_p.user_id = qs.participant_user_id
       WHERE qs.id = ?`
    )
    .get(submissionId);

  if (!row) {
    throw new NotFoundError('Quiz result not found.');
  }

  if (row.participant_user_id !== viewerUserId && row.owner_user_id !== viewerUserId) {
    throw new ForbiddenError('You can only view your own quiz results.');
  }

  const ownerFirstName = row.owner_name.split(' ')[0] || row.owner_name;
  const formattedPct = Number.isInteger(row.match_percentage)
    ? `${row.match_percentage}%`
    : `${row.match_percentage.toFixed(2).replace(/\.?0+$/, '')}%`;

  return {
    submissionId: row.id,
    quizId: row.quiz_id,
    quizTitle: row.quiz_title,
    quizSlug: row.quiz_slug,
    owner: {
      name: row.owner_name,
      username: row.owner_username,
      avatarUrl: row.owner_avatar_url || null,
    },
    participant: {
      name: row.participant_name,
      username: row.participant_username,
      avatarUrl: row.participant_avatar_url || null,
    },
    totalQuestions: row.total_questions,
    correctAnswers: row.correct_answers,
    matchPercentage: row.match_percentage,
    submittedAt: row.submitted_at,
    friendlyMessage: getFriendlyResultMessage(row.match_percentage, ownerFirstName),
    shareText: `I know ${ownerFirstName} ${formattedPct}! Can you beat me?`,
  };
}

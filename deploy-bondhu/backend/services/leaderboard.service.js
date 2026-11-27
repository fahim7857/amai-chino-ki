import { ForbiddenError } from '../utils/errors.js';
import { resolvePublishedQuizBySlugOrUsername } from './quiz.service.js';

export function rankSubmissions(rows) {
  let currentRank = 0;
  let prevPct = null;
  let prevCorrect = null;

  return rows.map((row, index) => {
    if (row.match_percentage !== prevPct || row.correct_answers !== prevCorrect) {
      currentRank = index + 1;
      prevPct = row.match_percentage;
      prevCorrect = row.correct_answers;
    }

    return {
      rank: currentRank,
      submissionId: row.submission_id,
      participantName: row.participant_name,
      participantUsername: row.participant_username,
      participantAvatarUrl: row.participant_avatar_url || null,
      correctAnswers: row.correct_answers,
      totalQuestions: row.total_questions,
      matchPercentage: row.match_percentage,
      submittedAt: row.submitted_at,
    };
  });
}

export function getLeaderboardBySlug(db, slugOrUsername, viewerUserId) {
  const resolved = resolvePublishedQuizBySlugOrUsername(db, slugOrUsername);

  const settings = db
    .prepare('SELECT leaderboard_visibility FROM user_settings WHERE user_id = ?')
    .get(resolved.ownerUserId);
  const visibility = settings?.leaderboard_visibility || 'public';

  if (visibility === 'private') {
    const isOwner = viewerUserId === resolved.ownerUserId;
    const isParticipant = viewerUserId
      ? Boolean(
          db
            .prepare('SELECT id FROM quiz_submissions WHERE quiz_id = ? AND participant_user_id = ?')
            .get(resolved.quizId, viewerUserId)
        )
      : false;
    if (!isOwner && !isParticipant) {
      throw new ForbiddenError('This leaderboard is set to private by the quiz creator.');
    }
  }

  const rows = db
    .prepare(
      `SELECT qs.id as submission_id,
              up.name as participant_name,
              up.username as participant_username,
              up.avatar_url as participant_avatar_url,
              qs.correct_answers,
              qs.total_questions,
              qs.match_percentage,
              qs.submitted_at
       FROM quiz_submissions qs
       JOIN user_profiles up ON up.user_id = qs.participant_user_id
       WHERE qs.quiz_id = ?
       ORDER BY qs.match_percentage DESC, qs.correct_answers DESC, qs.submitted_at ASC`
    )
    .all(resolved.quizId);

  const entries = rankSubmissions(rows);

  return {
    quiz: {
      id: resolved.quizId,
      title: resolved.title,
      slug: resolved.slug,
      ownerName: resolved.ownerName,
      ownerUsername: resolved.ownerUsername,
      visibility,
    },
    entries,
  };
}

export function getDashboardStats(db, userId) {
  const userProfile = db
    .prepare(
      `SELECT up.name, up.username, up.avatar_url, COALESCE(us.leaderboard_visibility, 'public') as leaderboard_visibility
       FROM user_profiles up
       LEFT JOIN user_settings us ON us.user_id = up.user_id
       WHERE up.user_id = ?`
    )
    .get(userId);

  const quizzes = db
    .prepare(
      `SELECT id, title, slug, description, status, current_version_id, updated_at
       FROM quizzes
       WHERE user_id = ?
       ORDER BY CASE WHEN status = 'published' THEN 0 ELSE 1 END, updated_at DESC, id DESC`
    )
    .all(userId);

  const primaryQuiz = quizzes[0] || null;

  let totalQuestions = 0;
  let totalParticipants = 0;
  let averageMatchPercentage = 0;
  let bestFriend = null;
  let leaderboardPreview = [];
  let recentParticipants = [];

  if (primaryQuiz) {
    const editableVer = db
      .prepare(
        'SELECT id FROM quiz_versions WHERE quiz_id = ? ORDER BY version_number DESC LIMIT 1'
      )
      .get(primaryQuiz.id);

    if (editableVer) {
      const qCountRow = db
        .prepare('SELECT COUNT(*) as cnt FROM questions WHERE quiz_version_id = ?')
        .get(editableVer.id);
      totalQuestions = qCountRow.cnt;
    }

    const agg = db
      .prepare(
        `SELECT COUNT(*) as total_participants,
                COALESCE(ROUND(AVG(match_percentage), 2), 0) as avg_pct
         FROM quiz_submissions
         WHERE quiz_id = ?`
      )
      .get(primaryQuiz.id);

    totalParticipants = agg.total_participants;
    averageMatchPercentage = agg.avg_pct;

    const rankedRows = db
      .prepare(
        `SELECT qs.id as submission_id,
                up.name as participant_name,
                up.username as participant_username,
                up.avatar_url as participant_avatar_url,
                qs.correct_answers,
                qs.total_questions,
                qs.match_percentage,
                qs.submitted_at
         FROM quiz_submissions qs
         JOIN user_profiles up ON up.user_id = qs.participant_user_id
         WHERE qs.quiz_id = ?
         ORDER BY qs.match_percentage DESC, qs.correct_answers DESC, qs.submitted_at ASC`
      )
      .all(primaryQuiz.id);

    const ranked = rankSubmissions(rankedRows);
    bestFriend = ranked[0] || null;
    leaderboardPreview = ranked.slice(0, 5);

    const recentRows = db
      .prepare(
        `SELECT qs.id as submission_id,
                up.name as participant_name,
                up.username as participant_username,
                up.avatar_url as participant_avatar_url,
                qs.correct_answers,
                qs.total_questions,
                qs.match_percentage,
                qs.submitted_at
         FROM quiz_submissions qs
         JOIN user_profiles up ON up.user_id = qs.participant_user_id
         WHERE qs.quiz_id = ?
         ORDER BY qs.submitted_at DESC
         LIMIT 5`
      )
      .all(primaryQuiz.id);

    recentParticipants = recentRows.map((r) => ({
      submissionId: r.submission_id,
      participantName: r.participant_name,
      participantUsername: r.participant_username,
      participantAvatarUrl: r.participant_avatar_url || null,
      matchPercentage: r.match_percentage,
      correctAnswers: r.correct_answers,
      totalQuestions: r.total_questions,
      submittedAt: r.submitted_at,
    }));
  }

  const quizzesTaken = db
    .prepare(
      `SELECT qs.id as submission_id, qs.match_percentage, qs.correct_answers, qs.total_questions,
              qs.submitted_at, qz.title as quiz_title, qz.slug as quiz_slug,
              owner_p.name as owner_name, owner_p.username as owner_username,
              owner_p.avatar_url as owner_avatar_url
       FROM quiz_submissions qs
       JOIN quizzes qz ON qz.id = qs.quiz_id
       JOIN user_profiles owner_p ON owner_p.user_id = qz.user_id
       WHERE qs.participant_user_id = ?
       ORDER BY qs.submitted_at DESC`
    )
    .all(userId);

  return {
    user: userProfile,
    primaryQuiz,
    quizzes,
    stats: {
      totalQuestions,
      totalParticipants,
      averageMatchPercentage,
    },
    bestFriend,
    recentParticipants,
    leaderboardPreview,
    quizzesTaken,
  };
}

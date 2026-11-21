import crypto from 'crypto';
import { buildInternalAlias } from '../config/supabase.js';
import { hashPassword } from '../services/auth.service.js';

export function seedDevelopmentData(db) {
  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
  if (countRow.cnt > 0) {
    return;
  }

  const seed = db.transaction(() => {
    const demoUsers = [
      { name: 'Fahim Ahmed', username: 'fahim', pass: 'demo1234' },
      { name: 'Sara Rahman', username: 'sara', pass: 'demo1234' },
      { name: 'Rafi Hasan', username: 'rafi', pass: 'demo1234' },
      { name: 'Nadia Karim', username: 'nadia', pass: 'demo1234' },
    ];

    const userIds = new Map();

    for (const u of demoUsers) {
      const res = db
        .prepare('INSERT INTO users (supabase_user_id) VALUES (?)')
        .run(crypto.randomUUID());
      const userId = Number(res.lastInsertRowid);
      userIds.set(u.username, userId);

      db.prepare('INSERT INTO user_profiles (user_id, name, username) VALUES (?, ?, ?)').run(
        userId,
        u.name,
        u.username
      );
      db.prepare(
        'INSERT INTO auth_identities (user_id, internal_alias, password_hash) VALUES (?, ?, ?)'
      ).run(userId, buildInternalAlias(u.username), hashPassword(u.pass));
      db.prepare("INSERT INTO user_settings (user_id, leaderboard_visibility) VALUES (?, 'public')").run(
        userId
      );
    }

    const fahimId = userIds.get('fahim');
    const quizRes = db
      .prepare(
        `INSERT INTO quizzes (user_id, title, slug, description, status)
         VALUES (?, ?, ?, ?, 'published')`
      )
      .run(
        fahimId,
        'How well do you know Fahim?',
        'fahim',
        'Five quick questions about my comfort food, weekend habits, and dream getaway. Let us see who pays attention!'
      );
    const quizId = Number(quizRes.lastInsertRowid);

    const verRes = db
      .prepare(
        `INSERT INTO quiz_versions (quiz_id, version_number, status)
         VALUES (?, 1, 'draft')`
      )
      .run(quizId);
    const versionId = Number(verRes.lastInsertRowid);

    const sampleQuestions = [
      {
        text: 'What is my favourite comfort food?',
        category: 'Favourite Food',
        options: [
          { text: 'Biryani', correct: 0 },
          { text: 'Kacchi', correct: 1 },
          { text: 'Pizza', correct: 0 },
          { text: 'Burger', correct: 0 },
          { text: 'Pasta', correct: 0 },
        ],
      },
      {
        text: 'Which season makes me happiest?',
        category: 'Favourite Season',
        options: [
          { text: 'Winter', correct: 1 },
          { text: 'Summer', correct: 0 },
          { text: 'Monsoon', correct: 0 },
          { text: 'Spring', correct: 0 },
        ],
      },
      {
        text: 'What is my dream travel destination?',
        category: 'Dream Destination',
        options: [
          { text: 'Kyoto, Japan', correct: 1 },
          { text: 'Paris, France', correct: 0 },
          { text: 'Zurich, Switzerland', correct: 0 },
          { text: 'Reykjavik, Iceland', correct: 0 },
        ],
      },
      {
        text: 'What am I most likely doing on a rainy Sunday?',
        category: 'Lifestyle',
        options: [
          { text: 'Brewing chai and reading', correct: 1 },
          { text: 'Going for a 10k run', correct: 0 },
          { text: 'Cleaning out my inbox', correct: 0 },
          { text: 'Shopping at the mall', correct: 0 },
        ],
      },
      {
        text: 'Which colour do I wear most often?',
        category: 'Favourite Color',
        options: [
          { text: 'Soft Lavender', correct: 0 },
          { text: 'Sage Green', correct: 1 },
          { text: 'Warm Cream', correct: 0 },
          { text: 'Coral Peach', correct: 0 },
        ],
      },
    ];

    const questionIds = [];
    const insertQ = db.prepare(
      `INSERT INTO questions (quiz_version_id, question_text, category, question_order)
       VALUES (?, ?, ?, ?)`
    );
    const insertOpt = db.prepare(
      `INSERT INTO answer_options (question_id, option_text, is_correct, option_order)
       VALUES (?, ?, ?, ?)`
    );

    sampleQuestions.forEach((q, qIdx) => {
      const qRes = insertQ.run(versionId, q.text, q.category, qIdx + 1);
      const qId = Number(qRes.lastInsertRowid);
      let correctOptId = 0;
      let wrongOptId = 0;

      q.options.forEach((opt, oIdx) => {
        const oRes = insertOpt.run(qId, opt.text, opt.correct, oIdx + 1);
        const optId = Number(oRes.lastInsertRowid);
        if (opt.correct === 1) {
          correctOptId = optId;
        } else if (!wrongOptId) {
          wrongOptId = optId;
        }
      });

      questionIds.push({ qId, correctOptId, wrongOptId });
    });

    db.prepare("UPDATE quiz_versions SET status = 'published' WHERE id = ?").run(versionId);
    db.prepare('UPDATE quizzes SET current_version_id = ? WHERE id = ?').run(versionId, quizId);

    const submissionsToSeed = [
      { username: 'sara', correctCount: 5, submittedAt: '2026-11-15T14:20:00.000Z' },
      { username: 'rafi', correctCount: 4, submittedAt: '2026-11-16T10:15:00.000Z' },
      { username: 'nadia', correctCount: 3, submittedAt: '2026-11-16T18:45:00.000Z' },
    ];

    for (const sub of submissionsToSeed) {
      const partId = userIds.get(sub.username);
      const pct = Math.round((sub.correctCount / questionIds.length) * 10000) / 100;
      const subRes = db
        .prepare(
          `INSERT INTO quiz_submissions
             (quiz_id, quiz_version_id, participant_user_id, total_questions, correct_answers, match_percentage, submitted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          quizId,
          versionId,
          partId,
          questionIds.length,
          sub.correctCount,
          pct,
          sub.submittedAt
        );
      const submissionId = Number(subRes.lastInsertRowid);

      questionIds.forEach((qInfo, idx) => {
        const isCorrect = idx < sub.correctCount ? 1 : 0;
        const selectedId = isCorrect === 1 ? qInfo.correctOptId : qInfo.wrongOptId;
        db.prepare(
          `INSERT INTO submitted_answers (submission_id, question_id, selected_option_id, is_correct)
           VALUES (?, ?, ?, ?)`
        ).run(submissionId, qInfo.qId, selectedId, isCorrect);
      });
    }
  });

  seed();
}

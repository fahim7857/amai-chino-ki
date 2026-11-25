import crypto from 'crypto';

export function seedDevelopmentData(db) {
  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
  if (countRow.cnt > 0) {
    return;
  }

  const seed = db.transaction(() => {
    const demoUsers = [
      { name: 'Fahim Ahmed', username: 'fahim' },
      { name: 'Sara Rahman', username: 'sara' },
      { name: 'Rafi Hasan', username: 'rafi' },
      { name: 'Nadia Karim', username: 'nadia' },
    ];

    const userIds = new Map();

    for (const u of demoUsers) {
      const res = db
        .prepare('INSERT INTO users (supabase_user_id) VALUES (?)')
        .run(crypto.randomUUID());
      const userId = Number(res.lastInsertRowid);
      userIds.set(u.username, userId);

      db.prepare('INSERT INTO user_profiles (user_id, name, username, avatar_url) VALUES (?, ?, ?, ?)').run(
        userId,
        u.name,
        u.username,
        null
      );
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
    const v1Id = Number(verRes.lastInsertRowid);

    const questionsData = [
      {
        text: 'What is my all-time favorite comfort food? 🍕',
        cat: 'Favourite Food',
        options: [
          { text: 'Kacchi Biryani', correct: 1 },
          { text: 'Cheesy Pizza', correct: 0 },
          { text: 'Beef Burger', correct: 0 },
          { text: 'Ramen Bowl', correct: 0 },
        ],
      },
      {
        text: 'Which color dominates my wardrobe? 🎨',
        cat: 'Favourite Color',
        options: [
          { text: 'Navy Blue', correct: 1 },
          { text: 'Jet Black', correct: 0 },
          { text: 'Olive Green', correct: 0 },
          { text: 'Crisp White', correct: 0 },
        ],
      },
      {
        text: 'If I have a free Sunday afternoon, what am I doing? ☕',
        cat: 'Favourite Hobby',
        options: [
          { text: 'Brewing coffee and playing video games', correct: 1 },
          { text: 'Binge-watching anime series', correct: 0 },
          { text: 'Going for a long bike ride', correct: 0 },
          { text: 'Taking a 3-hour nap', correct: 0 },
        ],
      },
      {
        text: 'What is my dream travel destination? ✈️',
        cat: 'Dream Destination',
        options: [
          { text: 'Kyoto, Japan in autumn', correct: 1 },
          { text: 'Swiss Alps in winter', correct: 0 },
          { text: 'Santorini sunsets', correct: 0 },
          { text: 'Iceland northern lights', correct: 0 },
        ],
      },
      {
        text: 'Which sport can keep me hooked for hours? ⚽',
        cat: 'Favourite Sport',
        options: [
          { text: 'Football (Champions League nights)', correct: 1 },
          { text: 'Cricket (T20 thrills)', correct: 0 },
          { text: 'Table Tennis rallies', correct: 0 },
          { text: 'Badminton under lights', correct: 0 },
        ],
      },
    ];

    for (let i = 0; i < questionsData.length; i += 1) {
      const q = questionsData[i];
      const qRes = db
        .prepare(
          `INSERT INTO questions (quiz_version_id, question_text, category, question_order)
           VALUES (?, ?, ?, ?)`
        )
        .run(v1Id, q.text, q.cat, i + 1);
      const qId = Number(qRes.lastInsertRowid);

      const optStmt = db.prepare(
        `INSERT INTO answer_options (question_id, option_text, is_correct, option_order)
         VALUES (?, ?, ?, ?)`
      );
      for (let j = 0; j < q.options.length; j += 1) {
        optStmt.run(qId, q.options[j].text, q.options[j].correct, j + 1);
      }
    }

    db.prepare("UPDATE quiz_versions SET status = 'published' WHERE id = ?").run(v1Id);
    db.prepare('UPDATE quizzes SET current_version_id = ? WHERE id = ?').run(v1Id, quizId);

    const saraId = userIds.get('sara');
    const rafiId = userIds.get('rafi');
    const nadiaId = userIds.get('nadia');

    const subStmt = db.prepare(
      `INSERT INTO quiz_submissions (quiz_id, quiz_version_id, participant_user_id, total_questions, correct_answers, match_percentage)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    subStmt.run(quizId, v1Id, saraId, 5, 5, 100.0);
    subStmt.run(quizId, v1Id, rafiId, 5, 4, 80.0);
    subStmt.run(quizId, v1Id, nadiaId, 5, 3, 60.0);
  });

  seed();
}

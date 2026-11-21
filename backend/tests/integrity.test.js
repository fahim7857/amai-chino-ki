import assert from 'node:assert/strict';
import { createDatabaseConnection } from '../config/database.js';
import { isUsernameAvailable, loginUser, registerUser } from '../services/auth.service.js';
import { getLeaderboardBySlug } from '../services/leaderboard.service.js';
import {
  addQuestionToQuiz,
  createQuiz,
  deleteQuestion,
  getPublicQuiz,
  getQuizForOwner,
  publishQuiz,
  updateQuestion,
} from '../services/quiz.service.js';
import { getSubmissionResult, submitQuizAnswers } from '../services/scoring.service.js';

async function runTests() {
  const db = createDatabaseConnection(':memory:');
  console.log('Running Who Knows Me Better? Vanilla JS database & backend integrity tests...');

  const alice = await registerUser(db, {
    name: 'Alice Wonder',
    username: 'alice',
    password: 'password123',
  });
  assert.equal(alice.user.username, 'alice');
  assert.equal(isUsernameAvailable(db, 'alice').available, false);
  assert.equal(isUsernameAvailable(db, 'bob').available, true);

  await assert.rejects(
    () =>
      registerUser(db, {
        name: 'Alice Clone',
        username: 'alice',
        password: 'password123',
      }),
    /already taken/
  );

  const loginOk = await loginUser(db, { username: 'alice', password: 'password123' });
  assert.equal(loginOk.user.id, alice.user.id);
  await assert.rejects(
    () => loginUser(db, { username: 'alice', password: 'wrongpassword' }),
    /Invalid username or password/
  );

  const bob = await registerUser(db, {
    name: 'Bob Builder',
    username: 'bob',
    password: 'password123',
  });
  const charlie = await registerUser(db, {
    name: 'Charlie Day',
    username: 'charlie',
    password: 'password123',
  });

  const aliceQuiz = createQuiz(db, alice.user.id, alice.user.username, {
    title: 'How well do you know Alice?',
    description: 'Test our friendship!',
  });
  assert.equal(aliceQuiz.status, 'draft');

  assert.throws(() => getQuizForOwner(db, aliceQuiz.id, bob.user.id), /do not own/);

  assert.throws(
    () =>
      addQuestionToQuiz(db, aliceQuiz.id, alice.user.id, {
        question_text: 'Too few options?',
        category: 'Custom',
        options: [
          { option_text: 'A', is_correct: 1 },
          { option_text: 'B', is_correct: 0 },
          { option_text: 'C', is_correct: 0 },
        ],
      }),
    /4 or 5 answer options/
  );

  assert.throws(
    () =>
      addQuestionToQuiz(db, aliceQuiz.id, alice.user.id, {
        question_text: 'Duplicate options?',
        category: 'Custom',
        options: [
          { option_text: 'Tea', is_correct: 1 },
          { option_text: 'tea', is_correct: 0 },
          { option_text: 'Coffee', is_correct: 0 },
          { option_text: 'Juice', is_correct: 0 },
        ],
      }),
    /Duplicate answer options/
  );

  addQuestionToQuiz(db, aliceQuiz.id, alice.user.id, {
    question_text: 'What is my favourite food?',
    category: 'Favourite Food',
    options: [
      { option_text: 'Biryani', is_correct: 0 },
      { option_text: 'Kacchi', is_correct: 1 },
      { option_text: 'Pizza', is_correct: 0 },
      { option_text: 'Burger', is_correct: 0 },
    ],
  });

  const q2Updated = addQuestionToQuiz(db, aliceQuiz.id, alice.user.id, {
    question_text: 'What is my favourite season?',
    category: 'Favourite Season',
    options: [
      { option_text: 'Winter', is_correct: 1 },
      { option_text: 'Summer', is_correct: 0 },
      { option_text: 'Spring', is_correct: 0 },
      { option_text: 'Autumn', is_correct: 0 },
    ],
  });
  assert.equal(q2Updated.question_count, 2);

  const published = publishQuiz(db, aliceQuiz.id, alice.user.id);
  assert.equal(published.status, 'published');
  assert.equal(published.active_version_number, 1);

  const v1QuestionId = published.questions[0].id;
  assert.throws(() => {
    db.prepare('DELETE FROM questions WHERE id = ?').run(v1QuestionId);
  }, /Cannot delete questions from a published quiz version/);

  const publicView = getPublicQuiz(db, 'alice', bob.user.id);
  assert.equal(publicView.questions.length, 2);
  for (const q of publicView.questions) {
    for (const opt of q.options) {
      assert.equal('is_correct' in opt, false);
    }
  }
  const publicSerialized = JSON.stringify(publicView);
  assert.equal(publicSerialized.includes('is_correct'), false);
  assert.equal(publicSerialized.includes('isCorrect'), false);
  assert.equal(publicSerialized.includes('correctOption'), false);

  // Even when the owner requests the public endpoint, is_correct is omitted
  const publicViewOwner = getPublicQuiz(db, 'alice', alice.user.id);
  assert.equal(JSON.stringify(publicViewOwner).includes('is_correct'), false);

  assert.throws(
    () =>
      submitQuizAnswers(
        db,
        'alice',
        alice.user.id,
        publicView.questions.map((q) => ({ questionId: q.id, selectedOptionId: q.options[0].id }))
      ),
    /cannot submit answers to your own quiz/
  );

  const v1OwnerView = getQuizForOwner(db, aliceQuiz.id, alice.user.id);
  assert.equal(v1OwnerView.questions[0].options.some((o) => o.is_correct === 1), true);
  const q1Correct = v1OwnerView.questions[0].options.find((o) => o.is_correct === 1).id;
  const q1Wrong = v1OwnerView.questions[0].options.find((o) => o.is_correct === 0).id;
  const q2Correct = v1OwnerView.questions[1].options.find((o) => o.is_correct === 1).id;

  const bobResult = submitQuizAnswers(db, 'alice', bob.user.id, [
    { questionId: v1OwnerView.questions[0].id, selectedOptionId: q1Wrong },
    { questionId: v1OwnerView.questions[1].id, selectedOptionId: q2Correct },
  ]);
  assert.equal(bobResult.matchPercentage, 50);
  assert.equal(bobResult.correctAnswers, 1);
  assert.equal(bobResult.totalQuestions, 2);

  // Participant submission result must never leak per-question answers or correct options
  const bobResultSerialized = JSON.stringify(bobResult);
  assert.equal(bobResultSerialized.includes('is_correct'), false);
  assert.equal(bobResultSerialized.includes('submitted_answers'), false);
  assert.equal('questions' in bobResult, false);
  assert.equal('answers' in bobResult, false);
  assert.equal('options' in bobResult, false);

  assert.throws(
    () =>
      submitQuizAnswers(db, 'alice', bob.user.id, [
        { questionId: v1OwnerView.questions[0].id, selectedOptionId: q1Correct },
        { questionId: v1OwnerView.questions[1].id, selectedOptionId: q2Correct },
      ]),
    /already submitted/
  );

  const charlieResult = submitQuizAnswers(db, 'alice', charlie.user.id, [
    { questionId: v1OwnerView.questions[0].id, selectedOptionId: q1Correct },
    { questionId: v1OwnerView.questions[1].id, selectedOptionId: q2Correct },
  ]);
  assert.equal(charlieResult.matchPercentage, 100);

  assert.throws(
    () => getSubmissionResult(db, bobResult.submissionId, charlie.user.id),
    /only view your own/
  );

  const bobFetchedResult = getSubmissionResult(db, bobResult.submissionId, bob.user.id);
  const bobFetchedSerialized = JSON.stringify(bobFetchedResult);
  assert.equal(bobFetchedSerialized.includes('is_correct'), false);
  assert.equal('questions' in bobFetchedResult, false);
  assert.equal('answers' in bobFetchedResult, false);

  const lb = getLeaderboardBySlug(db, 'alice', alice.user.id);
  assert.equal(lb.entries.length, 2);
  assert.equal(lb.entries[0].participantUsername, 'charlie');
  assert.equal(lb.entries[0].rank, 1);
  assert.equal(lb.entries[1].participantUsername, 'bob');
  assert.equal(lb.entries[1].rank, 2);
  assert.equal(JSON.stringify(lb).includes('is_correct'), false);

  const editedQuiz = updateQuestion(db, v1QuestionId, alice.user.id, {
    question_text: 'Updated Q1 in v2',
    category: 'Favourite Food',
    options: [
      { option_text: 'Tacos', is_correct: 1 },
      { option_text: 'Sushi', is_correct: 0 },
      { option_text: 'Ramen', is_correct: 0 },
      { option_text: 'Steak', is_correct: 0 },
    ],
  });
  assert.equal(editedQuiz.active_version_number, 2);
  assert.equal(editedQuiz.has_unpublished_changes, true);

  const publicStillV1 = getPublicQuiz(db, 'alice');
  assert.equal(publicStillV1.questions[0].question_text, 'What is my favourite food?');

  const publishedV2 = publishQuiz(db, aliceQuiz.id, alice.user.id);
  assert.equal(publishedV2.active_version_number, 2);
  const publicNowV2 = getPublicQuiz(db, 'alice');
  assert.equal(publicNowV2.questions[0].question_text, 'Updated Q1 in v2');

  const bobResultAfterV2 = getSubmissionResult(db, bobResult.submissionId, bob.user.id);
  assert.equal(bobResultAfterV2.totalQuestions, 2);
  assert.equal(bobResultAfterV2.matchPercentage, 50);

  const afterDelete = deleteQuestion(db, publishedV2.questions[0].id, alice.user.id);
  assert.equal(afterDelete.question_count, 1);
  assert.equal(afterDelete.active_version_number, 3);

  db.close();
  console.log('All 12 Vanilla JS integrity test suites passed!');
}

runTests().catch((err) => {
  console.error('Test failure:', err);
  process.exit(1);
});

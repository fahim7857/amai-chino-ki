import { getDb } from '../config/database.js';
import {
  addQuestionToQuiz,
  deleteQuestion,
  reorderQuestions,
  updateQuestion,
} from '../services/quiz.service.js';
import { AppError } from '../utils/errors.js';

export function addQuestionController(req, res, next) {
  try {
    const quizId = Number(req.params.id);
    if (!Number.isInteger(quizId)) {
      throw new AppError('Invalid quiz ID.', 400, 'INVALID_ID');
    }
    const db = getDb();
    const quiz = addQuestionToQuiz(db, quizId, req.authUser.id, req.body || {});
    res.status(201).json({ quiz });
  } catch (err) {
    next(err);
  }
}

export function reorderQuestionsController(req, res, next) {
  try {
    const quizId = Number(req.params.id);
    if (!Number.isInteger(quizId)) {
      throw new AppError('Invalid quiz ID.', 400, 'INVALID_ID');
    }
    const db = getDb();
    const quiz = reorderQuestions(
      db,
      quizId,
      req.authUser.id,
      req.body?.orderedQuestionIds
    );
    res.json({ quiz });
  } catch (err) {
    next(err);
  }
}

export function updateQuestionController(req, res, next) {
  try {
    const questionId = Number(req.params.id);
    if (!Number.isInteger(questionId)) {
      throw new AppError('Invalid question ID.', 400, 'INVALID_ID');
    }
    const db = getDb();
    const quiz = updateQuestion(db, questionId, req.authUser.id, req.body || {});
    res.json({ quiz });
  } catch (err) {
    next(err);
  }
}

export function deleteQuestionController(req, res, next) {
  try {
    const questionId = Number(req.params.id);
    if (!Number.isInteger(questionId)) {
      throw new AppError('Invalid question ID.', 400, 'INVALID_ID');
    }
    const db = getDb();
    const quiz = deleteQuestion(db, questionId, req.authUser.id);
    res.json({ quiz });
  } catch (err) {
    next(err);
  }
}

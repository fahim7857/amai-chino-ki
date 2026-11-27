import { getDb } from '../config/database.js';
import {
  createQuiz,
  deleteQuiz,
  getMyQuizzes,
  getPublicQuiz,
  getPublicUserProfile,
  getQuizForOwner,
  publishQuiz,
  updateQuizMetadata,
} from '../services/quiz.service.js';
import { AppError } from '../utils/errors.js';

export function createQuizController(req, res, next) {
  try {
    const db = getDb();
    const quiz = createQuiz(db, req.authUser.id, req.authUser.username, req.body || {});
    res.status(201).json({ quiz });
  } catch (err) {
    next(err);
  }
}

export function listMyQuizzesController(req, res, next) {
  try {
    const db = getDb();
    const quizzes = getMyQuizzes(db, req.authUser.id);
    res.json({ quizzes });
  } catch (err) {
    next(err);
  }
}

export function getQuizByIdController(req, res, next) {
  try {
    const quizId = Number(req.params.id);
    if (!Number.isInteger(quizId)) {
      throw new AppError('Invalid quiz ID.', 400, 'INVALID_ID');
    }
    const db = getDb();
    const quiz = getQuizForOwner(db, quizId, req.authUser.id);
    res.json({ quiz });
  } catch (err) {
    next(err);
  }
}

export function updateQuizController(req, res, next) {
  try {
    const quizId = Number(req.params.id);
    if (!Number.isInteger(quizId)) {
      throw new AppError('Invalid quiz ID.', 400, 'INVALID_ID');
    }
    const db = getDb();
    const quiz = updateQuizMetadata(db, quizId, req.authUser.id, req.body || {});
    res.json({ quiz });
  } catch (err) {
    next(err);
  }
}

export function deleteQuizController(req, res, next) {
  try {
    const quizId = Number(req.params.id);
    if (!Number.isInteger(quizId)) {
      throw new AppError('Invalid quiz ID.', 400, 'INVALID_ID');
    }
    const db = getDb();
    deleteQuiz(db, quizId, req.authUser.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export function publishQuizController(req, res, next) {
  try {
    const quizId = Number(req.params.id);
    if (!Number.isInteger(quizId)) {
      throw new AppError('Invalid quiz ID.', 400, 'INVALID_ID');
    }
    const db = getDb();
    const quiz = publishQuiz(db, quizId, req.authUser.id);
    res.json({ quiz });
  } catch (err) {
    next(err);
  }
}

export function getPublicQuizController(req, res, next) {
  try {
    const db = getDb();
    const quiz = getPublicQuiz(db, req.params.slug, req.authUser?.id);
    res.json({ quiz });
  } catch (err) {
    next(err);
  }
}

export function getPublicProfileController(req, res, next) {
  try {
    const db = getDb();
    const profile = getPublicUserProfile(db, req.params.username);
    res.json({ profile });
  } catch (err) {
    next(err);
  }
}

export function getPublicUserQuizzesController(req, res, next) {
  try {
    const db = getDb();
    const profile = getPublicUserProfile(db, req.params.username);
    res.json({ quizzes: profile.quizzes });
  } catch (err) {
    next(err);
  }
}

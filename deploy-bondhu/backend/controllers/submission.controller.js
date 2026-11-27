import { getDb } from '../config/database.js';
import { getSubmissionResult, submitQuizAnswers } from '../services/scoring.service.js';
import { AppError } from '../utils/errors.js';

export function submitQuizController(req, res, next) {
  try {
    const db = getDb();
    const answers = req.body?.answers;
    const result = submitQuizAnswers(db, req.params.slug, req.authUser.id, answers);
    res.status(201).json({ result });
  } catch (err) {
    next(err);
  }
}

export function getSubmissionController(req, res, next) {
  try {
    const submissionId = Number(req.params.id);
    if (!Number.isInteger(submissionId)) {
      throw new AppError('Invalid submission ID.', 400, 'INVALID_ID');
    }
    const db = getDb();
    const result = getSubmissionResult(db, submissionId, req.authUser.id);
    res.json({ result });
  } catch (err) {
    next(err);
  }
}

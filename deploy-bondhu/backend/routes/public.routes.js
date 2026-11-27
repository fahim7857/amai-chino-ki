import { Router } from 'express';
import {
  getDashboardStatsController,
  getLeaderboardController,
  updateSettingsController,
} from '../controllers/leaderboard.controller.js';
import {
  getPublicProfileController,
  getPublicQuizController,
  getPublicUserQuizzesController,
} from '../controllers/quiz.controller.js';
import {
  getSubmissionController,
  submitQuizController,
} from '../controllers/submission.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { submissionRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.get('/public/quiz/:slug', getPublicQuizController);
router.post('/public/quiz/:slug/submit', requireAuth, submissionRateLimiter, submitQuizController);
router.get('/public/quiz/:slug/leaderboard', getLeaderboardController);

router.get('/submissions/:id', requireAuth, getSubmissionController);
router.get('/dashboard/stats', requireAuth, getDashboardStatsController);
router.put('/settings', requireAuth, updateSettingsController);

router.get('/users/:username', getPublicProfileController);
router.get('/users/:username/quizzes', getPublicUserQuizzesController);

export default router;

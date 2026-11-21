import { Router } from 'express';
import {
  addQuestionController,
  deleteQuestionController,
  reorderQuestionsController,
  updateQuestionController,
} from '../controllers/question.controller.js';
import {
  createQuizController,
  deleteQuizController,
  getQuizByIdController,
  listMyQuizzesController,
  publishQuizController,
  updateQuizController,
} from '../controllers/quiz.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/quizzes', requireAuth, createQuizController);
router.get('/quizzes/my', requireAuth, listMyQuizzesController);
router.get('/quizzes/:id', requireAuth, getQuizByIdController);
router.put('/quizzes/:id', requireAuth, updateQuizController);
router.delete('/quizzes/:id', requireAuth, deleteQuizController);
router.post('/quizzes/:id/publish', requireAuth, publishQuizController);

router.post('/quizzes/:id/questions', requireAuth, addQuestionController);
router.put('/quizzes/:id/questions/reorder', requireAuth, reorderQuestionsController);
router.put('/questions/:id', requireAuth, updateQuestionController);
router.delete('/questions/:id', requireAuth, deleteQuestionController);

export default router;

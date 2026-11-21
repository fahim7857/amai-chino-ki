import { Router } from 'express';
import {
  checkUsernameController,
  loginController,
  logoutController,
  meController,
  registerController,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.get('/check-username', checkUsernameController);
router.post('/register', authRateLimiter, registerController);
router.post('/login', authRateLimiter, loginController);
router.post('/logout', logoutController);
router.get('/me', requireAuth, meController);

export default router;

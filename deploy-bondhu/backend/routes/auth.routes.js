import { Router } from 'express';
import {
  checkUsernameController,
  loginController,
  logoutController,
  meController,
  registerController,
  uploadProfilePictureController,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.get('/check-username', checkUsernameController);
router.post('/register', authRateLimiter, registerController);
router.post('/login', authRateLimiter, loginController);
router.post('/logout', logoutController);
router.get('/me', requireAuth, meController);
router.post('/profile-picture', requireAuth, uploadProfilePictureController);

export default router;

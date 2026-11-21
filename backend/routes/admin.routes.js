import { Router } from 'express';
import {
    adminDeleteUserController,
    adminListUsersController,
    adminLoginController,
    adminLogoutController,
    adminStatsController,
} from '../controllers/admin.controller.js';
import { requireAdmin } from '../middleware/admin.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/admin/login', authRateLimiter, adminLoginController);
router.post('/admin/logout', adminLogoutController);

router.get('/admin/stats', requireAdmin, adminStatsController);
router.get('/admin/users', requireAdmin, adminListUsersController);
router.delete('/admin/users/:supabaseUserId', requireAdmin, adminDeleteUserController);

export default router;
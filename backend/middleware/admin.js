import { ADMIN_COOKIE, verifyAdminToken } from '../services/admin.service.js';

export function requireAdmin(req, res, next) {
    const token = req.cookies ? req.cookies[ADMIN_COOKIE] : undefined;
    if (!verifyAdminToken(token)) {
        res.status(401).json({ error: 'Admin login required' });
        return;
    }
    next();
}
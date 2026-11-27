import {
    ADMIN_COOKIE,
    adminLogin,
    deleteUser,
    getStats,
    listUsers,
} from '../services/admin.service.js';

const COOKIE_PATH = (process.env.BASE_PATH || '/bondhu').replace(/\/+$/, '') || '/';

const cookieOpts = {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: COOKIE_PATH,
};

export function adminLoginController(req, res) {
    const { username, password } = req.body || {};
    const token = adminLogin(username, password);
    if (!token) {
        res.status(401).json({ error: 'Invalid admin credentials' });
        return;
    }
    res.cookie(ADMIN_COOKIE, token, { ...cookieOpts, maxAge: 2 * 60 * 60 * 1000 });
    res.json({ ok: true });
}

export function adminLogoutController(_req, res) {
    res.clearCookie(ADMIN_COOKIE, cookieOpts);
    res.json({ ok: true });
}

export async function adminStatsController(_req, res, next) {
    try {
        res.json(await getStats());
    } catch (err) {
        next(err);
    }
}

export async function adminListUsersController(req, res, next) {
    try {
        res.json(
            await listUsers({
                search: typeof req.query.search === 'string' ? req.query.search : '',
                page: req.query.page,
                pageSize: req.query.pageSize,
            })
        );
    } catch (err) {
        next(err);
    }
}

export async function adminDeleteUserController(req, res, next) {
    try {
        res.json(await deleteUser(req.params.supabaseUserId));
    } catch (err) {
        if (err.status === 400) {
            res.status(400).json({ error: err.message });
            return;
        }
        next(err);
    }
}
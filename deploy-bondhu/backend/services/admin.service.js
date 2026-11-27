import crypto from 'crypto';
import { getDb } from '../config/database.js';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || '').trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_SECRET = process.env.ADMIN_SESSION_SECRET || '';

export const ADMIN_COOKIE = 'admin_session';
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000; // ২ ঘণ্টা
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeEqual(a, b) {
    const ha = crypto.createHash('sha256').update(String(a)).digest();
    const hb = crypto.createHash('sha256').update(String(b)).digest();
    return crypto.timingSafeEqual(ha, hb);
}

function sign(body) {
    return crypto.createHmac('sha256', ADMIN_SECRET).update(body).digest('base64url');
}

export function adminConfigured() {
    return Boolean(ADMIN_USERNAME && ADMIN_PASSWORD && ADMIN_SECRET.length >= 32);
}

export function adminLogin(username, password) {
    if (!adminConfigured()) return null;
    const okUser = safeEqual(username || '', ADMIN_USERNAME);
    const okPass = safeEqual(password || '', ADMIN_PASSWORD);
    if (!(okUser && okPass)) return null;
    const body = Buffer.from(
        JSON.stringify({ role: 'admin', exp: Date.now() + TOKEN_TTL_MS })
    ).toString('base64url');
    return `${body}.${sign(body)}`;
}

export function verifyAdminToken(token) {
    if (!adminConfigured() || typeof token !== 'string') return false;
    const [body, sig] = token.split('.');
    if (!body || !sig || !safeEqual(sig, sign(body))) return false;
    try {
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
        return payload.role === 'admin' && payload.exp > Date.now();
    } catch {
        return false;
    }
}

// ---------- ইউজার লিস্ট / সার্চ (SQLite) ----------
export async function listUsers({ search = '', page = 1, pageSize = 20 }) {
    const db = getDb();
    const limit = Math.min(Math.max(Number(pageSize) || 20, 1), 100);
    const pageNum = Math.max(Number(page) || 1, 1);
    const offset = (pageNum - 1) * limit;

    // LIKE-এর বিশেষ অক্ষর escape
    const q = String(search).trim().slice(0, 50).replace(/[\\%_]/g, (c) => '\\' + c);
    const like = `%${q}%`;

    const total = db
        .prepare(
            `SELECT COUNT(*) c
       FROM user_profiles up
       WHERE up.username LIKE ? ESCAPE '\\' OR up.name LIKE ? ESCAPE '\\'`
        )
        .get(like, like).c;

    const users = db
        .prepare(
            `SELECT u.id,
              up.name,
              up.username,
              u.created_at,
              (SELECT COUNT(*) FROM quizzes q WHERE q.user_id = u.id) AS quizzes,
              (SELECT COUNT(*) FROM quiz_submissions s WHERE s.participant_user_id = u.id) AS submissions
       FROM users u
       JOIN user_profiles up ON up.user_id = u.id
       WHERE up.username LIKE ? ESCAPE '\\' OR up.name LIKE ? ESCAPE '\\'
       ORDER BY u.id DESC
       LIMIT ? OFFSET ?`
        )
        .all(like, like, limit, offset);

    return { users, total, page: pageNum, pageSize: limit };
}

export async function getStats() {
    const db = getDb();
    return {
        totalUsers: db.prepare('SELECT COUNT(*) c FROM users').get().c,
        totalQuizzes: db.prepare('SELECT COUNT(*) c FROM quizzes').get().c,
        totalSubmissions: db.prepare('SELECT COUNT(*) c FROM quiz_submissions').get().c,
    };
}

// ---------- ইউজার ডিলিট ----------
export async function deleteUser(userId) {
    const id = Number(userId);
    if (!Number.isInteger(id) || id < 1) {
        const err = new Error('Invalid user id');
        err.status = 400;
        throw err;
    }

    const db = getDb();
    const row = db.prepare('SELECT supabase_user_id FROM users WHERE id = ?').get(id);
    if (!row) {
        const err = new Error('User not found');
        err.status = 400;
        throw err;
    }

    // Supabase Auth থেকেও মোছার চেষ্টা (থাকলে)। ফেইল করলেও চলবে,
    // কারণ SQLite থেকে মুছলে ওই ইউজার আর লগইন করতে পারে না।
    let supabaseDeleted = false;
    if (SUPABASE_URL && SERVICE_KEY && UUID_RE.test(row.supabase_user_id)) {
        try {
            const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${row.supabase_user_id}`, {
                method: 'DELETE',
                headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
            });
            supabaseDeleted = res.ok;
        } catch {
            supabaseDeleted = false;
        }
    }

    // SQLite: user_profiles, quizzes, submissions, settings সব cascade-এ মুছবে
    const info = db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return { sqliteRowsDeleted: info.changes, supabaseDeleted };
}
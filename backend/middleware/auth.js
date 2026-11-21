import { getDb } from '../config/database.js';
import {
  getSessionCookieName,
  getUserById,
  verifySessionToken,
} from '../services/auth.service.js';
import { UnauthorizedError } from '../utils/errors.js';

export function attachAuthUser(req, _res, next) {
  const cookieToken = req.cookies ? req.cookies[getSessionCookieName()] : undefined;
  const bearerHeader = req.headers.authorization;
  const bearerToken =
    bearerHeader && bearerHeader.startsWith('Bearer ') ? bearerHeader.slice(7).trim() : '';
  const token = typeof cookieToken === 'string' && cookieToken ? cookieToken : bearerToken;

  if (token) {
    const payload = verifySessionToken(token);
    if (payload) {
      const db = getDb();
      const user = getUserById(db, payload.userId);
      if (user && user.supabaseUserId === payload.supabaseUserId) {
        req.authUser = user;
      }
    }
  }

  next();
}

export function requireAuth(req, _res, next) {
  if (!req.authUser) {
    next(new UnauthorizedError('Please log in to continue.'));
    return;
  }
  next();
}

export function setSessionCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(getSessionCookieName(), token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(getSessionCookieName(), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
}

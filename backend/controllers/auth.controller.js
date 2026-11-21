import { getDb } from '../config/database.js';
import { clearSessionCookie, setSessionCookie } from '../middleware/auth.js';
import {
  isUsernameAvailable,
  loginUser,
  registerUser,
} from '../services/auth.service.js';

export function checkUsernameController(req, res, next) {
  try {
    const raw = typeof req.query.username === 'string' ? req.query.username : '';
    const db = getDb();
    const result = isUsernameAvailable(db, raw);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function registerController(req, res, next) {
  try {
    const db = getDb();
    const { user, token } = await registerUser(db, req.body || {});
    setSessionCookie(res, token);
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
}

export async function loginController(req, res, next) {
  try {
    const db = getDb();
    const { user, token } = await loginUser(db, req.body || {});
    setSessionCookie(res, token);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export function logoutController(_req, res) {
  clearSessionCookie(res);
  res.json({ ok: true });
}

export function meController(req, res) {
  res.json({ user: req.authUser });
}

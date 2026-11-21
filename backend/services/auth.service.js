import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  buildInternalAlias,
  isSupabaseConfigured,
  loginWithSupabaseAuth,
  registerWithSupabaseAuth,
} from '../config/supabase.js';
import { AppError, ConflictError, UnauthorizedError } from '../utils/errors.js';
import { normalizeUsername, validateName, validatePassword } from '../utils/validators.js';

const SESSION_COOKIE_NAME = 'wkm_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let cachedSecret = null;

function getSessionSecret() {
  if (cachedSecret) {
    return cachedSecret;
  }
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    cachedSecret = process.env.SESSION_SECRET;
    return cachedSecret;
  }
  const secretPath = path.resolve(process.cwd(), 'data', '.session_secret');
  try {
    if (fs.existsSync(secretPath)) {
      const existing = fs.readFileSync(secretPath, 'utf8').trim();
      if (existing.length >= 32) {
        cachedSecret = existing;
        return cachedSecret;
      }
    }
    const dir = path.dirname(secretPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(secretPath, generated, { mode: 0o600 });
    cachedSecret = generated;
    return cachedSecret;
  } catch {
    cachedSecret = crypto.randomBytes(32).toString('hex');
    return cachedSecret;
  }
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password, storedHash) {
  const parts = storedHash.split(':');
  if (parts.length !== 2) {
    return false;
  }
  const [salt, expectedHex] = parts;
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  const actualBuf = crypto.scryptSync(password, salt, 64);
  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

export function signSessionToken(userId, supabaseUserId) {
  const payload = {
    userId,
    supabaseUserId,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token) {
  if (!token || !token.includes('.')) {
    return null;
  }
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) {
    return null;
  }
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed.userId !== 'number' || typeof parsed.exp !== 'number') {
      return null;
    }
    if (Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getSessionCookieName() {
  return SESSION_COOKIE_NAME;
}

export function isUsernameAvailable(db, rawUsername) {
  const username = normalizeUsername(rawUsername);
  const existing = db
    .prepare('SELECT user_id FROM user_profiles WHERE username = ?')
    .get(username);
  return { available: !existing, username };
}

export async function registerUser(db, input) {
  const name = validateName(input.name);
  const username = normalizeUsername(input.username);
  const password = validatePassword(input.password);

  const existing = db
    .prepare('SELECT user_id FROM user_profiles WHERE username = ?')
    .get(username);
  if (existing) {
    throw new ConflictError('That username is already taken. Try another one!');
  }

  const internalAlias = buildInternalAlias(username);
  let supabaseUserId;
  let storedPasswordHash = null;

  if (isSupabaseConfigured()) {
    const sb = await registerWithSupabaseAuth(username, name, password);
    supabaseUserId = sb.supabaseUserId;
  } else {
    supabaseUserId = crypto.randomUUID();
    storedPasswordHash = hashPassword(password);
  }

  const createLocalUser = db.transaction(() => {
    const userRes = db
      .prepare('INSERT INTO users (supabase_user_id) VALUES (?)')
      .run(supabaseUserId);
    const userId = Number(userRes.lastInsertRowid);

    db.prepare('INSERT INTO user_profiles (user_id, name, username) VALUES (?, ?, ?)').run(
      userId,
      name,
      username
    );

    if (storedPasswordHash) {
      db.prepare(
        'INSERT INTO auth_identities (user_id, internal_alias, password_hash) VALUES (?, ?, ?)'
      ).run(userId, internalAlias, storedPasswordHash);
    }

    db.prepare("INSERT INTO user_settings (user_id, leaderboard_visibility) VALUES (?, 'public')").run(
      userId
    );

    return userId;
  });

  let userId;
  try {
    userId = createLocalUser();
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message.includes('UNIQUE constraint failed')) {
      throw new ConflictError('That username is already taken. Try another one!');
    }
    throw err;
  }

  const user = getUserById(db, userId);
  if (!user) {
    throw new AppError('Failed to load created user', 500, 'USER_CREATE_ERROR');
  }

  const token = signSessionToken(user.id, user.supabaseUserId);
  return { user, token };
}

export async function loginUser(db, input) {
  const username = normalizeUsername(input.username);
  const password = validatePassword(input.password);

  const profile = db
    .prepare(
      `SELECT u.id, u.supabase_user_id, u.created_at, up.name, up.username
       FROM user_profiles up
       JOIN users u ON u.id = up.user_id
       WHERE up.username = ?`
    )
    .get(username);

  if (!profile) {
    throw new UnauthorizedError('Invalid username or password.');
  }

  if (isSupabaseConfigured()) {
    const sb = await loginWithSupabaseAuth(username, password);
    if (!sb) {
      throw new UnauthorizedError('Invalid username or password.');
    }
  } else {
    const identity = db
      .prepare('SELECT password_hash FROM auth_identities WHERE user_id = ?')
      .get(profile.id);

    if (!identity || !verifyPassword(password, identity.password_hash)) {
      throw new UnauthorizedError('Invalid username or password.');
    }
  }

  const user = {
    id: profile.id,
    supabaseUserId: profile.supabase_user_id,
    name: profile.name,
    username: profile.username,
    createdAt: profile.created_at,
  };

  const token = signSessionToken(user.id, user.supabaseUserId);
  return { user, token };
}

export function getUserById(db, userId) {
  const row = db
    .prepare(
      `SELECT u.id, u.supabase_user_id, u.created_at, up.name, up.username
       FROM users u
       JOIN user_profiles up ON up.user_id = u.id
       WHERE u.id = ?`
    )
    .get(userId);

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    supabaseUserId: row.supabase_user_id,
    name: row.name,
    username: row.username,
    createdAt: row.created_at,
  };
}

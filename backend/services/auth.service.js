import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  buildInternalAlias,
  getSupabaseProfile,
  getSupabaseProfileByUsername,
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

export async function isUsernameAvailable(db, rawUsername) {
  const username = normalizeUsername(rawUsername);

  // Check Supabase profiles table
  if (isSupabaseConfigured()) {
    const sbProfile = await getSupabaseProfileByUsername(username);
    if (sbProfile) {
      return { available: false, username };
    }
  }

  // Check local SQLite
  const existing = db
    .prepare('SELECT user_id FROM user_profiles WHERE username = ?')
    .get(username);
  return { available: !existing, username };
}

export async function registerUser(db, input) {
  const name = validateName(input.name);
  const username = normalizeUsername(input.username);
  const password = validatePassword(input.password);
  const avatarUrl = typeof input.avatar_url === 'string' ? input.avatar_url.trim() : null;

  // Verify username in Supabase
  if (isSupabaseConfigured()) {
    const sbProfile = await getSupabaseProfileByUsername(username);
    if (sbProfile) {
      throw new ConflictError('That username is already taken. Try another one!');
    }
  }

  // Verify username in local SQLite
  const existing = db
    .prepare('SELECT user_id FROM user_profiles WHERE username = ?')
    .get(username);
  if (existing) {
    throw new ConflictError('That username is already taken. Try another one!');
  }

  let supabaseUserId;
  if (isSupabaseConfigured()) {
    // Save user credentials (name, username, password) strictly in Supabase
    const sb = await registerWithSupabaseAuth(username, name, password, avatarUrl);
    supabaseUserId = sb.supabaseUserId;
  } else {
    supabaseUserId = crypto.randomUUID();
  }

  // Link user in SQLite for quizzes & submissions without saving any password
  const createLocalUser = db.transaction(() => {
    let existingUser = db.prepare('SELECT id FROM users WHERE supabase_user_id = ?').get(supabaseUserId);
    let userId;
    if (existingUser) {
      userId = existingUser.id;
      db.prepare(
        'UPDATE user_profiles SET name = ?, username = ?, avatar_url = COALESCE(?, avatar_url), updated_at = strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\') WHERE user_id = ?'
      ).run(name, username, avatarUrl, userId);
    } else {
      const userRes = db
        .prepare('INSERT INTO users (supabase_user_id) VALUES (?)')
        .run(supabaseUserId);
      userId = Number(userRes.lastInsertRowid);

      db.prepare('INSERT INTO user_profiles (user_id, name, username, avatar_url) VALUES (?, ?, ?, ?)').run(
        userId,
        name,
        username,
        avatarUrl
      );

      db.prepare("INSERT INTO user_settings (user_id, leaderboard_visibility) VALUES (?, 'public')").run(
        userId
      );
    }

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

  let supabaseUserId = null;
  let profile = null;

  if (isSupabaseConfigured()) {
    // Authenticate password strictly via Supabase Auth
    const sb = await loginWithSupabaseAuth(username, password);
    if (!sb || !sb.supabaseUserId) {
      throw new UnauthorizedError('Invalid username or password.');
    }
    supabaseUserId = sb.supabaseUserId;
    profile = await getSupabaseProfile(supabaseUserId);
  } else {
    // If Supabase is not configured, lookup local profile
    const localProfile = db
      .prepare(
        `SELECT u.id, u.supabase_user_id, u.created_at, up.name, up.username, up.avatar_url
         FROM user_profiles up
         JOIN users u ON u.id = up.user_id
         WHERE up.username = ?`
      )
      .get(username);
    if (!localProfile) {
      throw new UnauthorizedError('Invalid username or password.');
    }
    supabaseUserId = localProfile.supabase_user_id;
    profile = {
      name: localProfile.name,
      username: localProfile.username,
      avatar_url: localProfile.avatar_url,
    };
  }

  const name = profile?.name || username;
  const avatarUrl = profile?.avatar_url || null;

  // Synchronize local SQLite user and user_profiles record
  let localUser = db.prepare('SELECT id FROM users WHERE supabase_user_id = ?').get(supabaseUserId);
  let userId;
  if (!localUser) {
    const insertRes = db.prepare('INSERT INTO users (supabase_user_id) VALUES (?)').run(supabaseUserId);
    userId = Number(insertRes.lastInsertRowid);
    db.prepare('INSERT INTO user_profiles (user_id, name, username, avatar_url) VALUES (?, ?, ?, ?)').run(
      userId,
      name,
      username,
      avatarUrl
    );
    db.prepare("INSERT INTO user_settings (user_id, leaderboard_visibility) VALUES (?, 'public')").run(userId);
  } else {
    userId = localUser.id;
    db.prepare(
      'UPDATE user_profiles SET name = ?, username = ?, avatar_url = COALESCE(?, avatar_url), updated_at = strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\') WHERE user_id = ?'
    ).run(name, username, avatarUrl, userId);
  }

  const user = getUserById(db, userId);
  if (!user) {
    throw new UnauthorizedError('Invalid username or password.');
  }

  const token = signSessionToken(user.id, user.supabaseUserId);
  return { user, token };
}

export function getUserById(db, userId) {
  const row = db
    .prepare(
      `SELECT u.id, u.supabase_user_id, u.created_at, up.name, up.username, up.avatar_url
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
    avatarUrl: row.avatar_url || null,
    createdAt: row.created_at,
  };
}

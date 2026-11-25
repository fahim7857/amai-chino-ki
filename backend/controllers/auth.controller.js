import { getDb } from '../config/database.js';
import { uploadToCloudinary } from '../config/cloudinary.js';
import { updateSupabaseProfile } from '../config/supabase.js';
import { clearSessionCookie, setSessionCookie } from '../middleware/auth.js';
import {
  isUsernameAvailable,
  loginUser,
  registerUser,
} from '../services/auth.service.js';
import { AppError } from '../utils/errors.js';

export async function checkUsernameController(req, res, next) {
  try {
    const raw = typeof req.query.username === 'string' ? req.query.username : '';
    const db = getDb();
    const result = await isUsernameAvailable(db, raw);
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

export async function uploadProfilePictureController(req, res, next) {
  try {
    const { image } = req.body || {};
    if (!image || typeof image !== 'string') {
      throw new AppError('Image file or base64 data is required.', 400, 'INVALID_IMAGE');
    }

    // Limit image data payload size (approx 5MB binary / 7MB base64)
    if (image.length > 7 * 1024 * 1024) {
      throw new AppError('Profile picture must be under 5MB.', 400, 'IMAGE_TOO_LARGE');
    }

    // Upload picture to Cloudinary
    const uploaded = await uploadToCloudinary(image, 'who-knows-me-better/avatars');
    const avatarUrl = uploaded.secure_url;

    // Save image link in Supabase profiles SQL table
    await updateSupabaseProfile(req.authUser.supabaseUserId, { avatar_url: avatarUrl });

    // Save image link in SQLite user_profiles table
    const db = getDb();
    db.prepare(
      'UPDATE user_profiles SET avatar_url = ?, updated_at = strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\') WHERE user_id = ?'
    ).run(avatarUrl, req.authUser.id);

    const updatedUser = {
      ...req.authUser,
      avatarUrl,
    };

    res.json({ user: updatedUser, avatarUrl });
  } catch (err) {
    next(err);
  }
}

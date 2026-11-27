import { getDb } from '../config/database.js';
import { getDashboardStats, getLeaderboardBySlug } from '../services/leaderboard.service.js';
import { AppError } from '../utils/errors.js';

export function getLeaderboardController(req, res, next) {
  try {
    const db = getDb();
    const leaderboard = getLeaderboardBySlug(db, req.params.slug, req.authUser?.id);
    res.json(leaderboard);
  } catch (err) {
    next(err);
  }
}

export function getDashboardStatsController(req, res, next) {
  try {
    const db = getDb();
    const dashboard = getDashboardStats(db, req.authUser.id);
    res.json(dashboard);
  } catch (err) {
    next(err);
  }
}

export function updateSettingsController(req, res, next) {
  try {
    const visibility = req.body?.leaderboard_visibility;
    if (visibility !== 'public' && visibility !== 'private') {
      throw new AppError("Visibility must be 'public' or 'private'.", 400, 'INVALID_VISIBILITY');
    }
    const db = getDb();
    db.prepare(
      `UPDATE user_settings
       SET leaderboard_visibility = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE user_id = ?`
    ).run(visibility, req.authUser.id);
    res.json({ leaderboard_visibility: visibility });
  } catch (err) {
    next(err);
  }
}

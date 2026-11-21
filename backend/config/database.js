import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { runMigrations } from '../database/migrate.js';

let dbInstance = null;

export function getDbPath() {
  const configured = process.env.SQLITE_DB_PATH || './data/quiz.db';
  return path.isAbsolute(configured)
    ? configured
    : path.resolve(process.cwd(), configured);
}

export function createDatabaseConnection(dbPath) {
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  runMigrations(db);
  return db;
}

export function getDb() {
  if (!dbInstance) {
    dbInstance = createDatabaseConnection(getDbPath());
  }
  return dbInstance;
}

export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

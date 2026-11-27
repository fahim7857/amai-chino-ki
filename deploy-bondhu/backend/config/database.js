import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { runMigrations } from '../database/migrate.js';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

let dbInstance = null;

// Compatible SQLite Database implementation using Node.js built-in node:sqlite (Node 22+)
// or falling back to better-sqlite3 if node:sqlite is unavailable.
class NodeSqliteWrapper {
  constructor(rawDb) {
    this.rawDb = rawDb;
    this._txDepth = 0;
  }

  pragma(str) {
    return this.rawDb.exec(`PRAGMA ${str}`);
  }

  exec(sql) {
    return this.rawDb.exec(sql);
  }

  close() {
    return this.rawDb.close();
  }

  transaction(fn) {
    return (...args) => {
      const isOuter = this._txDepth === 0;
      const sp = `tx_sp_${this._txDepth}`;
      if (isOuter) {
        this.rawDb.exec('BEGIN');
      } else {
        this.rawDb.exec(`SAVEPOINT ${sp}`);
      }
      this._txDepth++;
      try {
        const result = fn(...args);
        this._txDepth--;
        if (isOuter) {
          this.rawDb.exec('COMMIT');
        } else {
          this.rawDb.exec(`RELEASE SAVEPOINT ${sp}`);
        }
        return result;
      } catch (err) {
        this._txDepth--;
        if (isOuter) {
          try { this.rawDb.exec('ROLLBACK'); } catch {}
        } else {
          try { this.rawDb.exec(`ROLLBACK TO SAVEPOINT ${sp}`); } catch {}
        }
        throw err;
      }
    };
  }

  prepare(sql) {
    const rawStmt = this.rawDb.prepare(sql);
    return {
      get: (...params) => rawStmt.get(...params),
      all: (...params) => rawStmt.all(...params),
      run: (...params) => {
        const res = rawStmt.run(...params);
        return {
          changes: Number(res.changes || 0),
          lastInsertRowid: Number(res.lastInsertRowid || 0),
        };
      },
    };
  }
}

function getDatabaseConstructor() {
  // First priority: Node.js 22 built-in node:sqlite (zero native dependencies, no GLIBC requirement)
  try {
    const { DatabaseSync } = require('node:sqlite');
    if (DatabaseSync) {
      return (dbPath) => new NodeSqliteWrapper(new DatabaseSync(dbPath));
    }
  } catch {}

  // Fallback: better-sqlite3 (if available and compiled for current environment)
  try {
    const BetterSqlite = require('better-sqlite3');
    return (dbPath) => new BetterSqlite(dbPath);
  } catch (err) {
    throw new Error(
      `No compatible SQLite driver found. Node.js 22 built-in 'node:sqlite' or 'better-sqlite3' is required: ${err.message}`
    );
  }
}

const DatabaseDriver = getDatabaseConstructor();

export function getDbPath() {
  const configured = process.env.SQLITE_DB_PATH || './data/quiz.db';
  return path.isAbsolute(configured)
    ? configured
    : path.resolve(projectRoot, configured);
}

export function createDatabaseConnection(dbPath) {
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = DatabaseDriver(dbPath);
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

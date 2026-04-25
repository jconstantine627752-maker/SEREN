// ─────────────────────────────────────────────────────────────────────────────
//  SEREN — SQLite Log Database
//  Append-only reflection log. Indexed by state and timestamp for fast reads.
// ─────────────────────────────────────────────────────────────────────────────

import Database from 'better-sqlite3'
import type { EmotionState, ReflectionLog } from '../core/stateTypes.js'
import { logger } from '../utils/logger.js'

let _db: Database.Database

export function initDb(url: string = './seren.db'): void {
  _db = new Database(url)
  _db.pragma('journal_mode = WAL')
  _db.pragma('synchronous = NORMAL')

  _db.exec(`
    CREATE TABLE IF NOT EXISTS reflections (
      id         TEXT    PRIMARY KEY,
      timestamp  TEXT    NOT NULL,
      state      TEXT    NOT NULL CHECK(state IN ('CALM','MANIC','DEPRESSED')),
      intensity  REAL    NOT NULL,
      trigger    TEXT    NOT NULL,
      felt       TEXT    NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_state     ON reflections (state);
    CREATE INDEX IF NOT EXISTS idx_timestamp ON reflections (timestamp DESC);
  `)

  logger.info('SQLite initialized', { url })
}

export function writeReflection(entry: ReflectionLog): void {
  _db.prepare(`
    INSERT INTO reflections (id, timestamp, state, intensity, trigger, felt)
    VALUES (@id, @timestamp, @state, @intensity, @trigger, @felt)
  `).run(entry)
}

export function queryReflections(limit: number, state?: EmotionState): ReflectionLog[] {
  if (state) {
    return _db.prepare(`
      SELECT * FROM reflections WHERE state = ? ORDER BY timestamp DESC LIMIT ?
    `).all(state, limit) as ReflectionLog[]
  }
  return _db.prepare(`
    SELECT * FROM reflections ORDER BY timestamp DESC LIMIT ?
  `).all(limit) as ReflectionLog[]
}

/** Expose raw db handle for health checks. */
export function getDb(): Database.Database {
  return _db
}

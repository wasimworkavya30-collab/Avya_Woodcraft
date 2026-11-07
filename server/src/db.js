import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

const here = path.dirname(fileURLToPath(import.meta.url));

fs.mkdirSync(path.dirname(config.databaseFile), { recursive: true });

/**
 * Tier 3: the data layer.
 * Uses the SQLite engine built into Node (node:sqlite, Node 22.5+), so there is
 * no native module to compile on any machine.
 */
export const db = new DatabaseSync(config.databaseFile);

db.prepare('PRAGMA journal_mode = WAL').get();
db.exec('PRAGMA foreign_keys = ON');
db.exec(fs.readFileSync(path.join(here, 'schema.sql'), 'utf8'));

/** Run a function inside a real SQL transaction. */
export const transaction = (work) => {
  db.exec('BEGIN');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore rollback errors so the original error surfaces
    }
    throw error;
  }
};

export const getSetting = (key, fallback = null) => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
};

export const setSetting = (key, value) => {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(key, String(value));
};

export const getSettings = () => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
};

/** Sunday off policy: a list of week numbers (1-5) that are off every month. */
export const sundayWeeks = () => {
  const raw = getSetting('sunday_weeks', '2,4');
  return raw
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 5);
};

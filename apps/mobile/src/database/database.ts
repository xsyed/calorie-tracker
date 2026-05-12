import { open } from '@op-engineering/op-sqlite';
import type { DB } from '@op-engineering/op-sqlite';

let db: DB | null = null;

export function initDatabase(): DB {
  if (db) return db;
  db = open({ name: 'calories.db' });
  db.executeSync(
    'CREATE TABLE IF NOT EXISTS User (' +
      'id TEXT PRIMARY KEY, ' +
      'firebase_uid TEXT UNIQUE NOT NULL, ' +
      'gender TEXT NOT NULL, ' +
      'height_cm REAL NOT NULL, ' +
      'current_weight_kg REAL NOT NULL, ' +
      'age INTEGER NOT NULL, ' +
      'goal TEXT NOT NULL, ' +
      'target_weight_kg REAL, ' +
      'timeframe_days INTEGER, ' +
      'daily_target_calories REAL, ' +
      'protein_g REAL, ' +
      'carbs_g REAL, ' +
      'fat_g REAL' +
      ')',
    [],
  );
  return db;
}

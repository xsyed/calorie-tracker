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
  db.executeSync(
    'CREATE TABLE IF NOT EXISTS food_entries (' +
      'id TEXT PRIMARY KEY, ' +
      'user_id TEXT NOT NULL, ' +
      'date TEXT NOT NULL, ' +
      'raw_text TEXT NOT NULL, ' +
      "status TEXT NOT NULL DEFAULT 'pending', " +
      'retry_count INTEGER NOT NULL DEFAULT 0, ' +
      'created_at TEXT NOT NULL' +
      ')',
    [],
  );
  db.executeSync(
    'CREATE TABLE IF NOT EXISTS food_items (' +
      'id TEXT PRIMARY KEY, ' +
      'food_entry_id TEXT NOT NULL, ' +
      'name TEXT NOT NULL, ' +
      'calories REAL NOT NULL, ' +
      'protein_g REAL NOT NULL, ' +
      'carbs_g REAL NOT NULL, ' +
      'fat_g REAL NOT NULL' +
      ')',
    [],
  );
  db.executeSync(
    'CREATE TABLE IF NOT EXISTS exercise_entries (' +
      'id TEXT PRIMARY KEY, ' +
      'user_id TEXT NOT NULL, ' +
      'date TEXT NOT NULL, ' +
      'exercise_type TEXT NOT NULL, ' +
      'duration_minutes REAL NOT NULL, ' +
      'calories_burned REAL NOT NULL, ' +
      'timestamp TEXT NOT NULL' +
      ')',
    [],
  );
  db.executeSync(
    'CREATE TABLE IF NOT EXISTS app_settings (' +
      'key TEXT PRIMARY KEY, ' +
      'value TEXT NOT NULL' +
      ')',
    [],
  );
  db.executeSync(
    'CREATE TABLE IF NOT EXISTS water_entries (' +
      'id TEXT PRIMARY KEY, ' +
      'user_id TEXT NOT NULL, ' +
      'date TEXT NOT NULL, ' +
      'amount_ml REAL NOT NULL, ' +
      'timestamp TEXT NOT NULL' +
      ')',
    [],
  );
  db.executeSync(
    'CREATE INDEX IF NOT EXISTS idx_water_entries_user_date ' +
      'ON water_entries(user_id, date)',
    [],
  );
  db.executeSync(
    'CREATE TABLE IF NOT EXISTS saved_meals (' +
      'id TEXT PRIMARY KEY, ' +
      'user_id TEXT NOT NULL, ' +
      'name TEXT NOT NULL, ' +
      'created_at TEXT NOT NULL, ' +
      'FOREIGN KEY (user_id) REFERENCES User(id)' +
      ')',
    [],
  );
  db.executeSync(
    'CREATE TABLE IF NOT EXISTS saved_meal_items (' +
      'id TEXT PRIMARY KEY, ' +
      'saved_meal_id TEXT NOT NULL, ' +
      'name TEXT NOT NULL, ' +
      'calories REAL NOT NULL, ' +
      'protein_g REAL NOT NULL, ' +
      'carbs_g REAL NOT NULL, ' +
      'fat_g REAL NOT NULL, ' +
      'FOREIGN KEY (saved_meal_id) REFERENCES saved_meals(id)' +
      ')',
    [],
  );
  return db;
}

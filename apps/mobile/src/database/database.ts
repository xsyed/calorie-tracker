import { open } from '@op-engineering/op-sqlite';
import type { DB } from '@op-engineering/op-sqlite';

let db: DB | null = null;

export function initDatabase(): DB {
  if (db) return db;
  db = open({ name: 'calories.db' });
  db.executeSync(
    'CREATE TABLE IF NOT EXISTS User (id TEXT PRIMARY KEY, firebase_uid TEXT UNIQUE NOT NULL)',
    [],
  );
  return db;
}

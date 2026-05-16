import { initDatabase } from './database';
import type { WeightEntry } from './types';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

function mapRowToWeightEntry(row: Record<string, unknown>): WeightEntry {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    date: row.date as string,
    weight_kg: row.weight_kg as number,
    timestamp: row.timestamp as string,
  };
}

export async function getWeightEntries(
  userId: string,
): Promise<WeightEntry[]> {
  const db = initDatabase();
  const result = await db.execute(
    `SELECT *
     FROM weight_entries
     WHERE user_id = ?
     ORDER BY date DESC, timestamp DESC`,
    [userId],
  );
  return (result.rows as Record<string, unknown>[]).map(mapRowToWeightEntry);
}

export async function insertWeightEntry(
  data: Omit<WeightEntry, 'id' | 'timestamp'>,
): Promise<WeightEntry> {
  const db = initDatabase();
  const entry = {
    id: generateId(),
    ...data,
    timestamp: new Date().toISOString(),
  };
  await db.execute(
    `INSERT INTO weight_entries (id, user_id, date, weight_kg, timestamp)
     VALUES (?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.user_id,
      entry.date,
      entry.weight_kg,
      entry.timestamp,
    ],
  );
  return entry;
}

export async function deleteWeightEntry(
  id: string,
  userId: string,
): Promise<void> {
  const db = initDatabase();
  await db.execute('DELETE FROM weight_entries WHERE id = ? AND user_id = ?', [
    id,
    userId,
  ]);
}

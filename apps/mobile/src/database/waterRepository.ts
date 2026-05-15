import { initDatabase } from './database';
import type { WaterEntry } from './types';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

function mapRowToWaterEntry(row: Record<string, unknown>): WaterEntry {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    date: row.date as string,
    amount_ml: row.amount_ml as number,
    timestamp: row.timestamp as string,
  };
}

export async function insertWaterEntry(
  data: Omit<WaterEntry, 'id'>,
): Promise<WaterEntry> {
  const db = initDatabase();
  const id = generateId();
  await db.execute(
    `INSERT INTO water_entries (id, user_id, date, amount_ml, timestamp)
     VALUES (?, ?, ?, ?, ?)`,
    [id, data.user_id, data.date, data.amount_ml, data.timestamp],
  );
  return { id, ...data };
}

export async function getWaterEntriesByDate(
  userId: string,
  date: string,
): Promise<WaterEntry[]> {
  const db = initDatabase();
  const result = await db.execute(
    'SELECT * FROM water_entries WHERE user_id = ? AND date = ? ORDER BY timestamp DESC',
    [userId, date],
  );
  return (result.rows as Record<string, unknown>[]).map(mapRowToWaterEntry);
}

export async function getDailyWaterTotal(
  userId: string,
  date: string,
): Promise<number> {
  const db = initDatabase();
  const result = await db.execute(
    'SELECT COALESCE(SUM(amount_ml), 0) as total FROM water_entries WHERE user_id = ? AND date = ?',
    [userId, date],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return (row?.total as number) ?? 0;
}

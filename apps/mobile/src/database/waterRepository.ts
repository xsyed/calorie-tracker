import { initDatabase } from './database';
import { getSetting, setSetting } from './appSettingsRepository';
import type { WaterDailyTotal, WaterEntry } from './types';

export const DEFAULT_DAILY_WATER_GOAL_ML = 2000;

const DAILY_WATER_GOAL_SETTING_KEY = 'daily_water_goal_ml';

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

function mapRowToWaterDailyTotal(row: Record<string, unknown>): WaterDailyTotal {
  return {
    date: row.date as string,
    total_ml: (row.total_ml as number) ?? 0,
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

export async function deleteWaterEntry(
  id: string,
  userId: string,
): Promise<void> {
  const db = initDatabase();
  await db.execute('DELETE FROM water_entries WHERE id = ? AND user_id = ?', [
    id,
    userId,
  ]);
}

export async function getWaterEntriesByDate(
  userId: string,
  date: string,
): Promise<WaterEntry[]> {
  const db = initDatabase();
  const result = await db.execute(
    'SELECT * FROM water_entries WHERE user_id = ? AND date = ? ORDER BY timestamp ASC',
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

export async function getWaterTotalsByDateRange(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<WaterDailyTotal[]> {
  const db = initDatabase();
  const result = await db.execute(
    `SELECT date, COALESCE(SUM(amount_ml), 0) AS total_ml
     FROM water_entries
     WHERE user_id = ? AND date BETWEEN ? AND ?
     GROUP BY date
     ORDER BY date ASC`,
    [userId, startDate, endDate],
  );
  return (result.rows as Record<string, unknown>[]).map(
    mapRowToWaterDailyTotal,
  );
}

export async function getDailyWaterGoal(): Promise<number> {
  const value = await getSetting(DAILY_WATER_GOAL_SETTING_KEY);
  if (value === null) return DEFAULT_DAILY_WATER_GOAL_ML;

  const goal = Number(value);
  return Number.isFinite(goal) && goal > 0
    ? goal
    : DEFAULT_DAILY_WATER_GOAL_ML;
}

export async function setDailyWaterGoal(amountMl: number): Promise<void> {
  await setSetting(DAILY_WATER_GOAL_SETTING_KEY, String(amountMl));
}

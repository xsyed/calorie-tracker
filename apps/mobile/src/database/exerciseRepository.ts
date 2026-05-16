import { initDatabase } from './database';
import type { ExerciseEntry } from './types';

function mapRowToExerciseEntry(row: Record<string, unknown>): ExerciseEntry {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    food_entry_id: (row.food_entry_id as string | null) ?? null,
    date: row.date as string,
    exercise_type: row.exercise_type as string,
    duration_minutes: row.duration_minutes as number,
    calories_burned: row.calories_burned as number,
    timestamp: row.timestamp as string,
  };
}

type InsertExerciseEntryData = Omit<ExerciseEntry, 'id' | 'food_entry_id'> & {
  food_entry_id?: string | null;
};

export async function insertExerciseEntry(
  data: InsertExerciseEntryData,
): Promise<ExerciseEntry> {
  const db = initDatabase();
  const id =
    Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  await db.execute(
    `INSERT INTO exercise_entries (id, user_id, food_entry_id, date, exercise_type, duration_minutes, calories_burned, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.user_id,
      data.food_entry_id ?? null,
      data.date,
      data.exercise_type,
      data.duration_minutes,
      data.calories_burned,
      data.timestamp,
    ],
  );
  return { ...data, id, food_entry_id: data.food_entry_id ?? null };
}

export async function getExerciseEntriesByDate(
  userId: string,
  date: string,
): Promise<ExerciseEntry[]> {
  const db = initDatabase();
  const result = await db.execute(
    'SELECT * FROM exercise_entries WHERE user_id = ? AND date = ?',
    [userId, date],
  );
  return (result.rows as Record<string, unknown>[]).map(mapRowToExerciseEntry);
}

export async function getDailyExerciseCalories(
  userId: string,
  date: string,
): Promise<number> {
  const db = initDatabase();
  const result = await db.execute(
    'SELECT COALESCE(SUM(calories_burned), 0) as total FROM exercise_entries WHERE user_id = ? AND date = ?',
    [userId, date],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return (row?.total as number) ?? 0;
}

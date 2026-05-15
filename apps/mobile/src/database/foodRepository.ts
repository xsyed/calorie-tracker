import { initDatabase } from './database';
import type { FoodEntry, FoodItem, ExerciseEntry } from './types';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

function mapRowToFoodEntry(row: Record<string, unknown>): FoodEntry {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    date: row.date as string,
    raw_text: row.raw_text as string,
    status: row.status as FoodEntry['status'],
    retry_count: row.retry_count as number,
    created_at: row.created_at as string,
  };
}

function mapRowToFoodItem(row: Record<string, unknown>): FoodItem {
  return {
    id: row.id as string,
    food_entry_id: row.food_entry_id as string,
    name: row.name as string,
    calories: row.calories as number,
    protein_g: row.protein_g as number,
    carbs_g: row.carbs_g as number,
    fat_g: row.fat_g as number,
  };
}

export async function insertFoodEntry(
  data: Omit<FoodEntry, 'id'>,
): Promise<FoodEntry> {
  const db = initDatabase();
  const id = generateId();
  await db.execute(
    `INSERT INTO food_entries (id, user_id, date, raw_text, status, retry_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.user_id,
      data.date,
      data.raw_text,
      data.status,
      data.retry_count,
      data.created_at,
    ],
  );
  return { id, ...data };
}

export async function insertFoodItem(
  data: Omit<FoodItem, 'id'>,
): Promise<FoodItem> {
  const db = initDatabase();
  const id = generateId();
  await db.execute(
    `INSERT INTO food_items (id, food_entry_id, name, calories, protein_g, carbs_g, fat_g)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.food_entry_id,
      data.name,
      data.calories,
      data.protein_g,
      data.carbs_g,
      data.fat_g,
    ],
  );
  return { id, ...data };
}

export async function getFoodEntriesByDate(
  userId: string,
  date: string,
): Promise<FoodEntry[]> {
  const db = initDatabase();
  const result = await db.execute(
    'SELECT * FROM food_entries WHERE user_id = ? AND date = ? ORDER BY created_at DESC',
    [userId, date],
  );
  return (result.rows as Record<string, unknown>[]).map(mapRowToFoodEntry);
}

export async function getFoodItemsByEntryId(
  foodEntryId: string,
): Promise<FoodItem[]> {
  const db = initDatabase();
  const result = await db.execute(
    'SELECT * FROM food_items WHERE food_entry_id = ?',
    [foodEntryId],
  );
  return (result.rows as Record<string, unknown>[]).map(mapRowToFoodItem);
}

export async function getPendingEntries(): Promise<FoodEntry[]> {
  const db = initDatabase();
  const result = await db.execute(
    "SELECT * FROM food_entries WHERE status = 'pending' ORDER BY created_at ASC",
    [],
  );
  return (result.rows as Record<string, unknown>[]).map(mapRowToFoodEntry);
}

export async function updateFoodEntryStatus(
  id: string,
  status: 'complete' | 'failed',
): Promise<void> {
  const db = initDatabase();
  await db.execute('UPDATE food_entries SET status = ? WHERE id = ?', [
    status,
    id,
  ]);
}

export async function incrementRetryCount(id: string): Promise<void> {
  const db = initDatabase();
  await db.execute(
    'UPDATE food_entries SET retry_count = retry_count + 1 WHERE id = ?',
    [id],
  );
}

export async function completePendingEntry(
  entryId: string,
  userId: string,
  date: string,
  foods: Array<{
    name: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }>,
  exercises: Array<{
    exercise_type: string;
    duration_minutes: number;
    calories_burned: number;
  }>,
): Promise<void> {
  const db = initDatabase();

  await db.execute('BEGIN', []);

  try {
    await db.execute(
      "UPDATE food_entries SET status = 'complete' WHERE id = ?",
      [entryId],
    );

    for (const food of foods) {
      const itemId = generateId();
      await db.execute(
        `INSERT INTO food_items (id, food_entry_id, name, calories, protein_g, carbs_g, fat_g)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          entryId,
          food.name,
          food.calories,
          food.protein_g,
          food.carbs_g,
          food.fat_g,
        ],
      );
    }

    const timestamp = new Date().toISOString();
    for (const exercise of exercises) {
      const exerciseEntryId = generateId();
      await db.execute(
        `INSERT INTO exercise_entries (id, user_id, date, exercise_type, duration_minutes, calories_burned, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          exerciseEntryId,
          userId,
          date,
          exercise.exercise_type,
          exercise.duration_minutes,
          exercise.calories_burned,
          timestamp,
        ],
      );
    }

    await db.execute('COMMIT', []);
  } catch (error) {
    await db.execute('ROLLBACK', []);
    throw error;
  }
}

interface DailyTotals {
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
}

export async function getDailyCalorieTotals(
  userId: string,
  date: string,
): Promise<DailyTotals> {
  const db = initDatabase();
  const result = await db.execute(
    `SELECT
       COALESCE(SUM(fi.calories), 0) AS total_calories,
       COALESCE(SUM(fi.protein_g), 0) AS total_protein,
       COALESCE(SUM(fi.carbs_g), 0) AS total_carbs,
       COALESCE(SUM(fi.fat_g), 0) AS total_fat
     FROM food_entries fe
     JOIN food_items fi ON fi.food_entry_id = fe.id
     WHERE fe.user_id = ? AND fe.date = ? AND fe.status = 'complete'`,
    [userId, date],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return {
    total_calories: (row?.total_calories as number) ?? 0,
    total_protein: (row?.total_protein as number) ?? 0,
    total_carbs: (row?.total_carbs as number) ?? 0,
    total_fat: (row?.total_fat as number) ?? 0,
  };
}

export async function getLoggedDatesInRange(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<string[]> {
  const db = initDatabase();
  const result = await db.execute(
    `SELECT DISTINCT date
     FROM food_entries
     WHERE user_id = ? AND date BETWEEN ? AND ? AND status = 'complete'
     ORDER BY date ASC`,
    [userId, startDate, endDate],
  );
  return (result.rows as Record<string, unknown>[]).map(
    (row) => row.date as string,
  );
}

export async function saveParsedLogEntry(params: {
  userId: string;
  date: string;
  rawText: string;
  foods: Array<{
    name: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }>;
  exercises: Array<{
    exercise_type: string;
    duration_minutes: number;
    calories_burned: number;
  }>;
}): Promise<{
  foodEntry: FoodEntry;
  foodItems: FoodItem[];
  exerciseEntries: ExerciseEntry[];
}> {
  const db = initDatabase();
  const foodEntryId = generateId();
  const createdAt = new Date().toISOString();

  await db.execute('BEGIN', []);

  try {
    await db.execute(
      `INSERT INTO food_entries (id, user_id, date, raw_text, status, retry_count, created_at)
       VALUES (?, ?, ?, ?, 'complete', 0, ?)`,
      [foodEntryId, params.userId, params.date, params.rawText, createdAt],
    );

    const foodItems: FoodItem[] = [];
    for (const food of params.foods) {
      const itemId = generateId();
      await db.execute(
        `INSERT INTO food_items (id, food_entry_id, name, calories, protein_g, carbs_g, fat_g)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          foodEntryId,
          food.name,
          food.calories,
          food.protein_g,
          food.carbs_g,
          food.fat_g,
        ],
      );
      foodItems.push({
        id: itemId,
        food_entry_id: foodEntryId,
        name: food.name,
        calories: food.calories,
        protein_g: food.protein_g,
        carbs_g: food.carbs_g,
        fat_g: food.fat_g,
      });
    }

    const exerciseEntries: ExerciseEntry[] = [];
    const timestamp = new Date().toISOString();
    for (const exercise of params.exercises) {
      const entryId = generateId();
      await db.execute(
        `INSERT INTO exercise_entries (id, user_id, date, exercise_type, duration_minutes, calories_burned, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          entryId,
          params.userId,
          params.date,
          exercise.exercise_type,
          exercise.duration_minutes,
          exercise.calories_burned,
          timestamp,
        ],
      );
      exerciseEntries.push({
        id: entryId,
        user_id: params.userId,
        date: params.date,
        exercise_type: exercise.exercise_type,
        duration_minutes: exercise.duration_minutes,
        calories_burned: exercise.calories_burned,
        timestamp,
      });
    }

    await db.execute('COMMIT', []);

    return {
      foodEntry: {
        id: foodEntryId,
        user_id: params.userId,
        date: params.date,
        raw_text: params.rawText,
        status: 'complete',
        retry_count: 0,
        created_at: createdAt,
      },
      foodItems,
      exerciseEntries,
    };
  } catch (error) {
    await db.execute('ROLLBACK', []);
    throw error;
  }
}

import { initDatabase } from './database';
import type { ExerciseEntry, FoodEntry, FoodItem } from './types';

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

export async function getFoodEntryForUser(
  userId: string,
  foodEntryId: string,
): Promise<FoodEntry | null> {
  const db = initDatabase();
  const result = await db.execute(
    'SELECT * FROM food_entries WHERE id = ? AND user_id = ?',
    [foodEntryId, userId],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapRowToFoodEntry(row) : null;
}

export async function replaceFoodEntryParsedData(params: {
  userId: string;
  foodEntryId: string;
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

  await db.execute('BEGIN', []);

  try {
    const result = await db.execute(
      "SELECT * FROM food_entries WHERE id = ? AND user_id = ? AND status = 'complete'",
      [params.foodEntryId, params.userId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) {
      throw new Error('Food entry not found.');
    }

    const existingEntry = mapRowToFoodEntry(row);

    await db.execute('DELETE FROM food_items WHERE food_entry_id = ?', [
      params.foodEntryId,
    ]);
    await db.execute(
      'DELETE FROM exercise_entries WHERE user_id = ? AND food_entry_id = ?',
      [params.userId, params.foodEntryId],
    );
    await db.execute(
      "UPDATE food_entries SET raw_text = ?, status = 'complete' WHERE id = ? AND user_id = ?",
      [params.rawText, params.foodEntryId, params.userId],
    );

    const foodItems: FoodItem[] = [];
    for (const food of params.foods) {
      const itemId = generateId();
      await db.execute(
        `INSERT INTO food_items (id, food_entry_id, name, calories, protein_g, carbs_g, fat_g)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          params.foodEntryId,
          food.name,
          food.calories,
          food.protein_g,
          food.carbs_g,
          food.fat_g,
        ],
      );
      foodItems.push({
        id: itemId,
        food_entry_id: params.foodEntryId,
        name: food.name,
        calories: food.calories,
        protein_g: food.protein_g,
        carbs_g: food.carbs_g,
        fat_g: food.fat_g,
      });
    }

    const timestamp = new Date().toISOString();
    const exerciseEntries: ExerciseEntry[] = [];
    for (const exercise of params.exercises) {
      const entryId = generateId();
      await db.execute(
        `INSERT INTO exercise_entries (id, user_id, food_entry_id, date, exercise_type, duration_minutes, calories_burned, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entryId,
          params.userId,
          params.foodEntryId,
          existingEntry.date,
          exercise.exercise_type,
          exercise.duration_minutes,
          exercise.calories_burned,
          timestamp,
        ],
      );
      exerciseEntries.push({
        id: entryId,
        user_id: params.userId,
        food_entry_id: params.foodEntryId,
        date: existingEntry.date,
        exercise_type: exercise.exercise_type,
        duration_minutes: exercise.duration_minutes,
        calories_burned: exercise.calories_burned,
        timestamp,
      });
    }

    await db.execute('COMMIT', []);

    return {
      foodEntry: {
        ...existingEntry,
        raw_text: params.rawText,
        status: 'complete',
      },
      foodItems,
      exerciseEntries,
    };
  } catch (error) {
    await db.execute('ROLLBACK', []);
    throw error;
  }
}

import type { DB } from '@op-engineering/op-sqlite';

import { initDatabase } from './database';
import type {
  FoodEntry,
  FoodEntryWithItems,
  FoodItem,
  SavedMeal,
  SavedMealItem,
  SavedMealWithItems,
} from './types';

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

function mapRowToSavedMeal(row: Record<string, unknown>): SavedMeal {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    name: row.name as string,
    created_at: row.created_at as string,
  };
}

function mapRowToSavedMealItem(row: Record<string, unknown>): SavedMealItem {
  return {
    id: row.id as string,
    saved_meal_id: row.saved_meal_id as string,
    name: row.name as string,
    calories: row.calories as number,
    protein_g: row.protein_g as number,
    carbs_g: row.carbs_g as number,
    fat_g: row.fat_g as number,
  };
}

async function withTransaction<T>(
  db: DB,
  operation: () => Promise<T>,
): Promise<T> {
  await db.execute('BEGIN', []);

  try {
    const result = await operation();
    await db.execute('COMMIT', []);
    return result;
  } catch (error) {
    await db.execute('ROLLBACK', []);
    throw error;
  }
}

async function getCompletedFoodEntry(
  db: DB,
  userId: string,
  foodEntryId: string,
): Promise<FoodEntry> {
  const result = await db.execute(
    "SELECT * FROM food_entries WHERE id = ? AND user_id = ? AND status = 'complete'",
    [foodEntryId, userId],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    throw new Error('Completed food entry not found.');
  }
  return mapRowToFoodEntry(row);
}

async function getFoodItemsForEntries(
  db: DB,
  userId: string,
  foodEntryIds: string[],
): Promise<FoodItem[]> {
  if (foodEntryIds.length === 0) return [];

  const placeholders = foodEntryIds.map(() => '?').join(', ');
  const result = await db.execute(
    `SELECT fi.*
     FROM food_items fi
     JOIN food_entries fe ON fe.id = fi.food_entry_id
     WHERE fe.user_id = ? AND fi.food_entry_id IN (${placeholders})
     ORDER BY fi.rowid ASC`,
    [userId, ...foodEntryIds],
  );
  return (result.rows as Record<string, unknown>[]).map(mapRowToFoodItem);
}

function attachItemsToEntries(
  entries: FoodEntry[],
  items: FoodItem[],
): FoodEntryWithItems[] {
  const itemsByEntryId = new Map<string, FoodItem[]>();

  for (const item of items) {
    const entryItems = itemsByEntryId.get(item.food_entry_id) ?? [];
    entryItems.push(item);
    itemsByEntryId.set(item.food_entry_id, entryItems);
  }

  return entries.map((entry) => ({
    entry,
    items: itemsByEntryId.get(entry.id) ?? [],
  }));
}

function groupSavedMealRows(
  rows: Record<string, unknown>[],
): SavedMealWithItems[] {
  const meals = new Map<string, SavedMealWithItems>();

  for (const row of rows) {
    const savedMealId = row.saved_meal_id as string;
    const existing = meals.get(savedMealId);
    const meal =
      existing ??
      {
        savedMeal: mapRowToSavedMeal({
          id: savedMealId,
          user_id: row.user_id,
          name: row.saved_meal_name,
          created_at: row.saved_meal_created_at,
        }),
        items: [],
      };

    if (typeof row.item_id === 'string') {
      meal.items.push(
        mapRowToSavedMealItem({
          id: row.item_id,
          saved_meal_id: savedMealId,
          name: row.item_name,
          calories: row.calories,
          protein_g: row.protein_g,
          carbs_g: row.carbs_g,
          fat_g: row.fat_g,
        }),
      );
    }

    meals.set(savedMealId, meal);
  }

  return Array.from(meals.values());
}

async function insertFoodItems(
  db: DB,
  foodEntryId: string,
  items: ReadonlyArray<FoodItem | SavedMealItem>,
): Promise<FoodItem[]> {
  const foodItems: FoodItem[] = [];

  for (const item of items) {
    const id = generateId();
    await db.execute(
      `INSERT INTO food_items (id, food_entry_id, name, calories, protein_g, carbs_g, fat_g)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        foodEntryId,
        item.name,
        item.calories,
        item.protein_g,
        item.carbs_g,
        item.fat_g,
      ],
    );
    foodItems.push({
      id,
      food_entry_id: foodEntryId,
      name: item.name,
      calories: item.calories,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fat_g: item.fat_g,
    });
  }

  return foodItems;
}

async function createCompletedFoodEntry(
  db: DB,
  userId: string,
  date: string,
  rawText: string,
  items: ReadonlyArray<FoodItem | SavedMealItem>,
): Promise<FoodEntryWithItems> {
  const foodEntryId = generateId();
  const createdAt = new Date().toISOString();
  await db.execute(
    `INSERT INTO food_entries (id, user_id, date, raw_text, status, retry_count, created_at)
     VALUES (?, ?, ?, ?, 'complete', 0, ?)`,
    [foodEntryId, userId, date, rawText, createdAt],
  );

  const foodItems = await insertFoodItems(db, foodEntryId, items);
  return {
    entry: {
      id: foodEntryId,
      user_id: userId,
      date,
      raw_text: rawText,
      status: 'complete',
      retry_count: 0,
      created_at: createdAt,
    },
    items: foodItems,
  };
}

export async function getCompletedHistoryEntries(
  userId: string,
): Promise<FoodEntryWithItems[]> {
  const db = initDatabase();
  const result = await db.execute(
    `SELECT *
     FROM food_entries
     WHERE user_id = ? AND status = 'complete'
     ORDER BY date DESC, created_at DESC
     LIMIT 100`,
    [userId],
  );
  const entries = (result.rows as Record<string, unknown>[]).map(
    mapRowToFoodEntry,
  );
  const foodEntryIds = entries.map((entry) => entry.id);
  const items = await getFoodItemsForEntries(db, userId, foodEntryIds);
  return attachItemsToEntries(entries, items);
}

export async function getSavedMeals(
  userId: string,
): Promise<SavedMealWithItems[]> {
  const db = initDatabase();
  const result = await db.execute(
    `SELECT
       sm.id AS saved_meal_id,
       sm.user_id,
       sm.name AS saved_meal_name,
       sm.created_at AS saved_meal_created_at,
       smi.id AS item_id,
       smi.name AS item_name,
       smi.calories,
       smi.protein_g,
       smi.carbs_g,
       smi.fat_g
     FROM saved_meals sm
     LEFT JOIN saved_meal_items smi ON smi.saved_meal_id = sm.id
     WHERE sm.user_id = ?
     ORDER BY sm.created_at DESC, smi.rowid ASC`,
    [userId],
  );
  return groupSavedMealRows(result.rows as Record<string, unknown>[]);
}

export async function saveFoodEntryAsSavedMeal(params: {
  userId: string;
  foodEntryId: string;
  name: string;
}): Promise<SavedMealWithItems> {
  const db = initDatabase();

  return withTransaction(db, async () => {
    await getCompletedFoodEntry(db, params.userId, params.foodEntryId);
    const items = await getFoodItemsForEntries(db, params.userId, [
      params.foodEntryId,
    ]);
    const savedMealId = generateId();
    const createdAt = new Date().toISOString();
    await db.execute(
      `INSERT INTO saved_meals (id, user_id, name, created_at)
       VALUES (?, ?, ?, ?)`,
      [savedMealId, params.userId, params.name, createdAt],
    );

    const savedMealItems: SavedMealItem[] = [];
    for (const item of items) {
      const id = generateId();
      await db.execute(
        `INSERT INTO saved_meal_items (id, saved_meal_id, name, calories, protein_g, carbs_g, fat_g)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          savedMealId,
          item.name,
          item.calories,
          item.protein_g,
          item.carbs_g,
          item.fat_g,
        ],
      );
      savedMealItems.push({
        id,
        saved_meal_id: savedMealId,
        name: item.name,
        calories: item.calories,
        protein_g: item.protein_g,
        carbs_g: item.carbs_g,
        fat_g: item.fat_g,
      });
    }

    return {
      savedMeal: {
        id: savedMealId,
        user_id: params.userId,
        name: params.name,
        created_at: createdAt,
      },
      items: savedMealItems,
    };
  });
}

export async function deleteSavedMeal(
  userId: string,
  savedMealId: string,
): Promise<void> {
  const db = initDatabase();

  await withTransaction(db, async () => {
    await db.execute(
      `DELETE FROM saved_meal_items
       WHERE saved_meal_id IN (
         SELECT id FROM saved_meals WHERE id = ? AND user_id = ?
       )`,
      [savedMealId, userId],
    );
    await db.execute('DELETE FROM saved_meals WHERE id = ? AND user_id = ?', [
      savedMealId,
      userId,
    ]);
  });
}

export async function createFoodEntryFromHistoryEntry(params: {
  userId: string;
  sourceFoodEntryId: string;
  date: string;
}): Promise<FoodEntryWithItems> {
  const db = initDatabase();

  return withTransaction(db, async () => {
    const sourceEntry = await getCompletedFoodEntry(
      db,
      params.userId,
      params.sourceFoodEntryId,
    );
    const items = await getFoodItemsForEntries(db, params.userId, [
      params.sourceFoodEntryId,
    ]);
    return createCompletedFoodEntry(
      db,
      params.userId,
      params.date,
      sourceEntry.raw_text,
      items,
    );
  });
}

export async function createFoodEntryFromSavedMeal(params: {
  userId: string;
  savedMealId: string;
  date: string;
}): Promise<FoodEntryWithItems> {
  const db = initDatabase();

  return withTransaction(db, async () => {
    const mealResult = await db.execute(
      'SELECT * FROM saved_meals WHERE id = ? AND user_id = ?',
      [params.savedMealId, params.userId],
    );
    const mealRow = mealResult.rows[0] as Record<string, unknown> | undefined;
    if (!mealRow) {
      throw new Error('Saved meal not found.');
    }

    const itemResult = await db.execute(
      `SELECT smi.*
       FROM saved_meal_items smi
       JOIN saved_meals sm ON sm.id = smi.saved_meal_id
       WHERE sm.user_id = ? AND smi.saved_meal_id = ?
       ORDER BY smi.rowid ASC`,
      [params.userId, params.savedMealId],
    );
    const items = (itemResult.rows as Record<string, unknown>[]).map(
      mapRowToSavedMealItem,
    );
    const savedMeal = mapRowToSavedMeal(mealRow);
    return createCompletedFoodEntry(
      db,
      params.userId,
      params.date,
      savedMeal.name,
      items,
    );
  });
}

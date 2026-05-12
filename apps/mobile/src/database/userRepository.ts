import { initDatabase } from './database';
import type { User } from './types';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

function mapRowToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    firebase_uid: row.firebase_uid as string,
    gender: row.gender as User['gender'],
    height_cm: row.height_cm as number,
    current_weight_kg: row.current_weight_kg as number,
    age: row.age as number,
    goal: row.goal as User['goal'],
    target_weight_kg:
      row.target_weight_kg == null ? null : (row.target_weight_kg as number),
    timeframe_days:
      row.timeframe_days == null ? null : (row.timeframe_days as number),
    daily_target_calories:
      row.daily_target_calories == null
        ? null
        : (row.daily_target_calories as number),
    protein_g: row.protein_g == null ? null : (row.protein_g as number),
    carbs_g: row.carbs_g == null ? null : (row.carbs_g as number),
    fat_g: row.fat_g == null ? null : (row.fat_g as number),
  };
}

export async function userExists(firebaseUid: string): Promise<boolean> {
  const db = initDatabase();
  const result = await db.execute(
    'SELECT 1 FROM User WHERE firebase_uid = ? LIMIT 1',
    [firebaseUid],
  );
  return result.rows.length > 0;
}

export async function insertUser(data: Omit<User, 'id'>): Promise<User> {
  const db = initDatabase();
  const id = generateId();
  await db.execute(
    `INSERT INTO User (id, firebase_uid, gender, height_cm, current_weight_kg, age, goal,
       target_weight_kg, timeframe_days, daily_target_calories, protein_g, carbs_g, fat_g)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.firebase_uid,
      data.gender,
      data.height_cm,
      data.current_weight_kg,
      data.age,
      data.goal,
      data.target_weight_kg,
      data.timeframe_days,
      data.daily_target_calories,
      data.protein_g,
      data.carbs_g,
      data.fat_g,
    ],
  );
  return { id, ...data };
}

export async function getUser(firebaseUid: string): Promise<User | null> {
  const db = initDatabase();
  const result = await db.execute(
    'SELECT * FROM User WHERE firebase_uid = ? LIMIT 1',
    [firebaseUid],
  );
  if (result.rows.length === 0) return null;
  return mapRowToUser(result.rows[0] as Record<string, unknown>);
}

import { initDatabase } from './database';

export async function getSetting(key: string): Promise<string | null> {
  const db = initDatabase();
  const result = await db.execute(
    'SELECT value FROM app_settings WHERE key = ? LIMIT 1',
    [key],
  );
  if (result.rows.length === 0) return null;
  return (result.rows[0] as Record<string, unknown>).value as string;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = initDatabase();
  await db.execute(
    'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
    [key, value],
  );
}

import { initDatabase } from './database';

export async function userExists(firebaseUid: string): Promise<boolean> {
  const db = initDatabase();
  const result = await db.execute(
    'SELECT 1 FROM User WHERE firebase_uid = ? LIMIT 1',
    [firebaseUid],
  );
  return result.rows.length > 0;
}

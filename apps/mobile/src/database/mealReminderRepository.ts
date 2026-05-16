import { initDatabase } from './database';
import type {
  MealReminder,
  MealReminderPreferences,
  MealReminderType,
  ReminderWeekday,
} from './types';

export type MealReminderWrite = Omit<MealReminder, 'id' | 'user_id'>;

const DEFAULT_REMINDER_DAYS: ReminderWeekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const DEFAULT_REMINDERS: ReadonlyArray<Omit<MealReminder, 'id' | 'user_id'>> = [
  {
    reminder_type: 'breakfast',
    local_time: '08:00',
    enabled: true,
    enabled_days: DEFAULT_REMINDER_DAYS,
  },
  {
    reminder_type: 'lunch',
    local_time: '13:00',
    enabled: true,
    enabled_days: DEFAULT_REMINDER_DAYS,
  },
  {
    reminder_type: 'dinner',
    local_time: '19:00',
    enabled: true,
    enabled_days: DEFAULT_REMINDER_DAYS,
  },
];

const REMINDER_TYPES: MealReminderType[] = ['breakfast', 'lunch', 'dinner'];
const WEEKDAYS: ReminderWeekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

function isReminderType(value: unknown): value is MealReminderType {
  return typeof value === 'string' && REMINDER_TYPES.includes(
    value as MealReminderType,
  );
}

function isWeekday(value: string): value is ReminderWeekday {
  return WEEKDAYS.includes(value as ReminderWeekday);
}

function serializeWeekdays(days: ReminderWeekday[]): string {
  return WEEKDAYS.filter((day) => days.includes(day)).join(',');
}

function parseWeekdays(value: unknown): ReminderWeekday[] {
  if (typeof value !== 'string') return DEFAULT_REMINDER_DAYS;
  return value.split(',').filter(isWeekday);
}

function getDefaultReminders(userId: string): MealReminder[] {
  return DEFAULT_REMINDERS.map((reminder) => ({
    id: null,
    user_id: userId,
    ...reminder,
    enabled_days: [...reminder.enabled_days],
  }));
}

function mapRowToMealReminder(row: Record<string, unknown>): MealReminder | null {
  if (!isReminderType(row.reminder_type)) return null;

  return {
    id: row.id as string,
    user_id: row.user_id as string,
    reminder_type: row.reminder_type,
    local_time: row.local_time as string,
    enabled: row.enabled === 1,
    enabled_days: parseWeekdays(row.enabled_days),
  };
}

export async function getMealReminderPreferences(
  userId: string,
): Promise<MealReminderPreferences> {
  const db = initDatabase();
  const result = await db.execute(
    `SELECT user_id, reminders_enabled
     FROM meal_reminder_settings
     WHERE user_id = ?
     LIMIT 1`,
    [userId],
  );

  if (result.rows.length === 0) {
    return { user_id: userId, reminders_enabled: true };
  }

  const row = result.rows[0] as Record<string, unknown>;
  return {
    user_id: row.user_id as string,
    reminders_enabled: row.reminders_enabled === 1,
  };
}

export async function getUsersWithEnabledMealReminderPreferences(): Promise<string[]> {
  const db = initDatabase();
  const result = await db.execute(
    `SELECT user_id
     FROM meal_reminder_settings
     WHERE reminders_enabled = 1`,
  );

  return (result.rows as Record<string, unknown>[])
    .map((row) => row.user_id)
    .filter((userId): userId is string => typeof userId === 'string');
}

export async function setMealReminderPreferences(
  preferences: MealReminderPreferences,
): Promise<void> {
  const db = initDatabase();
  await db.execute(
    `INSERT OR REPLACE INTO meal_reminder_settings (
       user_id,
       reminders_enabled
     )
     VALUES (?, ?)`,
    [preferences.user_id, preferences.reminders_enabled ? 1 : 0],
  );
}

export async function getMealReminders(userId: string): Promise<MealReminder[]> {
  const db = initDatabase();
  const result = await db.execute(
    `SELECT id, user_id, reminder_type, local_time, enabled, enabled_days
     FROM meal_reminders
     WHERE user_id = ?
     ORDER BY CASE reminder_type
       WHEN 'breakfast' THEN 1
       WHEN 'lunch' THEN 2
       WHEN 'dinner' THEN 3
       ELSE 4
     END`,
    [userId],
  );

  const savedReminders = (result.rows as Record<string, unknown>[])
    .map(mapRowToMealReminder)
    .filter((reminder): reminder is MealReminder => reminder !== null);

  if (savedReminders.length === 0) return getDefaultReminders(userId);

  const savedByType = new Map<MealReminderType, MealReminder>(
    savedReminders.map((reminder) => [reminder.reminder_type, reminder]),
  );

  return getDefaultReminders(userId).map(
    (reminder) => savedByType.get(reminder.reminder_type) ?? reminder,
  );
}

export async function saveMealReminder(
  userId: string,
  reminder: MealReminderWrite,
): Promise<MealReminder> {
  const db = initDatabase();
  const existingResult = await db.execute(
    `SELECT id
     FROM meal_reminders
     WHERE user_id = ? AND reminder_type = ?
     LIMIT 1`,
    [userId, reminder.reminder_type],
  );
  const existingRow = existingResult.rows[0] as
    | Record<string, unknown>
    | undefined;
  const id = existingRow == null ? generateId() : (existingRow.id as string);

  await db.execute(
    `INSERT INTO meal_reminders (
       id,
       user_id,
       reminder_type,
       local_time,
       enabled,
       enabled_days
     )
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, reminder_type) DO UPDATE SET
       local_time = excluded.local_time,
       enabled = excluded.enabled,
       enabled_days = excluded.enabled_days`,
    [
      id,
      userId,
      reminder.reminder_type,
      reminder.local_time,
      reminder.enabled ? 1 : 0,
      serializeWeekdays(reminder.enabled_days),
    ],
  );

  return {
    id,
    user_id: userId,
    ...reminder,
    enabled_days: [...reminder.enabled_days],
  };
}

export async function disableMealReminder(
  userId: string,
  reminderType: MealReminderType,
): Promise<void> {
  const reminders = await getMealReminders(userId);
  const reminder = reminders.find(
    (currentReminder) => currentReminder.reminder_type === reminderType,
  );
  if (reminder == null) return;

  await saveMealReminder(userId, {
    reminder_type: reminder.reminder_type,
    local_time: reminder.local_time,
    enabled: false,
    enabled_days: reminder.enabled_days,
  });
}

export async function deleteMealReminder(
  userId: string,
  reminderType: MealReminderType,
): Promise<void> {
  const db = initDatabase();
  await db.execute(
    'DELETE FROM meal_reminders WHERE user_id = ? AND reminder_type = ?',
    [userId, reminderType],
  );
}

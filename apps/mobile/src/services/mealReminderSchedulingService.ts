import notifee, {
  RepeatFrequency,
  TriggerType,
  type Notification,
  type TimestampTrigger,
  type TriggerNotification,
} from '@notifee/react-native';

import {
  getMealReminderPreferences,
  getMealReminders,
  type MealReminder,
  type ReminderWeekday,
} from '../database';

import {
  ensureMealReminderNotificationChannel,
  MEAL_REMINDERS_CHANNEL_ID,
} from './notificationService';

const MEAL_REMINDER_NOTIFICATION_KIND = 'meal-reminder';
const MEAL_REMINDER_ROUTE = 'Home';
const MEAL_REMINDER_TITLE = 'Time to log your meal';
const IOS_SAFE_PENDING_NOTIFICATION_LIMIT = 60;

const WEEKDAY_TO_JS_DAY: Record<ReminderWeekday, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export type MealReminderSchedulingErrorCode = 'pending-notification-limit';

export interface MealReminderScheduleResult {
  scheduledCount: number;
  cancelledCount: number;
  pendingCount: number;
}

export class MealReminderSchedulingError extends Error {
  constructor(
    public readonly code: MealReminderSchedulingErrorCode,
    message: string,
  ) {
    super(message);
  }
}

interface ReminderScheduleRequest {
  reminder: MealReminder;
  weekday: ReminderWeekday;
}

export async function rescheduleMealReminders(
  userId: string,
): Promise<MealReminderScheduleResult> {
  await ensureMealReminderNotificationChannel();

  const pendingNotifications = await notifee.getTriggerNotifications();
  const mealNotificationIds = getMealReminderNotificationIds(pendingNotifications);
  await cancelMealReminderNotifications(mealNotificationIds);

  const preferences = await getMealReminderPreferences(userId);
  if (!preferences.reminders_enabled) {
    return buildResult(0, mealNotificationIds.length);
  }

  const reminders = await getMealReminders(userId);
  const scheduleRequests = getReminderScheduleRequests(reminders);
  await assertSafePendingNotificationCount(pendingNotifications, mealNotificationIds.length, scheduleRequests.length);

  await Promise.all(scheduleRequests.map((request) => scheduleMealReminder(userId, request)));

  return buildResult(scheduleRequests.length, mealNotificationIds.length);
}

export async function cancelScheduledMealReminders(): Promise<number> {
  const pendingNotifications = await notifee.getTriggerNotifications();
  const notificationIds = getMealReminderNotificationIds(pendingNotifications);
  await cancelMealReminderNotifications(notificationIds);
  return notificationIds.length;
}

function getMealReminderNotificationIds(
  pendingNotifications: TriggerNotification[],
): string[] {
  return pendingNotifications
    .filter(isMealReminderNotification)
    .map((triggerNotification) => triggerNotification.notification.id)
    .filter((id): id is string => id != null);
}

function isMealReminderNotification(
  triggerNotification: TriggerNotification,
): boolean {
  return triggerNotification.notification.data?.kind === MEAL_REMINDER_NOTIFICATION_KIND;
}

async function cancelMealReminderNotifications(notificationIds: string[]): Promise<void> {
  if (notificationIds.length === 0) return;

  await notifee.cancelTriggerNotifications(notificationIds);
}

function getReminderScheduleRequests(
  reminders: MealReminder[],
): ReminderScheduleRequest[] {
  return reminders.flatMap((reminder) => {
    if (!reminder.enabled) return [];

    return reminder.enabled_days.map((weekday) => ({
      reminder,
      weekday,
    }));
  });
}

async function assertSafePendingNotificationCount(
  pendingNotifications: TriggerNotification[],
  cancelledCount: number,
  scheduledCount: number,
): Promise<void> {
  const pendingCount = pendingNotifications.length - cancelledCount + scheduledCount;
  if (pendingCount <= IOS_SAFE_PENDING_NOTIFICATION_LIMIT) return;

  throw new MealReminderSchedulingError(
    'pending-notification-limit',
    `Meal reminders would leave ${pendingCount} pending notifications, above the safe limit of ${IOS_SAFE_PENDING_NOTIFICATION_LIMIT}.`,
  );
}

async function scheduleMealReminder(
  userId: string,
  request: ReminderScheduleRequest,
): Promise<void> {
  await notifee.createTriggerNotification(
    buildNotification(userId, request),
    buildWeeklyTrigger(request),
  );
}

function buildNotification(
  userId: string,
  { reminder, weekday }: ReminderScheduleRequest,
): Notification {
  const reminderId = reminder.id ?? reminder.reminder_type;

  return {
    id: `meal-reminder:${userId}:${reminderId}:${weekday}`,
    title: MEAL_REMINDER_TITLE,
    body: `Log your ${reminder.reminder_type}`,
    data: {
      kind: MEAL_REMINDER_NOTIFICATION_KIND,
      route: MEAL_REMINDER_ROUTE,
      userId,
      reminderId,
      reminderType: reminder.reminder_type,
      weekday,
    },
    android: {
      channelId: MEAL_REMINDERS_CHANNEL_ID,
      pressAction: {
        id: 'default',
      },
    },
  };
}

function buildWeeklyTrigger(
  { reminder, weekday }: ReminderScheduleRequest,
): TimestampTrigger {
  return {
    type: TriggerType.TIMESTAMP,
    timestamp: getNextReminderTimestamp(reminder.local_time, weekday),
    repeatFrequency: RepeatFrequency.WEEKLY,
  };
}

function getNextReminderTimestamp(localTime: string, weekday: ReminderWeekday): number {
  const now = new Date();
  const [hours, minutes] = parseLocalTime(localTime);
  const nextDate = new Date(now);
  const targetDay = WEEKDAY_TO_JS_DAY[weekday];
  const dayDelta = (targetDay - now.getDay() + 7) % 7;

  nextDate.setDate(now.getDate() + dayDelta);
  nextDate.setHours(hours, minutes, 0, 0);

  if (nextDate.getTime() <= now.getTime()) {
    nextDate.setDate(nextDate.getDate() + 7);
  }

  return nextDate.getTime();
}

function parseLocalTime(localTime: string): [number, number] {
  const [hours, minutes] = localTime.split(':').map(Number);

  if (!isValidTimePart(hours, 23) || !isValidTimePart(minutes, 59)) {
    throw new Error(`Invalid meal reminder time: ${localTime}`);
  }

  return [hours, minutes];
}

function isValidTimePart(value: number | undefined, max: number): value is number {
  if (value == null) return false;

  return Number.isInteger(value) && value >= 0 && value <= max;
}

async function buildResult(
  scheduledCount: number,
  cancelledCount: number,
): Promise<MealReminderScheduleResult> {
  return {
    scheduledCount,
    cancelledCount,
    pendingCount: (await notifee.getTriggerNotificationIds()).length,
  };
}

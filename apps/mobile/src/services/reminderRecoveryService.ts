import { Platform } from 'react-native';

import { getUsersWithEnabledMealReminderPreferences } from '../database';

import { rescheduleMealReminders } from './mealReminderSchedulingService';
import { getNotificationPermissionStatus } from './notificationService';

export type MealReminderRecoverySource = 'android-boot' | 'database-restore';
export type MealReminderRecoveryStatus = 'recovered' | 'skipped' | 'failed';

export interface MealReminderRecoveryResult {
  recoveredUserCount: number;
  source: MealReminderRecoverySource;
  status: MealReminderRecoveryStatus;
}

interface MealReminderRecoveryHeadlessTaskData {
  source?: unknown;
}

export async function recoverMealReminderScheduleForUser(
  userId: string,
  source: MealReminderRecoverySource,
): Promise<MealReminderRecoveryResult> {
  return recoverMealReminderSchedules([userId], source);
}

export async function recoverEnabledMealReminderSchedules(
  source: MealReminderRecoverySource,
): Promise<MealReminderRecoveryResult> {
  const userIds = await getUsersWithEnabledMealReminderPreferences();
  return recoverMealReminderSchedules(userIds, source);
}

export async function runMealReminderRecoveryHeadlessTask(
  data: MealReminderRecoveryHeadlessTaskData,
): Promise<void> {
  if (Platform.OS !== 'android') return;

  const source = data.source === 'android-boot' ? data.source : 'android-boot';
  await recoverEnabledMealReminderSchedules(source);
}

async function recoverMealReminderSchedules(
  userIds: string[],
  source: MealReminderRecoverySource,
): Promise<MealReminderRecoveryResult> {
  try {
    const permissionStatus = await getNotificationPermissionStatus();
    if (!permissionStatus.canScheduleMealReminders) {
      return {
        recoveredUserCount: 0,
        source,
        status: 'skipped',
      };
    }

    await Promise.all(userIds.map(rescheduleMealReminders));
    return {
      recoveredUserCount: userIds.length,
      source,
      status: 'recovered',
    };
  } catch {
    return {
      recoveredUserCount: 0,
      source,
      status: 'failed',
    };
  }
}

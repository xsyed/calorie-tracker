import notifee, {
  AndroidNotificationSetting,
  AndroidImportance,
  AuthorizationStatus,
  type NotificationSettings,
} from '@notifee/react-native';
import { Platform } from 'react-native';

export const MEAL_REMINDERS_CHANNEL_ID = 'meal-reminders';

export type NotificationPermissionState =
  | 'authorized'
  | 'alarm-disabled'
  | 'blocked'
  | 'channel-blocked'
  | 'denied'
  | 'not-determined'
  | 'provisional';

export interface NotificationPermissionStatus {
  state: NotificationPermissionState;
  canScheduleMealReminders: boolean;
}

const IOS_ALERT_PERMISSIONS = {
  alert: true,
  badge: true,
  sound: true,
  criticalAlert: false,
};

export async function ensureMealReminderNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await notifee.createChannel({
    id: MEAL_REMINDERS_CHANNEL_ID,
    name: 'Meal reminders',
    importance: AndroidImportance.DEFAULT,
    sound: 'default',
    vibration: true,
  });
}

export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  await ensureMealReminderNotificationChannel();

  const settings = await notifee.getNotificationSettings();
  const state = await resolveNotificationPermissionState(settings);

  return {
    state,
    canScheduleMealReminders: state === 'authorized' || state === 'provisional',
  };
}

export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  await ensureMealReminderNotificationChannel();

  const settings = await notifee.requestPermission(IOS_ALERT_PERMISSIONS);
  const state = await resolveNotificationPermissionState(settings);

  return {
    state,
    canScheduleMealReminders: state === 'authorized' || state === 'provisional',
  };
}

export async function openNotificationSettings(): Promise<void> {
  await notifee.openNotificationSettings();
}

export async function openAlarmPermissionSettings(): Promise<void> {
  await notifee.openAlarmPermissionSettings();
}

export async function openMealReminderChannelSettings(): Promise<void> {
  await ensureMealReminderNotificationChannel();
  await notifee.openNotificationSettings(MEAL_REMINDERS_CHANNEL_ID);
}

async function resolveNotificationPermissionState(
  settings: NotificationSettings,
): Promise<NotificationPermissionState> {
  const { authorizationStatus } = settings;

  if (authorizationStatus === AuthorizationStatus.NOT_DETERMINED) {
    return 'not-determined';
  }

  if (authorizationStatus === AuthorizationStatus.DENIED) {
    return Platform.OS === 'ios' ? 'blocked' : 'denied';
  }

  if (Platform.OS === 'android' && (await notifee.isChannelBlocked(MEAL_REMINDERS_CHANNEL_ID))) {
    return 'channel-blocked';
  }

  if (
    Platform.OS === 'android' &&
    settings.android.alarm === AndroidNotificationSetting.DISABLED
  ) {
    return 'alarm-disabled';
  }

  if (authorizationStatus === AuthorizationStatus.PROVISIONAL) {
    return 'provisional';
  }

  return 'authorized';
}

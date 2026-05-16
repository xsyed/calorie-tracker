import { NativeModules, Platform } from 'react-native';

import type { BackupPreferences } from '../database';

interface NativePeriodicBackupScheduler {
  configurePeriodicBackup(config: {
    enabled: boolean;
    wifiOnly: boolean;
  }): Promise<void>;
}

const nativeScheduler =
  NativeModules.PeriodicBackupScheduler as NativePeriodicBackupScheduler | undefined;

export async function configurePeriodicBackupSchedule(
  preferences: BackupPreferences,
): Promise<void> {
  if (Platform.OS !== 'android' || nativeScheduler === undefined) return;

  await nativeScheduler.configurePeriodicBackup({
    enabled: preferences.weekly_backup_enabled,
    wifiOnly: preferences.wifi_only,
  });
}

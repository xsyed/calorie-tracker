import { Platform } from 'react-native';
import auth from '@react-native-firebase/auth';

import {
  getBackupMetadata,
  getBackupPreferences,
} from '../database';
import type { BackupMetadata, BackupPreferences } from '../database';
import { checkBackupNetworkConstraints } from './connectivity';
import { configurePeriodicBackupSchedule } from './periodicBackupScheduler';
import { runManualBackup } from './manualBackupService';

export type PeriodicBackupResult =
  | 'disabled'
  | 'not_due'
  | 'network_blocked'
  | 'provider_mismatch'
  | 'attempted'
  | 'unavailable';

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function hasProvider(providerId: string): boolean {
  return auth().currentUser?.providerData.some(
    (provider) => provider.providerId === providerId,
  ) ?? false;
}

export function isPeriodicBackupDue(
  metadata: BackupMetadata,
  now = Date.now(),
): boolean {
  if (metadata.last_backup_at === null) return true;
  const lastBackupAt = Date.parse(metadata.last_backup_at);
  if (!Number.isFinite(lastBackupAt)) return true;
  return now - lastBackupAt > ONE_WEEK_MS;
}

async function canAttemptPeriodicBackup(
  preferences: BackupPreferences,
  metadata: BackupMetadata,
): Promise<PeriodicBackupResult | null> {
  if (!preferences.weekly_backup_enabled) return 'disabled';
  if (!isPeriodicBackupDue(metadata)) return 'not_due';
  if (!await checkBackupNetworkConstraints(preferences)) return 'network_blocked';
  return null;
}

async function runAndroidPeriodicBackup(): Promise<PeriodicBackupResult> {
  if (auth().currentUser === null) return 'provider_mismatch';
  await runManualBackup();
  return 'attempted';
}

function runIosPeriodicBackup(): PeriodicBackupResult {
  if (!hasProvider('apple.com')) return 'provider_mismatch';
  return 'unavailable';
}

export async function syncPeriodicBackupSchedule(): Promise<void> {
  const preferences = await getBackupPreferences();
  await configurePeriodicBackupSchedule(preferences);
}

export async function runPeriodicBackupIfDue(): Promise<PeriodicBackupResult> {
  const [preferences, metadata] = await Promise.all([
    getBackupPreferences(),
    getBackupMetadata(),
  ]);
  const blockedReason = await canAttemptPeriodicBackup(preferences, metadata);
  if (blockedReason !== null) return blockedReason;

  if (Platform.OS === 'android') return runAndroidPeriodicBackup();
  if (Platform.OS === 'ios') return runIosPeriodicBackup();
  return 'unavailable';
}

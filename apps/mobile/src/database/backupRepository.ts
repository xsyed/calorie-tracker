import { getSetting, setSetting } from './appSettingsRepository';
import { initDatabase } from './database';
import type { BackupMetadata, BackupPreferences } from './types';

export type BackupMetadataUpdate = BackupMetadata;

export const DEFAULT_MAX_BACKUP_COUNT = 5;

const BACKUP_METADATA_ID = 'current';
const DEFAULT_BACKUP_METADATA: BackupMetadata = {
  last_backup_at: null,
  last_backup_size_bytes: null,
  last_backup_checksum: null,
  backup_count: 0,
};
const DEFAULT_BACKUP_PREFERENCES: BackupPreferences = {
  weekly_backup_enabled: false,
  wifi_only: true,
  max_backup_count: DEFAULT_MAX_BACKUP_COUNT,
};
const WEEKLY_BACKUP_ENABLED_SETTING_KEY = 'weekly_backup_enabled';
const BACKUP_WIFI_ONLY_SETTING_KEY = 'backup_wifi_only';
const MAX_BACKUP_COUNT_SETTING_KEY = 'max_backup_count';

function mapRowToBackupMetadata(row: Record<string, unknown>): BackupMetadata {
  return {
    last_backup_at:
      row.last_backup_at == null ? null : (row.last_backup_at as string),
    last_backup_size_bytes:
      row.last_backup_size_bytes == null
        ? null
        : (row.last_backup_size_bytes as number),
    last_backup_checksum:
      row.last_backup_checksum == null
        ? null
        : (row.last_backup_checksum as string),
    backup_count: (row.backup_count as number) ?? 0,
  };
}

function parseBooleanSetting(value: string | null, defaultValue: boolean): boolean {
  if (value === null) return defaultValue;
  return value === 'true';
}

function parsePositiveIntegerSetting(
  value: string | null,
  defaultValue: number,
): number {
  if (value === null) return defaultValue;

  const parsedValue = Number(value);
  return Number.isInteger(parsedValue) && parsedValue > 0
    ? parsedValue
    : defaultValue;
}

export async function getBackupMetadata(): Promise<BackupMetadata> {
  const db = initDatabase();
  const result = await db.execute(
    'SELECT last_backup_at, last_backup_size_bytes, last_backup_checksum, backup_count FROM backup_metadata WHERE id = ? LIMIT 1',
    [BACKUP_METADATA_ID],
  );
  if (result.rows.length === 0) return DEFAULT_BACKUP_METADATA;
  return mapRowToBackupMetadata(result.rows[0] as Record<string, unknown>);
}

export async function saveBackupMetadata(
  metadata: BackupMetadataUpdate,
): Promise<void> {
  const db = initDatabase();
  await db.execute(
    `INSERT OR REPLACE INTO backup_metadata (
       id,
       last_backup_at,
       last_backup_size_bytes,
       last_backup_checksum,
       backup_count
     )
     VALUES (?, ?, ?, ?, ?)`,
    [
      BACKUP_METADATA_ID,
      metadata.last_backup_at,
      metadata.last_backup_size_bytes,
      metadata.last_backup_checksum,
      metadata.backup_count,
    ],
  );
}

export async function getBackupPreferences(): Promise<BackupPreferences> {
  const [
    weeklyBackupEnabled,
    wifiOnly,
    maxBackupCount,
  ] = await Promise.all([
    getSetting(WEEKLY_BACKUP_ENABLED_SETTING_KEY),
    getSetting(BACKUP_WIFI_ONLY_SETTING_KEY),
    getSetting(MAX_BACKUP_COUNT_SETTING_KEY),
  ]);

  return {
    weekly_backup_enabled: parseBooleanSetting(
      weeklyBackupEnabled,
      DEFAULT_BACKUP_PREFERENCES.weekly_backup_enabled,
    ),
    wifi_only: parseBooleanSetting(wifiOnly, DEFAULT_BACKUP_PREFERENCES.wifi_only),
    max_backup_count: parsePositiveIntegerSetting(
      maxBackupCount,
      DEFAULT_BACKUP_PREFERENCES.max_backup_count,
    ),
  };
}

export async function setBackupPreferences(
  preferences: BackupPreferences,
): Promise<void> {
  await Promise.all([
    setSetting(
      WEEKLY_BACKUP_ENABLED_SETTING_KEY,
      String(preferences.weekly_backup_enabled),
    ),
    setSetting(BACKUP_WIFI_ONLY_SETTING_KEY, String(preferences.wifi_only)),
    setSetting(MAX_BACKUP_COUNT_SETTING_KEY, String(preferences.max_backup_count)),
  ]);
}

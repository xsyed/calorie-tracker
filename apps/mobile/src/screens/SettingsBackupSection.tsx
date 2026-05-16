import { Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import type { BackupMetadata, BackupPreferences } from '../database';
import type { ManualBackupProgress } from '../services';

interface SettingsBackupSectionProps {
  isDarkMode: boolean;
  metadata: BackupMetadata | null;
  preferences: BackupPreferences | null;
  progress: ManualBackupProgress | null;
  statusMessage: string | null;
  errorMessage: string | null;
  isBackingUp: boolean;
  onCreateBackup: () => void;
  onUpdateBackupPreferences: (preferences: BackupPreferences) => void;
}

export default function SettingsBackupSection({
  isDarkMode,
  metadata,
  preferences,
  progress,
  statusMessage,
  errorMessage,
  isBackingUp,
  onCreateBackup,
  onUpdateBackupPreferences,
}: SettingsBackupSectionProps) {
  const isIos = Platform.OS === 'ios';
  const lastBackupAt = metadata?.last_backup_at ?? null;
  const hasBackup = metadata !== null && lastBackupAt !== null;
  const weeklyBackupEnabled = preferences?.weekly_backup_enabled ?? false;
  const wifiOnly = preferences?.wifi_only ?? true;

  const updateWeeklyBackup = (enabled: boolean) => {
    if (preferences === null) return;
    onUpdateBackupPreferences({ ...preferences, weekly_backup_enabled: enabled });
  };

  const updateWifiOnly = (enabled: boolean) => {
    if (preferences === null) return;
    onUpdateBackupPreferences({ ...preferences, wifi_only: enabled });
  };

  return (
    <View style={[styles.section, isDarkMode && styles.sectionDark]}>
      <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
        Backup
      </Text>
      {isIos ? (
        <>
          <Text style={[styles.helperText, isDarkMode && styles.helperTextDark]}>
            iCloud backup requires Apple Sign-In and iCloud availability.
          </Text>
          <BackupPreferenceToggles
            isDarkMode={isDarkMode}
            preferences={preferences}
            weeklyBackupEnabled={weeklyBackupEnabled}
            wifiOnly={wifiOnly}
            onUpdateWeeklyBackup={updateWeeklyBackup}
            onUpdateWifiOnly={updateWifiOnly}
          />
        </>
      ) : (
        <>
          {hasBackup ? (
            <View style={styles.metadataGroup}>
              <ReadOnlyRow
                label="Last backup"
                value={formatDateTime(lastBackupAt)}
                isDarkMode={isDarkMode}
              />
              <ReadOnlyRow
                label="Age"
                value={formatRelativeAge(lastBackupAt)}
                isDarkMode={isDarkMode}
              />
              <ReadOnlyRow
                label="Size"
                value={formatBytes(metadata.last_backup_size_bytes)}
                isDarkMode={isDarkMode}
              />
              <ReadOnlyRow
                label="Stored backups"
                value={String(metadata.backup_count)}
                isDarkMode={isDarkMode}
              />
            </View>
          ) : (
            <Text style={[styles.helperText, isDarkMode && styles.helperTextDark]}>
              No backups yet. Create one before changing devices or reinstalling.
            </Text>
          )}

          {progress !== null && (
            <Text style={[styles.progressText, isDarkMode && styles.progressTextDark]}>
              {formatProgress(progress)}
            </Text>
          )}
          {statusMessage !== null && (
            <Text style={styles.successText}>{statusMessage}</Text>
          )}
          {errorMessage !== null && (
            <Text style={styles.errorText}>{errorMessage}</Text>
          )}

          <Pressable
            style={[styles.primaryButton, isBackingUp && styles.buttonDisabled]}
            disabled={isBackingUp}
            accessibilityRole="button"
            accessibilityState={{ disabled: isBackingUp }}
            onPress={onCreateBackup}
          >
            <Text style={styles.primaryButtonText}>
              {isBackingUp ? 'Creating Backup...' : 'Create Backup Now'}
            </Text>
          </Pressable>

          <BackupPreferenceToggles
            isDarkMode={isDarkMode}
            preferences={preferences}
            weeklyBackupEnabled={weeklyBackupEnabled}
            wifiOnly={wifiOnly}
            onUpdateWeeklyBackup={updateWeeklyBackup}
            onUpdateWifiOnly={updateWifiOnly}
          />
        </>
      )}
    </View>
  );
}

interface BackupPreferenceTogglesProps {
  isDarkMode: boolean;
  preferences: BackupPreferences | null;
  weeklyBackupEnabled: boolean;
  wifiOnly: boolean;
  onUpdateWeeklyBackup: (enabled: boolean) => void;
  onUpdateWifiOnly: (enabled: boolean) => void;
}

function BackupPreferenceToggles({
  isDarkMode,
  preferences,
  weeklyBackupEnabled,
  wifiOnly,
  onUpdateWeeklyBackup,
  onUpdateWifiOnly,
}: BackupPreferenceTogglesProps) {
  return (
    <>
      <View style={styles.toggleRow}>
        <View style={styles.toggleTextGroup}>
          <Text style={[styles.rowLabel, isDarkMode && styles.rowLabelDark]}>
            Weekly backup
          </Text>
          <Text style={[styles.helperText, isDarkMode && styles.helperTextDark]}>
            Runs when last successful backup is more than one week old.
          </Text>
        </View>
        <Switch
          value={weeklyBackupEnabled}
          disabled={preferences === null}
          accessibilityLabel="Weekly backup"
          accessibilityHint="Enable automatic weekly backup."
          onValueChange={onUpdateWeeklyBackup}
        />
      </View>

      <View style={styles.toggleRow}>
        <View style={styles.toggleTextGroup}>
          <Text style={[styles.rowLabel, isDarkMode && styles.rowLabelDark]}>
            WiFi-only backup
          </Text>
          <Text style={[styles.helperText, isDarkMode && styles.helperTextDark]}>
            Periodic backup waits for WiFi when enabled.
          </Text>
        </View>
        <Switch
          value={wifiOnly}
          disabled={preferences === null || !weeklyBackupEnabled}
          accessibilityLabel="WiFi-only backup"
          accessibilityHint="Require WiFi for automatic backup."
          onValueChange={onUpdateWifiOnly}
        />
      </View>
    </>
  );
}

interface ReadOnlyRowProps {
  label: string;
  value: string;
  isDarkMode: boolean;
}

function ReadOnlyRow({ label, value, isDarkMode }: ReadOnlyRowProps) {
  return (
    <View style={styles.readOnlyRow}>
      <Text style={[styles.rowLabel, isDarkMode && styles.rowLabelDark]}>
        {label}
      </Text>
      <Text style={[styles.rowValue, isDarkMode && styles.rowValueDark]}>
        {value}
      </Text>
    </View>
  );
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatRelativeAge(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return 'Unknown age';
  const elapsedMs = Math.max(Date.now() - timestamp, 0);
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  if (elapsedMinutes < 1) return 'Just now';
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 30) return `${elapsedDays}d ago`;
  const elapsedMonths = Math.floor(elapsedDays / 30);
  if (elapsedMonths < 12) return `${elapsedMonths}mo ago`;
  return `${Math.floor(elapsedMonths / 12)}y ago`;
}

function formatProgress(progress: ManualBackupProgress): string {
  if (progress.step === 'uploading' && progress.totalBytes !== undefined) {
    const percent = Math.min(
      100,
      Math.round(((progress.bytesSent ?? 0) / progress.totalBytes) * 100),
    );
    return `Uploading backup ${percent}%`;
  }
  return BACKUP_STEP_LABELS[progress.step];
}

const BACKUP_STEP_LABELS: Record<ManualBackupProgress['step'], string> = {
  checking_connectivity: 'Checking internet connection...',
  checking_identity: 'Checking signed-in account...',
  verifying_drive_access: 'Checking Google Drive access...',
  creating_snapshot: 'Preparing local data...',
  uploading: 'Uploading backup...',
  cleaning_old_backups: 'Cleaning old backups...',
  saving_metadata: 'Saving backup details...',
  complete: 'Backup complete.',
};

const styles = StyleSheet.create({
  section: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 12,
  },
  sectionDark: {
    borderColor: '#2C2C2E',
    backgroundColor: '#1C1C1E',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  sectionTitleDark: {
    color: '#FFFFFF',
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#666666',
  },
  helperTextDark: {
    color: '#B0B0B0',
  },
  metadataGroup: {
    gap: 10,
  },
  readOnlyRow: {
    gap: 4,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  rowLabelDark: {
    color: '#B0B0B0',
  },
  rowValue: {
    fontSize: 15,
    color: '#000000',
  },
  rowValueDark: {
    color: '#FFFFFF',
  },
  progressText: {
    fontSize: 14,
    color: '#3A3A3C',
  },
  progressTextDark: {
    color: '#D1D1D6',
  },
  successText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#34C759',
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#FF3B30',
  },
  primaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  toggleRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  toggleTextGroup: {
    flex: 1,
    gap: 4,
  },
});

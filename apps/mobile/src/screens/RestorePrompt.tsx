import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  checkConnectivity,
  restoreBackupForUser,
  type RestoreBackupCandidate,
  type RestoreBackupResult,
} from '../services';
import { formatBytes } from './SettingsBackupSection';

interface RestorePromptProps {
  candidates: RestoreBackupCandidate[];
  firebaseUid: string;
  isDarkMode: boolean;
  isGoogleProvider: boolean;
  latestBackup: RestoreBackupCandidate;
  onRestoreComplete: () => void;
  onStartFresh: () => void;
}

export default function RestorePrompt({
  candidates,
  firebaseUid,
  isDarkMode,
  isGoogleProvider,
  latestBackup,
  onRestoreComplete,
  onStartFresh,
}: RestorePromptProps) {
  const [isRestoring, setIsRestoring] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const restore = useCallback(async () => {
    if (isRestoring || !isGoogleProvider) return;

    const isOnline = await checkConnectivity();
    if (!isOnline) {
      setErrorMessage('No internet connection. Connect and try again.');
      return;
    }

    setIsRestoring(true);
    setErrorMessage(null);
    const result = await restoreBackupForUser(latestBackup, candidates, firebaseUid);
    setIsRestoring(false);

    if (result.status === 'success') {
      onRestoreComplete();
      return;
    }
    setErrorMessage(mapRestoreFailureMessage(result));
  }, [
    candidates,
    firebaseUid,
    isGoogleProvider,
    isRestoring,
    latestBackup,
    onRestoreComplete,
  ]);

  const confirmRestore = useCallback(() => {
    Alert.alert(
      'Restore backup?',
      `Entries after ${formatDateTime(latestBackup.createdTime)} will not be restored.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: () => {
            void restore();
          },
        },
      ],
    );
  }, [latestBackup.createdTime, restore]);

  const providerMessage = isGoogleProvider
    ? null
    : 'This v1 backup is stored in Google Drive. Sign in with Google to restore it.';

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <View style={styles.card}>
        <Text style={[styles.title, isDarkMode && styles.titleDark]}>
          Backup Found
        </Text>
        <Text style={[styles.body, isDarkMode && styles.bodyDark]}>
          Restore your saved entries, settings, meals, water, and weight history.
        </Text>
        <View style={styles.metadataGroup}>
          <ReadOnlyRow
            label="Backup date"
            value={formatDateTime(latestBackup.createdTime)}
            isDarkMode={isDarkMode}
          />
          <ReadOnlyRow
            label="Size"
            value={formatBytes(latestBackup.sizeBytes)}
            isDarkMode={isDarkMode}
          />
        </View>
        <Text style={[styles.warningText, isDarkMode && styles.warningTextDark]}>
          Restore replaces empty local setup. Entries after backup date will not be restored.
        </Text>
        {providerMessage !== null && (
          <Text style={styles.errorText}>{providerMessage}</Text>
        )}
        {errorMessage !== null && (
          <Text style={styles.errorText}>{errorMessage}</Text>
        )}
        {isRestoring && (
          <View style={styles.progressRow}>
            <ActivityIndicator size="small" color={isDarkMode ? '#FFFFFF' : '#000000'} />
            <Text style={[styles.progressText, isDarkMode && styles.progressTextDark]}>
              Restoring backup...
            </Text>
          </View>
        )}
        <View style={styles.buttonGroup}>
          <Pressable
            style={[
              styles.primaryButton,
              (!isGoogleProvider || isRestoring) && styles.buttonDisabled,
            ]}
            disabled={!isGoogleProvider || isRestoring}
            accessibilityRole="button"
            accessibilityState={{ disabled: !isGoogleProvider || isRestoring }}
            onPress={confirmRestore}
          >
            <Text style={styles.primaryButtonText}>Restore</Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, isRestoring && styles.buttonDisabled]}
            disabled={isRestoring}
            accessibilityRole="button"
            accessibilityState={{ disabled: isRestoring }}
            onPress={onStartFresh}
          >
            <Text style={[styles.secondaryButtonText, isDarkMode && styles.secondaryButtonTextDark]}>
              Start Fresh
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
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

function mapRestoreFailureMessage(
  result: Extract<RestoreBackupResult, { status: 'error' }>,
): string {
  switch (result.code) {
    case 'checksum_unavailable':
    case 'checksum_mismatch':
      return 'Backup file is corrupted and cannot be restored.';
    case 'download_failed':
      return 'Backup download failed. Check connection and try again.';
    case 'migration_failed':
      return 'Backup is too old to migrate. Start fresh or try another backup.';
    case 'reauth_required':
      return 'Google Drive access expired. Sign in with Google again.';
    case 'uid_mismatch':
      return 'Backup belongs to a different account.';
    case 'unsupported_platform':
      return 'Restore is coming soon on this platform.';
    case 'restore_failed':
      return 'Backup storage is inaccessible. Start fresh or try again later.';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    padding: 24,
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  card: {
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    color: '#3A3A3C',
  },
  bodyDark: {
    color: '#D1D1D6',
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
    fontSize: 16,
    color: '#000000',
  },
  rowValueDark: {
    color: '#FFFFFF',
  },
  warningText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#8E8E93',
  },
  warningTextDark: {
    color: '#B0B0B0',
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#FF3B30',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressText: {
    fontSize: 14,
    color: '#3A3A3C',
  },
  progressTextDark: {
    color: '#D1D1D6',
  },
  buttonGroup: {
    gap: 12,
  },
  primaryButton: {
    minHeight: 50,
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
  secondaryButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D1D6',
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  secondaryButtonTextDark: {
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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
  latestBackup: RestoreBackupCandidate;
  onRestoreComplete: () => void;
  onStartFresh: () => void;
}

export default function RestorePrompt({
  candidates,
  firebaseUid,
  isDarkMode,
  latestBackup,
  onRestoreComplete,
  onStartFresh,
}: RestorePromptProps) {
  const [isRestoring, setIsRestoring] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [passwordPromptVisible, setPasswordPromptVisible] = useState(false);

  const restore = useCallback(async (backupPassword: string) => {
    if (isRestoring) return;

    const isOnline = await checkConnectivity();
    if (!isOnline) {
      setErrorMessage('No internet connection. Connect and try again.');
      return;
    }

    setIsRestoring(true);
    setErrorMessage(null);
    const result = await restoreBackupForUser(
      latestBackup,
      candidates,
      firebaseUid,
      backupPassword,
    );
    setIsRestoring(false);

    if (result.status === 'success') {
      onRestoreComplete();
      return;
    }
    setErrorMessage(mapRestoreFailureMessage(result));
  }, [
    candidates,
    firebaseUid,
    isRestoring,
    latestBackup,
    onRestoreComplete,
  ]);

  const submitPassword = useCallback(() => {
    const backupPassword = password.trim();
    if (backupPassword.length === 0) {
      setErrorMessage('Enter the backup password.');
      return;
    }
    setPassword('');
    setPasswordPromptVisible(false);
    void restore(backupPassword);
  }, [password, restore]);

  const confirmRestore = useCallback(() => {
    Alert.alert(
      'Restore backup?',
      `Entries after ${formatDateTime(latestBackup.createdTime)} will not be restored.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: () => {
            setErrorMessage(null);
            setPasswordPromptVisible(true);
          },
        },
      ],
    );
  }, [latestBackup.createdTime]);

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
              isRestoring && styles.buttonDisabled,
            ]}
            disabled={isRestoring}
            accessibilityRole="button"
            accessibilityState={{ disabled: isRestoring }}
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
      <RestorePasswordModal
        isDarkMode={isDarkMode}
        onCancel={() => {
          setPassword('');
          setPasswordPromptVisible(false);
        }}
        onChangePassword={(value) => {
          setErrorMessage(null);
          setPassword(value);
        }}
        onSubmit={submitPassword}
        password={password}
        visible={passwordPromptVisible}
      />
    </View>
  );
}

interface RestorePasswordModalProps {
  isDarkMode: boolean;
  onCancel: () => void;
  onChangePassword: (value: string) => void;
  onSubmit: () => void;
  password: string;
  visible: boolean;
}

function RestorePasswordModal({
  isDarkMode,
  onCancel,
  onChangePassword,
  onSubmit,
  password,
  visible,
}: RestorePasswordModalProps) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, isDarkMode && styles.modalCardDark]}>
          <Text style={[styles.modalTitle, isDarkMode && styles.titleDark]}>
            Backup Password
          </Text>
          <Text style={[styles.modalBody, isDarkMode && styles.bodyDark]}>
            Enter the password created when this backup was first enabled.
          </Text>
          <TextInput
            autoCapitalize="none"
            secureTextEntry
            placeholder="Backup password"
            placeholderTextColor={isDarkMode ? '#8E8E93' : '#666666'}
            value={password}
            onChangeText={onChangePassword}
            style={[styles.modalInput, isDarkMode && styles.modalInputDark]}
          />
          <View style={styles.modalButtonRow}>
            <Pressable onPress={onCancel} style={styles.modalSecondaryButton}>
              <Text style={[styles.modalSecondaryText, isDarkMode && styles.titleDark]}>
                Cancel
              </Text>
            </Pressable>
            <Pressable onPress={onSubmit} style={styles.modalPrimaryButton}>
              <Text style={styles.modalPrimaryText}>Restore</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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
    case 'incorrect_password':
      return 'Incorrect backup password.';
    case 'download_failed':
      return 'Backup download failed. Check connection and try again.';
    case 'migration_failed':
      return 'Backup is too old to migrate. Start fresh or try another backup.';
    case 'network_error':
      return 'Network failed while downloading the backup. Check connection and try again.';
    case 'permission_denied':
      return 'Cloud backup access was denied. Check your connection and try again.';
    case 'quota_exceeded':
      return 'Cloud backup storage quota is exceeded.';
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  modalCard: {
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    padding: 18,
    gap: 12,
  },
  modalCardDark: {
    backgroundColor: '#1C1C1E',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666666',
  },
  modalInput: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D1D6',
    color: '#000000',
    paddingHorizontal: 12,
  },
  modalInputDark: {
    borderColor: '#3A3A3C',
    color: '#FFFFFF',
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalSecondaryButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D1D6',
  },
  modalSecondaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  modalPrimaryButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  modalPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { mapAuthErrorMessage, useAuth } from '../auth';
import {
  getBackupMetadata,
  getBackupPreferences,
  getMealReminderPreferences,
  getMealReminders,
  getUser,
  saveMealReminder,
  setBackupPreferences,
  setMealReminderPreferences,
  updateUserSettings,
} from '../database';
import type { BackupMetadata, BackupPreferences } from '../database';
import type { RootStackParamList } from '../navigation/types';
import {
  runManualBackup,
  syncPeriodicBackupSchedule,
  cancelScheduledMealReminders,
  getNotificationPermissionStatus,
  openMealReminderChannelSettings,
  openNotificationSettings,
  requestNotificationPermission,
  rescheduleMealReminders,
  MealReminderSchedulingError,
  type ManualBackupProgress,
  type ManualBackupResult,
  type NotificationPermissionStatus,
} from '../services';
import SettingsBackupSection, { formatBytes } from './SettingsBackupSection';
import SettingsForm from './SettingsForm';
import type { SettingsTextFieldKey } from './SettingsForm';
import SettingsRemindersSection, {
  isReminderSettingsDirty,
  mapRemindersToForm,
  validateReminderSettings,
  type MealReminderSettingsForm,
} from './SettingsRemindersSection';
import {
  getAllSettingsValidationFields,
  isSettingsDirty,
  mapSettingsFormToUserUpdate,
  mapUserToSettingsForm,
  recalculateSettingsTargets,
  validateSettingsForm,
} from './settingsFormUtils';
import type {
  SettingsFormState,
  SettingsValidationErrors,
  SettingsValidationField,
} from './settingsFormUtils';
import styles from './SettingsScreen.styles';

type SettingsScreenProps = NativeStackScreenProps<RootStackParamList, 'Settings'>;
type LoadState = 'loading' | 'ready' | 'missing' | 'error';

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const auth = useAuth();
  const isDarkMode = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadedSettings, setLoadedSettings] = useState<SettingsFormState | null>(null);
  const [formSettings, setFormSettings] = useState<SettingsFormState | null>(null);
  const [hasManualMacroEdits, setHasManualMacroEdits] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [backupMetadata, setBackupMetadata] = useState<BackupMetadata | null>(null);
  const [backupPreferences, setBackupPreferencesState] =
    useState<BackupPreferences | null>(null);
  const [loadedReminderSettings, setLoadedReminderSettings] =
    useState<MealReminderSettingsForm | null>(null);
  const [formReminderSettings, setFormReminderSettings] =
    useState<MealReminderSettingsForm | null>(null);
  const [notificationPermissionStatus, setNotificationPermissionStatus] =
    useState<NotificationPermissionStatus | null>(null);
  const [backupProgress, setBackupProgress] =
    useState<ManualBackupProgress | null>(null);
  const [backupStatusMessage, setBackupStatusMessage] = useState<string | null>(null);
  const [backupErrorMessage, setBackupErrorMessage] = useState<string | null>(null);
  const [touchedValidationFields, setTouchedValidationFields] = useState<
    Partial<Record<SettingsValidationField, true>>
  >({});
  const allowNavigationRef = useRef(false);

  const settingsDirty = useMemo(
    () =>
      loadedSettings !== null &&
      formSettings !== null &&
      isSettingsDirty(loadedSettings, formSettings),
    [loadedSettings, formSettings],
  );

  const remindersDirty = useMemo(
    () => isReminderSettingsDirty(loadedReminderSettings, formReminderSettings),
    [formReminderSettings, loadedReminderSettings],
  );

  const isDirty = settingsDirty || remindersDirty;

  const validationErrors = useMemo(
    () => (formSettings === null ? {} : validateSettingsForm(formSettings)),
    [formSettings],
  );

  const reminderValidationErrors = useMemo(
    () => validateReminderSettings(formReminderSettings),
    [formReminderSettings],
  );

  const visibleValidationErrors = useMemo(
    () => getVisibleValidationErrors(validationErrors, touchedValidationFields),
    [touchedValidationFields, validationErrors],
  );

  const loadSettings = useCallback(async () => {
    if (!auth.user) {
      setLoadedSettings(null);
      setFormSettings(null);
      setBackupMetadata(null);
      setBackupPreferencesState(null);
      setLoadedReminderSettings(null);
      setFormReminderSettings(null);
      setNotificationPermissionStatus(null);
      setSaveError(null);
      setLoadState('missing');
      return;
    }

    setLoadState('loading');
    try {
      const [
        user,
        metadata,
        preferences,
        reminderPreferences,
        reminders,
        permissionStatus,
      ] = await Promise.all([
        getUser(auth.user.uid),
        getBackupMetadata(),
        getBackupPreferences(),
        getMealReminderPreferences(auth.user.uid),
        getMealReminders(auth.user.uid),
        getNotificationPermissionStatus(),
      ]);
      if (user === null) {
        setLoadedSettings(null);
        setFormSettings(null);
        setBackupMetadata(null);
        setBackupPreferencesState(null);
        setLoadedReminderSettings(null);
        setFormReminderSettings(null);
        setNotificationPermissionStatus(permissionStatus);
        setSaveError(null);
        setLoadState('missing');
        return;
      }
      const nextSettings = mapUserToSettingsForm(user);
      const nextReminderSettings = mapRemindersToForm(
        reminderPreferences.reminders_enabled,
        reminders,
      );
      setLoadedSettings(nextSettings);
      setFormSettings(nextSettings);
      setLoadedReminderSettings(nextReminderSettings);
      setFormReminderSettings(nextReminderSettings);
      setNotificationPermissionStatus(permissionStatus);
      setHasManualMacroEdits(false);
      setTouchedValidationFields({});
      setBackupMetadata(metadata);
      setBackupPreferencesState(preferences);
      setBackupProgress(null);
      setBackupStatusMessage(null);
      setBackupErrorMessage(null);
      setSaveError(null);
      setLoadState('ready');
    } catch {
      setLoadedSettings(null);
      setFormSettings(null);
      setBackupMetadata(null);
      setBackupPreferencesState(null);
      setLoadedReminderSettings(null);
      setFormReminderSettings(null);
      setNotificationPermissionStatus(null);
      setSaveError(null);
      setLoadState('error');
    }
  }, [auth.user]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    return navigation.addListener('beforeRemove', (event) => {
      if (!isDirty || allowNavigationRef.current) return;

      event.preventDefault();
      Alert.alert(
        'You have unsaved changes. Discard?',
        'Changes will be lost if you leave Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigation.dispatch(event.data.action),
          },
        ],
      );
    });
  }, [isDirty, navigation]);

  const updateTextField = useCallback((key: SettingsTextFieldKey, value: string) => {
    if (isMacroField(key)) {
      setHasManualMacroEdits(true);
    }
    setSaveError(null);
    setSignOutError(null);
    setFormSettings((current) =>
      current === null ? current : { ...current, [key]: value },
    );
  }, []);

  const updateForm = useCallback((nextValues: Partial<SettingsFormState>) => {
    setSaveError(null);
    setSignOutError(null);
    setFormSettings((current) =>
      current === null ? current : { ...current, ...nextValues },
    );
  }, []);

  const blurValidationField = useCallback((field: SettingsValidationField) => {
    setTouchedValidationFields((current) => ({ ...current, [field]: true }));
  }, []);

  const applyTargetRecalculation = useCallback(() => {
    setFormSettings((current) =>
      current === null
        ? current
        : { ...current, ...recalculateSettingsTargets(current) },
    );
    setHasManualMacroEdits(false);
    setSaveError(null);
    setSignOutError(null);
  }, []);

  const recalculateTargets = useCallback(() => {
    if (!hasManualMacroEdits) {
      applyTargetRecalculation();
      return;
    }

    Alert.alert(
      'Reset macro targets?',
      'Recalculating will replace manual protein, carbs, and fat edits with formula targets.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Recalculate',
          style: 'destructive',
          onPress: applyTargetRecalculation,
        },
      ],
    );
  }, [applyTargetRecalculation, hasManualMacroEdits]);

  const saveSettings = useCallback(async () => {
    if (!auth.user || formSettings === null || formReminderSettings === null) return;

    const errors = validateSettingsForm(formSettings);
    if (Object.keys(errors).length > 0) {
      setTouchedValidationFields(
        getAllSettingsValidationFields().reduce<
          Partial<Record<SettingsValidationField, true>>
        >((fields, field) => {
          fields[field] = true;
          return fields;
        }, {}),
      );
      return;
    }
    if (Object.keys(reminderValidationErrors).length > 0) {
      setSaveError('Fix reminder settings before saving.');
      return;
    }
    if (
      remindersDirty &&
      formReminderSettings.reminders_enabled &&
      notificationPermissionStatus?.canScheduleMealReminders !== true
    ) {
      setSaveError('Enable notifications before saving meal reminders.');
      return;
    }

    const userId = auth.user.uid;

    setIsSaving(true);
    setSaveError(null);
    try {
      await updateUserSettings(userId, mapSettingsFormToUserUpdate(formSettings));
      if (remindersDirty) {
        await setMealReminderPreferences({
          user_id: userId,
          reminders_enabled: formReminderSettings.reminders_enabled,
        });
        await Promise.all(
          formReminderSettings.reminders.map((reminder) =>
            saveMealReminder(userId, reminder),
          ),
        );
        if (formReminderSettings.reminders_enabled) {
          await rescheduleMealReminders(userId);
        } else {
          await cancelScheduledMealReminders();
        }
      }
      setLoadedSettings(formSettings);
      setLoadedReminderSettings(formReminderSettings);
      setTouchedValidationFields({});
    } catch (error) {
      setSaveError(mapSettingsSaveError(error));
    } finally {
      setIsSaving(false);
    }
  }, [
    auth.user,
    formReminderSettings,
    formSettings,
    notificationPermissionStatus,
    reminderValidationErrors,
    remindersDirty,
  ]);

  const signOut = useCallback(async () => {
    setIsSigningOut(true);
    setSignOutError(null);
    try {
      allowNavigationRef.current = true;
      await auth.signOut();
    } catch (err) {
      allowNavigationRef.current = false;
      setSignOutError(mapAuthErrorMessage(err));
      setIsSigningOut(false);
    }
  }, [auth]);

  const requestSignOut = useCallback(() => {
    if (isSigningOut) return;

    if (!isDirty) {
      void signOut();
      return;
    }

    Alert.alert(
      'Discard changes and sign out?',
      'Unsaved settings changes will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            void signOut();
          },
        },
      ],
    );
  }, [isDirty, isSigningOut, signOut]);

  const createBackup = useCallback(async () => {
    if (isBackingUp) return;

    setIsBackingUp(true);
    setBackupProgress(null);
    setBackupStatusMessage(null);
    setBackupErrorMessage(null);

    try {
      const result = await runManualBackup({
        onProgress: setBackupProgress,
      });

      if (result.status === 'success') {
        setBackupMetadata(result.metadata);
        setBackupStatusMessage(
          `Backup complete. ${formatBytes(result.metadata.last_backup_size_bytes)} saved.`,
        );
      } else {
        setBackupErrorMessage(mapBackupFailureMessage(result));
      }
    } catch {
      setBackupErrorMessage('Backup failed. Try again.');
    } finally {
      setIsBackingUp(false);
    }
  }, [isBackingUp]);

  const updateBackupPreferences = useCallback(
    async (preferences: BackupPreferences) => {
      setBackupPreferencesState(preferences);
      setBackupStatusMessage(null);
      setBackupErrorMessage(null);
      try {
        await setBackupPreferences(preferences);
        await syncPeriodicBackupSchedule();
      } catch {
        setBackupErrorMessage('Backup preferences could not be saved.');
        void loadSettings();
      }
    },
    [loadSettings],
  );

  const requestReminderPermission = useCallback(async () => {
    setSaveError(null);
    setNotificationPermissionStatus(await requestNotificationPermission());
  }, []);

  const openReminderNotificationSettings = useCallback(() => {
    void openNotificationSettings();
  }, []);

  const openReminderChannelSettings = useCallback(() => {
    void openMealReminderChannelSettings();
  }, []);

  const saveDisabled = !isDirty || formSettings === null || isSaving || isSigningOut;

  return (
    <View
      style={[
        styles.container,
        isDarkMode && styles.containerDark,
        { paddingTop: insets.top },
      ]}
    >
      <View style={styles.header}>
        <Pressable onPress={navigation.goBack} hitSlop={8} style={styles.backButton}>
          <Text style={[styles.backText, isDarkMode && styles.backTextDark]}>
            Back
          </Text>
        </Pressable>
        <View style={styles.titleGroup}>
          <Text style={[styles.title, isDarkMode && styles.titleDark]}>
            Settings
          </Text>
          {isDirty && (
            <Text style={[styles.dirtyText, isDarkMode && styles.dirtyTextDark]}>
              Unsaved changes
            </Text>
          )}
        </View>
        <Pressable
          onPress={saveSettings}
          disabled={saveDisabled}
          style={[styles.saveButton, saveDisabled && styles.saveButtonDisabled]}
        >
          <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save'}</Text>
        </Pressable>
      </View>
      {saveError !== null && (
        <Text style={styles.saveError}>{saveError}</Text>
      )}

      {loadState === 'loading' ? (
        <ActivityIndicator
          size="large"
          style={styles.loader}
          color={isDarkMode ? '#FFFFFF' : '#000000'}
        />
      ) : loadState === 'missing' ? (
        <StateMessage
          isDarkMode={isDarkMode}
          title="User not found"
          body="Complete onboarding before changing settings."
        />
      ) : loadState === 'error' ? (
        <StateMessage
          isDarkMode={isDarkMode}
          title="Settings unavailable"
          body="Could not load settings from the local database."
          actionLabel="Retry"
          onAction={loadSettings}
        />
      ) : formSettings !== null ? (
        <SettingsForm
          authIdentity={formatAuthIdentity(auth.user)}
          backupSection={(
            <SettingsBackupSection
              errorMessage={backupErrorMessage}
              isBackingUp={isBackingUp}
              isDarkMode={isDarkMode}
              metadata={backupMetadata}
              onCreateBackup={createBackup}
              onUpdateBackupPreferences={updateBackupPreferences}
              preferences={backupPreferences}
              progress={backupProgress}
              statusMessage={backupStatusMessage}
            />
          )}
          remindersSection={(
            <SettingsRemindersSection
              errors={reminderValidationErrors}
              form={formReminderSettings}
              isDarkMode={isDarkMode}
              onOpenChannelSettings={openReminderChannelSettings}
              onOpenNotificationSettings={openReminderNotificationSettings}
              onRequestPermission={requestReminderPermission}
              onUpdateForm={(nextReminderSettings) => {
                setSaveError(null);
                setSignOutError(null);
                setFormReminderSettings(nextReminderSettings);
              }}
              permissionStatus={notificationPermissionStatus}
            />
          )}
          errors={visibleValidationErrors}
          form={formSettings}
          isDarkMode={isDarkMode}
          onBlurValidationField={blurValidationField}
          onRecalculateTargets={recalculateTargets}
          onUpdateForm={updateForm}
          onUpdateTextField={updateTextField}
          onSignOut={requestSignOut}
          signOutError={signOutError}
          isSigningOut={isSigningOut}
          bottomInset={insets.bottom}
        />
      ) : null}
    </View>
  );
}

interface StateMessageProps {
  isDarkMode: boolean;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}

function StateMessage({
  isDarkMode,
  title,
  body,
  actionLabel,
  onAction,
}: StateMessageProps) {
  return (
    <View style={styles.stateMessage}>
      <Text style={[styles.stateTitle, isDarkMode && styles.stateTitleDark]}>
        {title}
      </Text>
      <Text style={[styles.stateBody, isDarkMode && styles.stateBodyDark]}>
        {body}
      </Text>
      {actionLabel !== undefined && onAction !== undefined && (
        <Pressable onPress={onAction} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

function getVisibleValidationErrors(
  errors: SettingsValidationErrors,
  touchedFields: Partial<Record<SettingsValidationField, true>>,
): SettingsValidationErrors {
  return (Object.keys(touchedFields) as SettingsValidationField[]).reduce<SettingsValidationErrors>(
    (visibleErrors, field) => {
      const error = errors[field];
      if (error !== undefined) {
        visibleErrors[field] = error;
      }
      return visibleErrors;
    },
    {},
  );
}

function isMacroField(key: SettingsTextFieldKey): boolean {
  return key === 'protein_g' || key === 'carbs_g' || key === 'fat_g';
}

function formatAuthIdentity(user: ReturnType<typeof useAuth>['user']): string {
  if (user?.email) return user.email;
  if (user?.displayName) return user.displayName;
  return user?.uid ?? 'Unavailable';
}

function mapBackupFailureMessage(result: Extract<ManualBackupResult, { status: 'error' }>): string {
  switch (result.code) {
    case 'no_internet':
      return 'No internet connection. Connect and try again.';
    case 'reauth_required':
      return 'Google Drive permission missing. Sign in with Google and allow Drive backup access.';
    case 'drive_permission_required':
      return 'Google Drive backup permission or console setup is missing. Check Drive API/OAuth consent, then sign in again.';
    case 'quota_exceeded':
      return 'Backup storage is full. Delete old Drive app data or try later.';
    case 'interrupted_upload':
      return 'Backup upload was interrupted. Try again.';
    case 'unsupported_platform':
      return 'Backup is coming soon on this platform.';
    case 'backup_failed':
      return 'Google Drive backup failed. Check Drive API/OAuth consent setup if this persists.';
  }
}

function mapSettingsSaveError(error: unknown): string {
  if (error instanceof MealReminderSchedulingError) {
    return 'Too many pending notifications. Disable some reminder days and try again.';
  }

  return 'Failed to save settings. Try again.';
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { mapAuthErrorMessage, useAuth } from '../auth';
import { getUser, updateUserSettings } from '../database';
import type { RootStackParamList } from '../navigation/types';
import SettingsForm from './SettingsForm';
import type { SettingsTextFieldKey } from './SettingsForm';
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [touchedValidationFields, setTouchedValidationFields] = useState<
    Partial<Record<SettingsValidationField, true>>
  >({});
  const allowNavigationRef = useRef(false);

  const isDirty = useMemo(
    () =>
      loadedSettings !== null &&
      formSettings !== null &&
      isSettingsDirty(loadedSettings, formSettings),
    [loadedSettings, formSettings],
  );

  const validationErrors = useMemo(
    () => (formSettings === null ? {} : validateSettingsForm(formSettings)),
    [formSettings],
  );

  const visibleValidationErrors = useMemo(
    () => getVisibleValidationErrors(validationErrors, touchedValidationFields),
    [touchedValidationFields, validationErrors],
  );

  const loadSettings = useCallback(async () => {
    if (!auth.user) {
      setLoadedSettings(null);
      setFormSettings(null);
      setSaveError(null);
      setLoadState('missing');
      return;
    }

    setLoadState('loading');
    try {
      const user = await getUser(auth.user.uid);
      if (user === null) {
        setLoadedSettings(null);
        setFormSettings(null);
        setSaveError(null);
        setLoadState('missing');
        return;
      }
      const nextSettings = mapUserToSettingsForm(user);
      setLoadedSettings(nextSettings);
      setFormSettings(nextSettings);
      setHasManualMacroEdits(false);
      setTouchedValidationFields({});
      setSaveError(null);
      setLoadState('ready');
    } catch {
      setLoadedSettings(null);
      setFormSettings(null);
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
    if (!auth.user || formSettings === null) return;

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

    setIsSaving(true);
    setSaveError(null);
    try {
      await updateUserSettings(auth.user.uid, mapSettingsFormToUserUpdate(formSettings));
      setLoadedSettings(formSettings);
      setTouchedValidationFields({});
    } catch {
      setSaveError('Failed to save settings. Try again.');
    } finally {
      setIsSaving(false);
    }
  }, [auth.user, formSettings]);

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  header: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    minWidth: 64,
    paddingVertical: 8,
  },
  backText: {
    fontSize: 16,
    color: '#007AFF',
  },
  backTextDark: {
    color: '#64A9FF',
  },
  titleGroup: {
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  dirtyText: {
    marginTop: 2,
    fontSize: 12,
    color: '#8E8E93',
  },
  dirtyTextDark: {
    color: '#B0B0B0',
  },
  saveButton: {
    minWidth: 64,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  saveError: {
    marginHorizontal: 16,
    marginBottom: 8,
    fontSize: 14,
    color: '#FF3B30',
    textAlign: 'center',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stateMessage: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  stateTitleDark: {
    color: '#FFFFFF',
  },
  stateBody: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  stateBodyDark: {
    color: '#B0B0B0',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../auth';
import type { RootStackParamList } from '../navigation/types';

import RestorePrompt from './RestorePrompt';

type RestoreCheckScreenProps = NativeStackScreenProps<RootStackParamList, 'RestoreCheck'>;

export default function RestoreCheckScreen({ route }: RestoreCheckScreenProps) {
  const auth = useAuth();
  const isDarkMode = useColorScheme() === 'dark';
  const params = route.params;

  const confirmCancelCheck = () => {
    Alert.alert(
      'Skip backup check?',
      'This will stop checking for Google Drive backups and start a new onboarding setup.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: params.onStartFresh,
        },
      ],
    );
  };

  if (
    params.status === 'backup-found' &&
    auth.user !== null &&
    params.latestRestoreBackup !== undefined &&
    params.restoreCandidates !== undefined
  ) {
    return (
      <RestorePrompt
        candidates={params.restoreCandidates}
        firebaseUid={auth.user.uid}
        isDarkMode={isDarkMode}
        isGoogleProvider={hasGoogleProvider(auth.user)}
        latestBackup={params.latestRestoreBackup}
        onRestoreComplete={params.onRestoreComplete}
        onStartFresh={params.onStartFresh}
      />
    );
  }

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      {params.status === 'loading' && (
        <View style={styles.card}>
          <ActivityIndicator size="large" color={isDarkMode ? '#FFFFFF' : '#000000'} />
          <Text style={[styles.title, isDarkMode && styles.titleDark]}>
            Checking for Backup
          </Text>
          <Text style={[styles.body, isDarkMode && styles.bodyDark]}>
            Looking for a Google Drive backup before onboarding starts.
          </Text>
          <SecondaryButton
            isDarkMode={isDarkMode}
            label="Cancel Backup Check"
            onPress={confirmCancelCheck}
          />
        </View>
      )}

      {params.status === 'no-backup' && (
        <View style={styles.card}>
          <Text style={[styles.title, isDarkMode && styles.titleDark]}>
            No Backup Found
          </Text>
          <Text style={[styles.body, isDarkMode && styles.bodyDark]}>
            No Google Drive backup was found for this account. Start fresh to continue onboarding.
          </Text>
          <PrimaryButton label="Start Fresh" onPress={params.onStartFresh} />
        </View>
      )}

      {params.status === 'error' && (
        <View style={styles.card}>
          <Text style={[styles.title, isDarkMode && styles.titleDark]}>
            Backup Check Failed
          </Text>
          <Text style={[styles.body, isDarkMode && styles.bodyDark]}>
            {params.errorMessage}
          </Text>
          <Text style={[styles.diagnostic, isDarkMode && styles.diagnosticDark]}>
            Google Drive restore needs the drive.appdata scope, enabled Drive API scopes in Cloud Console, and a
            Firebase Google Sign-In setup that matches this app's SHA fingerprints and google-services.json.
          </Text>
          <View style={styles.buttonGroup}>
            <PrimaryButton label="Retry" onPress={params.onRetry} />
            <SecondaryButton isDarkMode={isDarkMode} label="Start Fresh" onPress={params.onStartFresh} />
          </View>
        </View>
      )}
    </View>
  );
}

interface ButtonProps {
  label: string;
  onPress: () => void;
}

function PrimaryButton({ label, onPress }: ButtonProps) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.primaryButton}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({
  isDarkMode,
  label,
  onPress,
}: ButtonProps & { isDarkMode: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.secondaryButton}>
      <Text style={[styles.secondaryButtonText, isDarkMode && styles.secondaryButtonTextDark]}>
        {label}
      </Text>
    </Pressable>
  );
}

function hasGoogleProvider(user: NonNullable<ReturnType<typeof useAuth>['user']>): boolean {
  return user.providerData.some((provider) => provider.providerId === 'google.com');
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
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
  diagnostic: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666666',
  },
  diagnosticDark: {
    color: '#B0B0B0',
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
});

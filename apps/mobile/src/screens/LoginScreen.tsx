import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import {
  GoogleSignin,
  GoogleSigninButton,
} from '@react-native-google-signin/google-signin';
import { useRoute } from '@react-navigation/native';

import { signInWithGoogle, signInWithApple, useAuth } from '../auth';
import {
  AuthConfigurationError,
  AppleAuthConfigurationError,
  PlayServicesUnavailableError,
} from '../auth/types';

export default function LoginScreen() {
  const auth = useAuth();
  const route = useRoute();
  const routeMessage =
    (route.params as { message?: string } | undefined)?.message ?? null;

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [googleAvailable, setGoogleAvailable] = useState(
    Platform.OS === 'ios',
  );
  const isDarkMode = useColorScheme() === 'dark';

  useEffect(() => {
    if (Platform.OS === 'android') {
      GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: false })
        .then(setGoogleAvailable)
        .catch(() => setGoogleAvailable(false));
    }
  }, []);

  const handleSignIn = useCallback(
    async (provider: 'google' | 'apple') => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const result =
          provider === 'google'
            ? await signInWithGoogle()
            : await signInWithApple();
        if ('cancelled' in result && result.cancelled) {
          return;
        }
      } catch (err) {
        setErrorMessage(mapError(err));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const appleAvailable = Platform.OS === 'ios';
  const noMethods = !googleAvailable && !appleAvailable;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={[styles.appName, isDarkMode && styles.appNameDark]}>
          Calories
        </Text>

        {auth.error !== null && (
          <Text style={[styles.outage, isDarkMode && styles.outageDark]}>
            Service temporarily unavailable
          </Text>
        )}

        {loading ? (
          <ActivityIndicator
            size="large"
            style={styles.loader}
            color={isDarkMode ? '#FFFFFF' : '#000000'}
          />
        ) : noMethods ? (
          <Text
            style={[styles.noMethods, isDarkMode && styles.noMethodsDark]}
          >
            No sign-in methods available on this device
          </Text>
        ) : (
          <View style={styles.buttons}>
            {googleAvailable && (
              <GoogleSigninButton
                size={GoogleSigninButton.Size.Wide}
                disabled={loading}
                onPress={() => handleSignIn('google')}
              />
            )}
            {appleAvailable && (
              <Pressable
                onPress={() => handleSignIn('apple')}
                disabled={loading}
                style={[
                  styles.appleButton,
                  isDarkMode
                    ? styles.appleButtonDark
                    : styles.appleButtonLight,
                  loading && styles.buttonDisabled,
                ]}
              >
                <Text
                  style={[
                    styles.appleButtonText,
                    isDarkMode
                      ? styles.appleButtonTextDark
                      : styles.appleButtonTextLight,
                  ]}
                >
                  {'\uF8FF'} Sign in with Apple
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {routeMessage !== null && errorMessage === null && (
          <Text
            style={[styles.error, isDarkMode && styles.errorDark]}
          >
            {routeMessage}
          </Text>
        )}
        {errorMessage !== null && (
          <Text
            style={[styles.error, isDarkMode && styles.errorDark]}
          >
            {errorMessage}
          </Text>
        )}
      </View>
    </View>
  );
}

function mapError(err: unknown): string {
  if (
    err instanceof AuthConfigurationError ||
    err instanceof AppleAuthConfigurationError
  ) {
    return 'Authentication service unavailable';
  }
  if (err instanceof PlayServicesUnavailableError) {
    return 'Google Play Services are not available';
  }
  if (err instanceof Error && 'retryAfter' in err) {
    const retryAfter = (err as Record<string, unknown>).retryAfter;
    if (typeof retryAfter === 'number') {
      const minutes = Math.ceil(retryAfter / 60);
      return `Too many attempts. Try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`;
    }
    return 'Too many attempts. Try again later.';
  }
  if (err instanceof Error) {
    if (
      'code' in err &&
      typeof (err as Record<string, unknown>).code === 'string'
    ) {
      const code = (err as Record<string, unknown>).code as string;
      if (code === 'auth/network-request-failed') {
        return 'No internet connection';
      }
      if (code === 'auth/too-many-requests') {
        return 'Too many attempts. Try again later.';
      }
      if (code === 'auth/service-unavailable') {
        return 'Service temporarily unavailable';
      }
    }
    if (err.message.toLowerCase().includes('network')) {
      return 'No internet connection';
    }
    return err.message;
  }
  return 'An unexpected error occurred';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  content: {
    width: '100%',
    alignItems: 'center',
  },
  appName: {
    fontSize: 36,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 48,
  },
  appNameDark: {
    color: '#FFFFFF',
  },
  loader: {
    marginVertical: 24,
  },
  noMethods: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  noMethodsDark: {
    color: '#AAAAAA',
  },
  buttons: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  appleButton: {
    width: 312,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appleButtonLight: {
    backgroundColor: '#000000',
  },
  appleButtonDark: {
    backgroundColor: '#FFFFFF',
  },
  appleButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  appleButtonTextLight: {
    color: '#FFFFFF',
  },
  appleButtonTextDark: {
    color: '#000000',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  error: {
    marginTop: 24,
    fontSize: 14,
    color: '#CC0000',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  errorDark: {
    color: '#FF4444',
  },
  outage: {
    marginBottom: 24,
    fontSize: 14,
    color: '#996600',
    textAlign: 'center',
  },
  outageDark: {
    color: '#FFCC00',
  },
});

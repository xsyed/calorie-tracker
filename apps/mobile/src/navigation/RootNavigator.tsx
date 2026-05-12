import { useCallback, useEffect, useRef, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../auth';
import { initDatabase, userExists } from '../database';
import SplashScreen from '../screens/SplashScreen';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const auth = useAuth();
  const [userCheckState, setUserCheckState] = useState<
    'pending' | 'exists' | 'not-exists'
  >('pending');
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [appJustLaunched, setAppJustLaunched] = useState(true);
  const prevStatus = useRef(auth.status);

  useEffect(() => {
    initDatabase();
  }, []);

  useEffect(() => {
    if (auth.status !== 'checking' && appJustLaunched) {
      setAppJustLaunched(false);
      if (auth.status === 'authenticated') {
        auth.getIdToken(true).catch(async (err) => {
          if (!isNetworkError(err)) {
            setSessionError('Session expired. Please sign in again.');
            await auth.signOut();
          }
        });
      }
    }
  }, [auth.status, appJustLaunched, auth.getIdToken, auth.signOut]);

  useEffect(() => {
    if (auth.status === 'authenticated' && auth.user) {
      userExists(auth.user.uid)
        .then((exists) => {
          setUserCheckState(exists ? 'exists' : 'not-exists');
        })
        .catch(() => {
          setUserCheckState('not-exists');
        });
    } else {
      setUserCheckState('pending');
    }
  }, [auth.status, auth.user?.uid]);

  useEffect(() => {
    if (prevStatus.current === 'unauthenticated' && auth.status === 'authenticated') {
      setSessionError(null);
    }
    if (auth.status === 'checking') {
      setSessionError(null);
    }
    prevStatus.current = auth.status;
  }, [auth.status]);

  const handleOnboardingComplete = useCallback(() => {
    setUserCheckState('exists');
  }, []);

  const showSplash =
    auth.status === 'checking' ||
    (auth.status === 'authenticated' && userCheckState === 'pending');

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {showSplash ? (
        <Stack.Screen name="Splash" component={SplashScreen} />
      ) : auth.status === 'unauthenticated' ? (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          initialParams={
            sessionError !== null ? { message: sessionError } : undefined
          }
        />
      ) : userCheckState === 'exists' ? (
        <Stack.Screen name="Home" component={HomeScreen} />
      ) : (
        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          initialParams={{ onOnboardingComplete: handleOnboardingComplete }}
        />
      )}
    </Stack.Navigator>
  );
}

function isNetworkError(err: unknown): boolean {
  if (
    err instanceof Error &&
    'code' in err &&
    typeof (err as Record<string, unknown>).code === 'string'
  ) {
    return (err as Record<string, unknown>).code ===
      'auth/network-request-failed';
  }
  if (err instanceof Error) {
    return err.message.toLowerCase().includes('network');
  }
  return false;
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../auth';
import { initDatabase, userExists } from '../database';
import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SplashScreen from '../screens/SplashScreen';
import WaterScreen from '../screens/WaterScreen';
import WeightScreen from '../screens/WeightScreen';
import {
  detectRestoreBackups,
  MealReminderNotificationTapRouter,
  PeriodicBackupTriggers,
  type RestoreBackupCandidate,
} from '../services';
import { FlushTriggers } from '../services/FlushTriggers';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const auth = useAuth();
  const [userCheckState, setUserCheckState] = useState<
    'pending' | 'exists' | 'not-exists'
  >('pending');
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [restoreCandidates, setRestoreCandidates] = useState<
    RestoreBackupCandidate[] | null
  >(null);
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
    let cancelled = false;

    if (auth.status === 'authenticated' && auth.user) {
      setUserCheckState('pending');
      setRestoreCandidates(null);
      userExists(auth.user.uid)
        .then(async (exists) => {
          if (cancelled) return;
          if (exists) {
            setUserCheckState('exists');
            return;
          }
          const result = await detectRestoreBackups();
          if (cancelled) return;
          setRestoreCandidates(result.candidates.length > 0 ? result.candidates : null);
          setUserCheckState('not-exists');
        })
        .catch(() => {
          if (cancelled) return;
          setUserCheckState('not-exists');
        });
    } else {
      setUserCheckState('pending');
      setRestoreCandidates(null);
    }

    return () => {
      cancelled = true;
    };
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
    setRestoreCandidates(null);
  }, []);

  const handleRestoreSkipped = useCallback(() => {
    setRestoreCandidates(null);
  }, []);

  const latestRestoreBackup = restoreCandidates?.[0];
  const onboardingParams = {
    onOnboardingComplete: handleOnboardingComplete,
    onRestoreComplete: handleOnboardingComplete,
    onRestoreSkipped: handleRestoreSkipped,
    ...(restoreCandidates === null || latestRestoreBackup === undefined
      ? {}
      : {
          latestRestoreBackup,
          restoreCandidates,
        }),
  };

  const showSplash =
    auth.status === 'checking' ||
    (auth.status === 'authenticated' && userCheckState === 'pending');

  return (
    <>
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
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Weight" component={WeightScreen} />
            <Stack.Screen name="Water" component={WaterScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </>
        ) : (
          <Stack.Screen
            name="Onboarding"
            component={OnboardingScreen}
            initialParams={onboardingParams}
          />
        )}
      </Stack.Navigator>
      <MealReminderNotificationTapRouter
        enabled={auth.status === 'authenticated' && userCheckState === 'exists'}
      />
      {userCheckState === 'exists' && (
        <>
          <FlushTriggers />
          <PeriodicBackupTriggers />
        </>
      )}
    </>
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

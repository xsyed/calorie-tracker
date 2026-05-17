import { useCallback, useEffect, useRef, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../auth';
import { initDatabase, userExists } from '../database';
import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import RestoreCheckScreen from '../screens/RestoreCheckScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SplashScreen from '../screens/SplashScreen';
import WaterScreen from '../screens/WaterScreen';
import WeightScreen from '../screens/WeightScreen';
import {
  detectRestoreBackups,
  CloudBackupError,
  MealReminderNotificationTapRouter,
  PeriodicBackupTriggers,
  type RestoreBackupCandidate,
} from '../services';
import { FlushTriggers } from '../services/FlushTriggers';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const RESTORE_CHECK_TIMEOUT_MS = 120_000;
type RestoreCheckStatus = 'idle' | 'loading' | 'backup-found' | 'no-backup' | 'error' | 'skipped';

interface RestoreCheckState {
  status: RestoreCheckStatus;
  errorMessage: string | null;
}

export default function RootNavigator() {
  const auth = useAuth();
  const [userCheckState, setUserCheckState] = useState<
    'pending' | 'exists' | 'not-exists'
  >('pending');
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [restoreCandidates, setRestoreCandidates] = useState<
    RestoreBackupCandidate[] | null
  >(null);
  const [restoreCheckState, setRestoreCheckState] = useState<RestoreCheckState>({
    status: 'idle',
    errorMessage: null,
  });
  const [appJustLaunched, setAppJustLaunched] = useState(true);
  const prevStatus = useRef(auth.status);
  const restoreCheckRequestId = useRef(0);

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
      setRestoreCheckState({ status: 'idle', errorMessage: null });
      userExists(auth.user.uid)
        .then(async (exists) => {
          if (cancelled) return;
          if (exists) {
            setUserCheckState('exists');
            return;
          }
          setUserCheckState('not-exists');
          setRestoreCheckState({ status: 'loading', errorMessage: null });
          const requestId = restoreCheckRequestId.current + 1;
          restoreCheckRequestId.current = requestId;
          const result = await detectRestoreBackupsWithTimeout();
          if (cancelled) return;
          if (restoreCheckRequestId.current !== requestId) return;
          if (isRestoreDetectionTimeout(result)) {
            setRestoreCandidates(null);
            setRestoreCheckState({ status: 'skipped', errorMessage: null });
            return;
          }
          if (result.candidates.length > 0) {
            setRestoreCandidates(result.candidates);
            setRestoreCheckState({ status: 'backup-found', errorMessage: null });
            return;
          }
          setRestoreCandidates(null);
          setRestoreCheckState({ status: 'no-backup', errorMessage: null });
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          restoreCheckRequestId.current += 1;
          setUserCheckState('not-exists');
          setRestoreCandidates(null);
          setRestoreCheckState({
            status: 'error',
            errorMessage: getRestoreDetectionErrorMessage(err),
          });
        });
    } else {
      restoreCheckRequestId.current += 1;
      setUserCheckState('pending');
      setRestoreCandidates(null);
      setRestoreCheckState({ status: 'idle', errorMessage: null });
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
    setRestoreCheckState({ status: 'idle', errorMessage: null });
  }, []);

  const handleStartFresh = useCallback(() => {
    restoreCheckRequestId.current += 1;
    setRestoreCandidates(null);
    setRestoreCheckState({ status: 'skipped', errorMessage: null });
  }, []);

  useEffect(() => {
    if (restoreCheckState.status !== 'loading') return undefined;

    const timer = setTimeout(handleStartFresh, RESTORE_CHECK_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [handleStartFresh, restoreCheckState.status]);

  const handleRetryRestoreCheck = useCallback(async () => {
    if (auth.status !== 'authenticated' || !auth.user) return;

    setRestoreCandidates(null);
    setRestoreCheckState({ status: 'loading', errorMessage: null });
    const requestId = restoreCheckRequestId.current + 1;
    restoreCheckRequestId.current = requestId;
    try {
      const result = await detectRestoreBackupsWithTimeout();
      if (restoreCheckRequestId.current !== requestId) return;
      if (isRestoreDetectionTimeout(result)) {
        setRestoreCandidates(null);
        setRestoreCheckState({ status: 'skipped', errorMessage: null });
        return;
      }
      if (result.candidates.length > 0) {
        setRestoreCandidates(result.candidates);
        setRestoreCheckState({ status: 'backup-found', errorMessage: null });
        return;
      }
      setRestoreCheckState({ status: 'no-backup', errorMessage: null });
    } catch (err) {
      if (restoreCheckRequestId.current !== requestId) return;
      setRestoreCheckState({
        status: 'error',
        errorMessage: getRestoreDetectionErrorMessage(err),
      });
    }
  }, [auth.status, auth.user]);

  const latestRestoreBackup = restoreCandidates?.[0];
  const onboardingParams = {
    onOnboardingComplete: handleOnboardingComplete,
  };
  const restoreCheckParams = getRestoreCheckParams({
    latestRestoreBackup,
    onRestoreComplete: handleOnboardingComplete,
    onRetry: handleRetryRestoreCheck,
    onStartFresh: handleStartFresh,
    restoreCandidates,
    restoreCheckState,
  });

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
        ) : restoreCheckParams !== null ? (
          <Stack.Screen
            navigationKey={getRestoreCheckKey(restoreCheckParams)}
            name="RestoreCheck"
            component={RestoreCheckScreen}
            initialParams={restoreCheckParams}
          />
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

type TimedRestoreDetectionResult =
  | Awaited<ReturnType<typeof detectRestoreBackups>>
  | { status: 'timeout' };

function detectRestoreBackupsWithTimeout(): Promise<TimedRestoreDetectionResult> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      resolve({ status: 'timeout' });
    }, RESTORE_CHECK_TIMEOUT_MS);

    detectRestoreBackups()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err: unknown) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function isRestoreDetectionTimeout(
  result: TimedRestoreDetectionResult,
): result is { status: 'timeout' } {
  return 'status' in result && result.status === 'timeout';
}

interface RestoreCheckParamsOptions {
  latestRestoreBackup: RestoreBackupCandidate | undefined;
  onRestoreComplete: () => void;
  onRetry: () => void;
  onStartFresh: () => void;
  restoreCandidates: RestoreBackupCandidate[] | null;
  restoreCheckState: RestoreCheckState;
}

function getRestoreCheckParams({
  latestRestoreBackup,
  onRestoreComplete,
  onRetry,
  onStartFresh,
  restoreCandidates,
  restoreCheckState,
}: RestoreCheckParamsOptions): RootStackParamList['RestoreCheck'] | null {
  if (restoreCheckState.status === 'skipped' || restoreCheckState.status === 'idle') {
    return null;
  }

  const baseParams = {
    onRestoreComplete,
    onRetry,
    onStartFresh,
  };

  if (
    restoreCheckState.status === 'backup-found' &&
    restoreCandidates !== null &&
    latestRestoreBackup !== undefined
  ) {
    return {
      ...baseParams,
      status: 'backup-found',
      latestRestoreBackup,
      restoreCandidates,
    };
  }

  if (restoreCheckState.status === 'error') {
    return {
      ...baseParams,
      status: 'error',
      errorMessage: restoreCheckState.errorMessage ?? 'Could not check cloud backups.',
    };
  }

  if (restoreCheckState.status === 'loading' || restoreCheckState.status === 'no-backup') {
    return {
      ...baseParams,
      status: restoreCheckState.status,
    };
  }

  return null;
}

function getRestoreCheckKey(params: RootStackParamList['RestoreCheck']): string {
  if (params.status === 'backup-found') return `restore-${params.status}-${params.latestRestoreBackup.fileId}`;
  if (params.status === 'error') return `restore-${params.status}-${params.errorMessage}`;
  return `restore-${params.status}`;
}

function getRestoreDetectionErrorMessage(err: unknown): string {
  if (err instanceof CloudBackupError) {
    switch (err.code) {
      case 'permission_denied':
        return 'Cloud backup access was denied or the backup server is not available.';
      case 'network_error':
        return 'Network failed while checking cloud backups.';
      case 'quota_exceeded':
        return 'Cloud backup storage quota is exceeded.';
      case 'storage_unavailable':
      case 'api_error':
      case 'invalid_response':
        return err.message;
    }
  }
  return 'Could not check cloud backups.';
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

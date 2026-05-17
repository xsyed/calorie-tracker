import type { RestoreBackupCandidate } from '../services/restoreService';

interface HomeRouteParams {
  focusLogInputRequestId?: string;
}

export type RootStackParamList = {
  Splash: undefined;
  Login: { message?: string } | undefined;
  Home: HomeRouteParams | undefined;
  Weight: undefined;
  Water: { date: string };
  Settings: undefined;
  RestoreCheck:
    | {
        status: 'loading';
        onStartFresh: () => void;
        onRetry: () => void;
        onRestoreComplete: () => void;
      }
    | {
        status: 'backup-found';
        restoreCandidates: RestoreBackupCandidate[];
        latestRestoreBackup: RestoreBackupCandidate;
        onStartFresh: () => void;
        onRetry: () => void;
        onRestoreComplete: () => void;
      }
    | {
        status: 'no-backup';
        onStartFresh: () => void;
        onRetry: () => void;
        onRestoreComplete: () => void;
      }
    | {
        status: 'error';
        errorMessage: string;
        onStartFresh: () => void;
        onRetry: () => void;
        onRestoreComplete: () => void;
      };
  Onboarding: {
    onOnboardingComplete?: () => void;
  } | undefined;
};

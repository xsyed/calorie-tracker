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
  Onboarding: {
    onOnboardingComplete?: () => void;
    onRestoreComplete?: () => void;
    onRestoreSkipped?: () => void;
    restoreCandidates?: RestoreBackupCandidate[];
    latestRestoreBackup?: RestoreBackupCandidate;
  } | undefined;
};

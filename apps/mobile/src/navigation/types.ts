import type { RestoreBackupCandidate } from '../services';

export type RootStackParamList = {
  Splash: undefined;
  Login: { message?: string } | undefined;
  Home: undefined;
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

export type RootTabParamList = {
  Home: undefined;
  Weight: undefined;
};

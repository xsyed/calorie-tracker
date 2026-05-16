import type { NavigatorScreenParams } from '@react-navigation/native';

import type { RestoreBackupCandidate } from '../services/restoreService';

interface HomeRouteParams {
  focusLogInputRequestId?: string;
}

export type RootStackParamList = {
  Splash: undefined;
  Login: { message?: string } | undefined;
  Home: NavigatorScreenParams<RootTabParamList> | undefined;
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
  Home: HomeRouteParams | undefined;
  Weight: undefined;
};

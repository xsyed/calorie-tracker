export type RootStackParamList = {
  Splash: undefined;
  Login: { message?: string } | undefined;
  Home: undefined;
  Onboarding: { onOnboardingComplete?: () => void } | undefined;
};

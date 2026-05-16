export type RootStackParamList = {
  Splash: undefined;
  Login: { message?: string } | undefined;
  Home: undefined;
  Water: { date: string };
  Onboarding: { onOnboardingComplete?: () => void } | undefined;
};

export type RootTabParamList = {
  Home: undefined;
  Weight: undefined;
};

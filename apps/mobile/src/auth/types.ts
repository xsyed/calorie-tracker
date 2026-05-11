import type { FirebaseAuthTypes } from '@react-native-firebase/auth';

export type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

export interface AuthState {
  status: AuthStatus;
  user: FirebaseAuthTypes.User | null;
}

export interface FirebaseAuthError {
  code: string;
  message: string;
}

export interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
  error: FirebaseAuthError | null;
}

export class PlayServicesUnavailableError extends Error {
  constructor(message = 'Google Play Services are not available') {
    super(message);
    this.name = 'PlayServicesUnavailableError';
  }
}

export class AuthConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthConfigurationError';
  }
}

export class AppleAuthConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppleAuthConfigurationError';
  }
}

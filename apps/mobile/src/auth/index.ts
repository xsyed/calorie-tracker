export { AuthProvider, useAuth } from './AuthContext';
export { mapAuthErrorMessage } from './errors';
export { signInWithGoogle } from './googleSignIn';
export { signInWithApple } from './appleSignIn';
export type {
  AuthContextValue,
  AuthState,
  AuthStatus,
  FirebaseAuthError,
} from './types';
export {
  AppleAuthConfigurationError,
  AuthConfigurationError,
  PlayServicesUnavailableError,
} from './types';

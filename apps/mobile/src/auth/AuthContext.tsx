import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import auth from '@react-native-firebase/auth';

import type { AuthContextValue, AuthState, FirebaseAuthError } from './types';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: 'checking',
    user: null,
  });
  const [error, setError] = useState<FirebaseAuthError | null>(null);

  useEffect(() => {
    try {
      const subscriber = auth().onAuthStateChanged((user) => {
        setState({
          status: user ? 'authenticated' : 'unauthenticated',
          user,
        });
      });
      return subscriber;
    } catch (err) {
      setState({ status: 'unauthenticated', user: null });
      setError({
        code: 'INIT_FAILED',
        message:
          err instanceof Error ? err.message : 'Firebase initialization failed',
      });
      return undefined;
    }
  }, []);

  const signOut = useCallback(async () => {
    await Promise.all([auth().signOut(), GoogleSignin.signOut()]);
  }, []);

  const getIdToken = useCallback(async (forceRefresh = false) => {
    const currentUser = auth().currentUser;
    if (!currentUser) {
      throw new Error('No authenticated user');
    }
    return currentUser.getIdToken(forceRefresh);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signOut,
      getIdToken,
      error,
    }),
    [state, signOut, getIdToken, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

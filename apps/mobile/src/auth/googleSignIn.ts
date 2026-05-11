import auth from '@react-native-firebase/auth';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';

import {
  AuthConfigurationError,
  PlayServicesUnavailableError,
} from './types';
import {
  createRateLimitError,
  isNativeErrorWithCode,
  isNativeFirebaseError,
} from './errors';

export async function signInWithGoogle(): Promise<
  FirebaseAuthTypes.UserCredential | { cancelled: true }
> {
  const hasServices = await GoogleSignin.hasPlayServices({
    showPlayServicesUpdateDialog: false,
  });
  if (!hasServices) {
    throw new PlayServicesUnavailableError();
  }

  let response;
  try {
    response = await GoogleSignin.signIn();
  } catch (err) {
    console.error(
      '[GoogleSignIn] stringify: %s',
      JSON.stringify(err, Object.getOwnPropertyNames(err), 2),
    );
    if (isNativeErrorWithCode(err)) {
      console.error(
        '[GoogleSignIn] code=%s message=%s nativeMessage=%s',
        err.code,
        err.message,
        (err as Record<string, unknown>).nativeErrorMessage ?? 'none',
      );
      if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new PlayServicesUnavailableError(err.message);
      }
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        return { cancelled: true };
      }
    }
    throw err;
  }

  if (response.type === 'cancelled') {
    return { cancelled: true };
  }

  const { idToken } = response.data;
  if (!idToken) {
    throw new AuthConfigurationError(
      'No idToken returned from Google Sign-In. Verify webClientId is configured.',
    );
  }

  try {
    const credential = auth.GoogleAuthProvider.credential(idToken);
    return await auth().signInWithCredential(credential);
  } catch (err) {
    if (isNativeFirebaseError(err)) {
      if (err.code === 'auth/too-many-requests') {
        throw createRateLimitError(err);
      }
      if (
        err.code === 'auth/operation-not-allowed' ||
        err.code === 'auth/invalid-credential'
      ) {
        throw new AuthConfigurationError(err.message);
      }
    }
    throw err;
  }
}

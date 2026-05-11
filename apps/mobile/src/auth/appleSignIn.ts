import { Platform } from 'react-native';
import auth from '@react-native-firebase/auth';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import appleAuth from '@invertase/react-native-apple-authentication';
import { sha256 } from 'js-sha256';

import {
  AuthConfigurationError,
  AppleAuthConfigurationError,
} from './types';
import {
  createRateLimitError,
  isNativeErrorWithCode,
  isNativeFirebaseError,
} from './errors';

export async function signInWithApple(): Promise<
  FirebaseAuthTypes.UserCredential | { cancelled: true }
> {
  if (Platform.OS !== 'ios') {
    throw new Error('Apple Sign-In is not available on Android');
  }

  const rawNonce = generateNonce();
  const hashedNonce = sha256(rawNonce);

  let appleResponse;
  try {
    appleResponse = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      nonce: rawNonce,
    });
  } catch (err) {
    if (isNativeErrorWithCode(err)) {
      if (err.code === appleAuth.Error.CANCELED) {
        return { cancelled: true };
      }
      throw new AppleAuthConfigurationError(
        `Apple Sign-In failed (${err.code}): ${err.message}. ` +
          'Verify Sign In with Apple capability is enabled in Xcode ' +
          'and the correct Service ID is configured in Firebase console.',
      );
    }
    throw err;
  }

  const { identityToken } = appleResponse;
  if (!identityToken) {
    throw new AppleAuthConfigurationError(
      'Apple Sign-In returned an empty identityToken. ' +
        'Verify the Service ID is correctly configured in the Firebase console.',
    );
  }

  try {
    const credential = auth.AppleAuthProvider.credential(
      identityToken,
      hashedNonce,
    );
    return await auth().signInWithCredential(credential);
  } catch (err) {
    if (isNativeFirebaseError(err)) {
      if (err.code === 'auth/too-many-requests') {
        throw createRateLimitError(err);
      }
      if (err.code === 'auth/network-request-failed') {
        throw new Error(
          `Network error during Apple Sign-In: ${err.message}`,
        );
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

function generateNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

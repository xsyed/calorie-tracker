import {
  AppleAuthConfigurationError,
  AuthConfigurationError,
  PlayServicesUnavailableError,
} from './types';

export function isNativeErrorWithCode(
  err: unknown,
): err is { code: string; message: string } {
  return (
    err instanceof Error &&
    'code' in err &&
    typeof (err as Record<string, unknown>).code === 'string'
  );
}

export function isNativeFirebaseError(
  err: unknown,
): err is {
  code: string;
  message: string;
  nativeErrorMessage?: string;
  [key: string]: unknown;
} {
  return (
    isNativeErrorWithCode(err) &&
    err.code.startsWith('auth/')
  );
}

export function createRateLimitError(err: {
  message: string;
  nativeErrorMessage?: string;
  [key: string]: unknown;
}) {
  const message =
    err.nativeErrorMessage ||
    err.message ||
    'Too many sign-in requests';
  const retryAfter = extractRetryAfter(err);
  const error = Object.assign(new Error(message), { retryAfter });
  return error;
}

export function mapAuthErrorMessage(err: unknown): string {
  if (
    err instanceof AuthConfigurationError ||
    err instanceof AppleAuthConfigurationError
  ) {
    return 'Authentication service unavailable';
  }
  if (err instanceof PlayServicesUnavailableError) {
    return 'Google Play Services are not available';
  }
  if (err instanceof Error && 'retryAfter' in err) {
    const retryAfter = (err as Record<string, unknown>).retryAfter;
    if (typeof retryAfter === 'number') {
      const minutes = Math.ceil(retryAfter / 60);
      return `Too many attempts. Try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`;
    }
    return 'Too many attempts. Try again later.';
  }
  if (err instanceof Error) {
    if (
      'code' in err &&
      typeof (err as Record<string, unknown>).code === 'string'
    ) {
      const code = (err as Record<string, unknown>).code as string;
      if (code === 'auth/network-request-failed') {
        return 'No internet connection';
      }
      if (code === 'auth/too-many-requests') {
        return 'Too many attempts. Try again later.';
      }
      if (code === 'auth/service-unavailable') {
        return 'Service temporarily unavailable';
      }
    }
    if (err.message.toLowerCase().includes('network')) {
      return 'No internet connection';
    }
    return err.message;
  }
  return 'An unexpected error occurred';
}

function extractRetryAfter(err: {
  [key: string]: unknown;
}): number | undefined {
  if (typeof err.retryAfter === 'number') {
    return err.retryAfter;
  }
  const userInfo = err.userInfo;
  if (
    typeof userInfo === 'object' &&
    userInfo !== null &&
    typeof (userInfo as Record<string, unknown>).retryAfter === 'number'
  ) {
    return (userInfo as Record<string, unknown>).retryAfter as number;
  }
  const msg = err.message;
  if (typeof msg === 'string') {
    const match = msg.match(/retry after (\d+)/i);
    if (match?.[1]) {
      return parseInt(match[1], 10);
    }
  }
  return undefined;
}

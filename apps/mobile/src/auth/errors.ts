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

import { type RequestHandler } from "express";

import { type FirebaseAuthVerifier } from "../firebaseAuth.js";
import { HttpError } from "../httpError.js";
import { createTokenHash, getErrorContext, logWarn } from "../logger.js";

const BEARER_PREFIX = "Bearer ";
const FIREBASE_AUTH_ERROR_CODES = new Set([
  "auth/argument-error",
  "auth/id-token-expired",
  "auth/id-token-revoked",
  "auth/invalid-credential",
  "auth/invalid-id-token",
]);

export function requireFirebaseAuth(authVerifier: FirebaseAuthVerifier): RequestHandler {
  return async (request, _response, next) => {
    const token = getBearerToken(request.header("authorization"));

    if (token === undefined) {
      next(new HttpError(401, "missing_token", "Authorization bearer token is required."));
      return;
    }

    if (!isJwt(token)) {
      next(new HttpError(401, "invalid_token", "Firebase ID token is invalid."));
      return;
    }

    try {
      const decodedToken = await authVerifier.verifyIdToken(token);
      request.auth = { uid: decodedToken.uid };
      next();
    } catch (error) {
      logAuthVerificationFailure(error, token);
      next(mapAuthError(error));
    }
  };
}

function getBearerToken(header: string | undefined): string | undefined {
  if (!header?.startsWith(BEARER_PREFIX)) {
    return undefined;
  }

  const token = header.slice(BEARER_PREFIX.length).trim();
  return token === "" ? undefined : token;
}

function mapAuthError(error: unknown): HttpError {
  if (isFirebaseAuthError(error)) {
    return new HttpError(401, "invalid_token", "Firebase ID token is invalid.");
  }

  return new HttpError(503, "auth_service_unavailable", "Firebase Auth verification failed.");
}

function logAuthVerificationFailure(error: unknown, token: string): void {
  logWarn("firebase_auth_verification_failed", {
    token_hash: createTokenHash(token),
    mapped_status: isFirebaseAuthError(error) ? 401 : 503,
    ...getErrorContext(error),
  });
}

function isJwt(token: string): boolean {
  const parts = token.split(".");
  return parts.length === 3 && parts.every((part) => part !== "");
}

function isFirebaseAuthError(error: unknown): error is { readonly code: string } {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && typeof error.code === "string"
    && FIREBASE_AUTH_ERROR_CODES.has(error.code);
}

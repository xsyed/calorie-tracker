# Task: Apple Sign-In

**Feature:** [01-authentication](../docs/features/01-authentication.md)

## Goal

Implement Apple Sign-In as an auth provider, allowing users to authenticate with their Apple ID and receive a Firebase credential.

## Description

Install and configure `react-native-apple-authentication`. Implement the `signInWithApple()` function that:
1. Generates a cryptographically random nonce (required by Apple for security)
2. Calls `appleAuth.performRequest()` with scopes `[Scope.EMAIL, Scope.FULL_NAME]` and the nonce
3. Extracts `identityToken` and the nonce from the Apple auth response
4. Creates a Firebase credential via `appleAuth.AppleAuthProvider.credential(identityToken, nonce)`
5. Calls `auth().signInWithCredential(credential)` to authenticate with Firebase
6. The `onAuthStateChanged` listener (Task 01) picks up the state change — this function does not need to update context directly

Handle Apple-specific error cases: user cancellation (no error displayed), Apple Sign-In not configured (entitlements missing), rate limiting, and general auth failures.

## Acceptance Criteria

- [ ] `react-native-apple-authentication` (or `@invertase/react-native-apple-authentication`) installed and linked
- [ ] `signInWithApple()` exported as a standalone async function
- [ ] Nonce generation uses `crypto.getRandomValues` (or equivalent) — produces a random string, SHA-256 hashed for Firebase
- [ ] Happy path: calling `signInWithApple()` triggers Apple OAuth dialog → extracts `identityToken` + nonce → creates Firebase credential → `signInWithCredential` succeeds → `onAuthStateChanged` fires with user
- [ ] User cancellation: catches `appleAuth.Error.CANCELED` — does NOT throw, returns `{ cancelled: true }`
- [ ] Apple Sign-In not configured (missing entitlements, wrong Service ID): catches and throws `AppleAuthConfigurationError` with debug-friendly message
- [ ] Rate limit (`auth/too-many-requests`): catches and throws with `retryAfter` extracted from error if available
- [ ] Network error during sign-in: catches and throws with descriptive message
- [ ] Firebase misconfiguration error: catches and throws with `AuthConfigurationError`
- [ ] Function compiles and is callable on Android (returns a clear "Apple Sign-In is not available on Android" error) — does not crash
- [ ] `identityToken` returned by Apple is a non-empty string before creating Firebase credential (validates the Apple response)

## Dependencies

- [01-auth-foundation](./01-auth-foundation.md) — Firebase Auth SDK must be initialized and `onAuthStateChanged` listener active

## Notes

- This task does NOT render UI. The Login Screen (Task 04) calls `signInWithApple()` and handles error display.
- Apple Sign-In requires: Sign in with Apple capability in Xcode, Service ID in Apple Developer portal, and the Service ID configured in Firebase console. These are configuration prerequisites.
- The function returns `{ cancelled: true }` on user dismissal rather than throwing — cancellation is intentional, not an error (per feature doc).
- On Android, Apple Sign-In is unavailable. The function should return a clear error immediately rather than crashing. The Login Screen (Task 04) should hide the Apple button on Android.
- The nonce must be SHA-256 hashed before passing to `AppleAuthProvider.credential()`. Firebase requires the hashed nonce; the raw nonce is sent to Apple in `performRequest`.

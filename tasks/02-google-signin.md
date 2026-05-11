# Task: Google Sign-In

**Feature:** [01-authentication](../docs/features/01-authentication.md)

## Goal

Implement Google Sign-In as an auth provider, allowing users to authenticate with their Google account and receive a Firebase credential.

## Description

Install and configure `@react-native-google-signin/google-signin`. Implement the `signInWithGoogle()` function that:
1. Calls `GoogleSignin.signIn()` to trigger the OS-level Google OAuth flow
2. Extracts the `idToken` from the Google sign-in result
3. Creates a Firebase credential via `GoogleAuthProvider.credential(idToken)`
4. Calls `auth().signInWithCredential(credential)` to authenticate with Firebase
5. The `onAuthStateChanged` listener (Task 01) picks up the state change — this function does not need to update context directly

Handle Google-specific error cases: user cancellation (no error displayed), Play Services missing (report availability), rate limiting (cooldown message), and general auth failures.

## Acceptance Criteria

- [ ] `@react-native-google-signin/google-signin` installed and linked for iOS and Android
- [ ] `GoogleSignin.configure()` called at app startup with `webClientId` from Firebase project
- [ ] `signInWithGoogle()` exported as a standalone async function
- [ ] Happy path: calling `signInWithGoogle()` triggers Google OAuth flow → returns Firebase `UserCredential` → `onAuthStateChanged` fires with user
- [ ] `GoogleSignin.hasPlayServices()` called before sign-in on Android; returns `{ hasPlayServices: boolean }`
- [ ] If Play Services unavailable: function throws a typed error `PlayServicesUnavailableError` — no OAuth flow attempted
- [ ] User cancellation: catches `SIGN_IN_CANCELLED` / equivalent error code — does NOT throw, returns `{ cancelled: true }`
- [ ] Rate limit (`auth/too-many-requests`): catches and throws with `retryAfter` extracted from Firebase error if available
- [ ] Network error during sign-in: catches and throws with descriptive message
- [ ] Firebase misconfiguration error (wrong SHA-256, missing URL scheme): catches and throws with `AuthConfigurationError`
- [ ] All Google-specific error codes translated to typed errors (not raw string codes)
- [ ] Function works on iOS: uses the same `signInWithGoogle()` interface (GoogleSignin SDK handles platform differences)

## Dependencies

- [01-auth-foundation](./01-auth-foundation.md) — Firebase Auth SDK must be initialized and `onAuthStateChanged` listener active

## Notes

- This task does NOT render UI. The Login Screen (Task 04) calls `signInWithGoogle()` and handles error display.
- Google Sign-In requires a `webClientId` from Firebase console (OAuth client ID). This is a configuration prerequisite.
- The function returns `{ cancelled: true }` on user dismissal rather than throwing — cancellation is intentional, not an error (per feature doc: "Do not show error — cancellation is intentional").
- On Android, `GoogleSignin.hasPlayServices()` must be called. The result is used by the Login Screen (Task 04) to conditionally hide the Google button.

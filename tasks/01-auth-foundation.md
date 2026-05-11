# Task: Auth Foundation

**Feature:** [01-authentication](../docs/features/01-authentication.md)

## Goal

Initialize Firebase Auth SDK, implement the auth state observer, and create the auth context that all other auth tasks and the rest of the app depend on.

## Description

This task sets up the Firebase Auth backbone: SDK installation, initialization at app entry, the `onAuthStateChanged` listener, and a React context providing auth state to the component tree. No sign-in methods are implemented here — those come in tasks 02 and 03. The context exposes: current user (or null), loading/authenticated/unauthenticated state, a `signOut` function, and a `getIdToken` utility.

Token lifecycle (silent refresh, credential revocation polling, secure storage persistence) is handled internally by the Firebase SDK. This task verifies that SDK behavior works but does not implement token management.

## Acceptance Criteria

- [ ] `@react-native-firebase/app` and `@react-native-firebase/auth` installed and linked for iOS and Android
- [ ] Firebase initialized at app entry point without errors on both platforms
- [ ] `onAuthStateChanged` fires on app launch: emits `null` when no session, emits `User` when cached session exists
- [ ] Auth state exposed via React context as `{ status: 'checking' | 'authenticated' | 'unauthenticated', user: FirebaseUser | null }`
- [ ] Context exposes `signOut()`: calls `auth().signOut()`, clears in-memory state, resets context to `unauthenticated`
- [ ] Context exposes `getIdToken(forceRefresh?: boolean)`: returns a valid Firebase ID token string; throws with meaningful error if unavailable
- [ ] `signOut()` does NOT touch SQLite — user data persists for potential re-sign-in
- [ ] If Firebase initialization fails (e.g. misconfigured `google-services.json` / `GoogleService-Info.plist`), app does not crash — error is caught and auth context enters an error state
- [ ] When `onAuthStateChanged` fires `null` due to account deletion server-side, context transitions to `unauthenticated` cleanly
- [ ] Firebase SDK internally handles token auto-refresh (~55 min interval) — manual verification: call `getIdToken(true)` and confirm a fresh token is returned
- [ ] TypeScript types defined for: `AuthState`, `AuthContextValue`, and any auth-specific error types

## Dependencies

None.

## Notes

- The auth context does NOT contain `signInWithGoogle` or `signInWithApple` methods. Those are standalone functions exported by tasks 02 and 03. Calling `signInWithCredential` triggers `onAuthStateChanged`, which updates the context automatically.
- Firebase project setup (enabling Auth in console, downloading config files) is a prerequisite handled outside this task. This task assumes the native config files exist.
- Background jobs (token refresh, auth persistence check, credential revocation) are Firebase SDK internals. No code to write — just verify they work.

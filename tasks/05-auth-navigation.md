# Task: Auth Navigation Guard & Post-Login Routing

**Feature:** [01-authentication](../docs/features/01-authentication.md)

## Goal

Implement the root navigation guard that routes users based on authentication state and User record existence, plus handle sign-out, session expiry, and backend outage scenarios.

## Description

Set up the root navigator with three routes protected by an auth gate:

```
App Launch
  │
  ▼
Auth Gate (reads auth context from Task 01)
  │
  ├── status = 'checking'      → Splash / loading screen
  ├── status = 'unauthenticated' → Login screen (Task 04)
  └── status = 'authenticated'   → Check SQLite User row
        │
        ├── row exists (returning user) → Home (placeholder)
        └── no row (new user)           → Onboarding (placeholder)
```

Implement the SQLite User row check. Create a minimal User table (`id TEXT PK, firebase_uid TEXT UNIQUE NOT NULL`) via op-sqlite as part of this task. Expose a `userExists(firebaseUid: string): Promise<boolean>` query. This minimal schema is extended by the Onboarding feature later.

Handle sign-out: when user triggers sign-out (via context's `signOut()`), the auth context transitions to `unauthenticated`, and the guard re-routes to Login. SQLite data is NOT deleted.

Handle forced sign-out on token refresh failure: if `getIdToken(true)` throws (indicating revoked/expired session), call `signOut()` and redirect to Login with a "Session expired. Please sign in again." message.

## Acceptance Criteria

- [ ] Root navigator (React Navigation Stack) set up with auth gate as the entry point
- [ ] `status = 'checking'`: renders a splash/loading indicator (no UI interaction)
- [ ] `status = 'unauthenticated'`: renders Login screen (Task 04); user cannot navigate away from it
- [ ] `status = 'authenticated'`: runs `userExists(auth.user.uid)` query
- [ ] `userExists()` returns `true` → navigates to Home placeholder screen
- [ ] `userExists()` returns `false` → navigates to Onboarding placeholder screen
- [ ] op-sqlite installed and database initialized with User table containing: `id TEXT PRIMARY KEY, firebase_uid TEXT UNIQUE NOT NULL`
- [ ] `userExists(firebaseUid)` queries `SELECT 1 FROM User WHERE firebase_uid = ? LIMIT 1` — returns boolean
- [ ] Home placeholder screen: displays "Home" text — no functionality beyond confirming correct routing
- [ ] Onboarding placeholder screen: displays "Onboarding" text — no functionality beyond confirming correct routing
- [ ] When `signOut()` is called from auth context: guard re-routes to Login screen; Home/Onboarding unmounted
- [ ] SQLite User table rows persist after sign-out (verify: sign in → user row exists → sign out → sign back in → user row still exists)
- [ ] Cached session (app relaunch with valid token): guard skips Login, goes directly to User row check → Home or Onboarding
- [ ] Token refresh failure: if `getIdToken(true)` rejects, guard calls `signOut()` and navigates to Login with error message passed as route param: "Session expired. Please sign in again."
- [ ] The Login screen (Task 04) displays the route param message if present (e.g., "Session expired...")
- [ ] Firebase Auth backend outage for new users (auth context status = `unauthenticated`): Login screen shows "Service temporarily unavailable" — sign-in buttons still visible for retry
- [ ] Firebase Auth backend outage for existing users (cached session valid, but token refresh fails): guard keeps user on current screen; does NOT force sign-out immediately. LLM calls will fail — that is handled by the LLM service layer, not auth.

## Dependencies

- [01-auth-foundation](./01-auth-foundation.md) — auth context for reading `status` and `user`
- [04-login-screen](./04-login-screen.md) — Login screen component for unauthenticated route

## Notes

- The User table created here is minimal (id, firebase_uid). The full schema (gender, height, daily_target_calories, etc.) is owned by the [Onboarding feature](../docs/features/02-onboarding.md). Onboarding will ADD columns or recreate the table — this task only creates what it needs for the existence check.
- Home and Onboarding are placeholder screens in this task. Real implementations come from their respective feature tasks. The guard just needs to route correctly.
- React Navigation setup (installing packages, creating NavigationContainer) is in scope for this task since it's the root navigator.
- The LLM service layer (not auth) is responsible for catching 401/403 responses and triggering the forced sign-out path. This task provides the mechanism (signOut on getIdToken failure) but does not integrate with the LLM service — that integration happens in the LLM logging feature.
- "Keep showing current data (read-only) during backend outage" is a product-level behavior. This task only ensures the auth guard doesn't preemptively sign users out when token refresh fails transiently. The actual "read-only mode" is a broader concern across multiple features.

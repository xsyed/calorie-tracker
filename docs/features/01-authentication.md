# TDD: Authentication

## Feature Summary
Firebase Auth with Google and Apple sign-in only. No email/password login. Auth is the first screen — user must sign in before any app functionality is available.

---

## Data Flow

```
App Launch
  │
  ▼
Firebase Auth SDK onAuthStateChanged listener fires
  │
  ├── (user = null, no cached session)
  │     │
  │     ▼
  │   Render Login screen
  │     │
  │     ▼
  │   User taps "Sign in with Google" or "Sign in with Apple"
  │     │
  │     ▼
  │   Firebase SDK triggers OS-level OAuth flow
  │     ├── Google: GoogleSignin.signIn() → idToken → Firebase credential
  │     └── Apple: appleAuth.performRequest() → identityToken + nonce → Firebase credential
  │     │
  │     ▼
  │   signInWithCredential(firebaseCredential) → Firebase Auth user created/retrieved
  │     │
  │     ▼
  │   getIdTokenResult() → extract JWT claims
  │     │
  │     ▼
  │   Token stored in React Native state (refreshed automatically by Firebase SDK)
  │     │
  │     ▼
  │   Check User row in local SQLite by firebase_uid
  │     ├── (no row) → user is new → navigate to Onboarding
  │     └── (row exists) → user is returning → navigate to Home
  │
  └── (user != null, cached session restored)
        │
        ▼
      Token refreshed silently by Firebase SDK
        │
        ▼
      Skip Login → navigate to Onboarding or Home (same check as above)
```

---

## APIs Involved

| API | Role | Protocol |
|---|---|---|
| Firebase Auth SDK (@react-native-firebase/auth) | User identity, session management, token lifecycle | Native SDK → Firebase REST |
| Google Sign-In SDK (@react-native-google-signin/google-signin) | Google OAuth flow, return `idToken` | Native SDK → Google OAuth |
| Apple Sign-In (react-native-apple-authentication) | Apple OAuth flow, return `identityToken` + `nonce` | Native SDK → Apple OAuth |
| Firebase Auth REST API (idToolkit) | Token verification, token refresh | HTTPS REST |
| Keychain / Keystore (OS-level) | Secure token storage (handled by Firebase SDK internally) | OS Secure Storage |

---

## State Management

| State | Storage | Lifespan |
|---|---|---|
| Firebase User object (uid, email, displayName, photoURL) | In-memory (Firebase SDK holds reference) | App session |
| Firebase ID Token (JWT) | In-memory, auto-refreshed by Firebase SDK every ~55 minutes | App session, refreshed |
| Auth loading state (checking / authenticated / unauthenticated) | Component state (auth context or hook) | App session |
| Login error state (provider-specific errors, cancellations) | Component state, cleared on retry | Ephemeral |
| firebase_uid (foreign key for all User data) | SQLite User table | Persistent |

Auth state is consumed by:
- All LLM service calls (Bearer token in Authorization header)
- Backup service (Google Drive auth requires same Google account)
- Offline queue flusher (needs valid token to flush)

---

## Background Jobs

| Job | Trigger | Behavior |
|---|---|---|
| Firebase token auto-refresh | ~5 minutes before token expiry (55-min interval) | Firebase SDK internally fetches new token from Firebase Auth backend. App code gets fresh token via `getIdToken(true)` |
| Auth state persistence check | App launch | Firebase SDK reads cached credentials from secure storage. If valid, `onAuthStateChanged` fires immediately with user. If expired, attempts silent refresh. If refresh fails, fires null. |
| Credential revocation polling | Periodic (~every 30 min, Firebase internal) | Firebase SDK validates session hasn't been revoked server-side |

---

## Battery / Performance Impact

- **Battery**: Negligible. OAuth flows are one-time user-initiated actions. Token refresh is a single HTTPS call every ~55 minutes — imperceptible.
- **Performance**: Login screen renders instantly (no network dependency for UI). OAuth flow latency depends on provider (Google/Apple), typically 1-3 seconds. Silent token refresh happens on background thread, doesn't block UI.
- **Cold start**: Firebase SDK initialization on app launch adds ~200-500ms. Auth state restoration from secure storage is synchronous on iOS, async on Android — should be imperceptible.

---

## Failure Scenarios

| Failure | Cause | User Impact | Handling |
|---|---|---|---|
| **No network during sign-in** | Airplane mode, no connectivity | Cannot authenticate | Show "No internet connection" inline error. Do not block UI — user can retry. |
| **Google Play Services missing** (Android) | Device without Google Play Services (e.g. Huawei, some Chinese ROMs) | Google Sign-In button non-functional | Detect availability at startup. If unavailable, hide Google button, show only Apple (iOS) or "no sign-in methods available" message. |
| **Apple Sign-In not configured** | Missing Entitlements, missing Service ID in Apple Developer | Sign-in fails silently or with generic error | Catch Apple auth errors specifically. Log detailed error for debugging. Show user-friendly "Sign in failed" with retry. |
| **User cancels OAuth flow** | User dismisses Google/Apple consent screen | No auth, user stays on Login screen | Firebase returns error code `auth/user-cancelled` or equivalent. Do not show error — cancellation is intentional. |
| **Firebase project misconfigured** | Missing SHA-256 fingerprint (Android), missing URL scheme (iOS), wrong bundle ID | Sign-in fails with configuration error | Catch Firebase auth errors. Log full error details. Show "Authentication service unavailable" with retry. This is a dev/setup issue, not a user issue — but must handle gracefully. |
| **Token expired, refresh fails** | Refresh token revoked server-side, account disabled, Firebase backend unreachable | `getIdToken()` throws → LLM calls fail → offline queue stalls | The LLM service layer must handle 401/403 responses. On auth failure: force sign-out, clear local state, redirect to Login with message "Session expired. Please sign in again." |
| **User deletes Firebase account** | User deletes account from another device or Firebase console | `onAuthStateChanged` fires null. App redirects to Login. | All local data becomes orphaned (no firebase_uid match). On next sign-in with same provider = new Firebase UID = new User row. Old data inaccessible but not deleted (user can restore only if same auth provider creates same UID — not guaranteed). Consider: warn user that deleting Firebase account makes backup data irrecoverable. |
| **Rate limit on Firebase Auth API** | Too many sign-in attempts from same IP/device | Sign-in returns `auth/too-many-requests` | Show cooldown message with wait time. Firebase typically returns `retryAfter` in response. |
| **Firebase Auth backend outage** | Firebase Auth service degraded | Cannot sign in, token refresh fails for existing users | `onAuthStateChanged` may fire null after refresh attempts fail. Existing users: keep showing current data (read-only), queue LLM calls for when auth restores. New users: show "Service temporarily unavailable" with retry. |

---

## Constraints
- No email/password auth. Google + Apple only.
- Auth is mandatory before any app screen is accessible (design decision #5).
- On sign-out: clear all local state, reset to Login screen. Do NOT delete SQLite data (user may sign back in with same account and access backups).

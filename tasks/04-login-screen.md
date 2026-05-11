# Task: Login Screen

**Feature:** [01-authentication](../docs/features/01-authentication.md)

## Goal

Build the Login screen — the first screen an unauthenticated user sees — with branded Google and Apple sign-in buttons, loading state, and error display.

## Description

Create the Login screen component rendered when the auth context status is `unauthenticated`. The screen displays:
- App name / logo placeholder
- "Sign in with Google" button (branded per Google guidelines)
- "Sign in with Apple" button (branded per Apple guidelines)
- Loading indicator while a sign-in is in progress
- Inline error message area for sign-in failures

Button visibility adapts to platform capability:
- On Android: hide Google button if `GoogleSignin.hasPlayServices()` returns `false`
- On Android: hide Apple button entirely (Apple Sign-In unavailable)
- On iOS: both buttons visible

Errors displayed inline (not in alerts/toasts): network errors, service unavailable, rate limit cooldown, configuration errors. Cancellation does NOT show an error.

## Acceptance Criteria

- [ ] Login screen renders when auth context status is `unauthenticated`
- [ ] "Sign in with Google" button is visible, styled with Google brand colors, and calls `signInWithGoogle()` on press
- [ ] "Sign in with Apple" button is visible (iOS), styled with Apple brand colors, and calls `signInWithApple()` on press
- [ ] On Android: Apple button is hidden. Google button is hidden if `GoogleSignin.hasPlayServices()` returns `false`
- [ ] On iOS: both buttons are visible
- [ ] During sign-in: a loading indicator replaces/is shown over the buttons; buttons are disabled to prevent double-tap
- [ ] On `{ cancelled: true }` returned: loading indicator dismissed, no error shown, buttons re-enabled — user stays on Login screen
- [ ] On sign-in error: loading indicator dismissed, error message displayed inline below buttons, buttons re-enabled for retry
- [ ] Network error message: "No internet connection" — does not block UI, user can retry
- [ ] Rate limit error: shows cooldown message with wait time if `retryAfter` available, otherwise generic "Too many attempts. Try again later."
- [ ] Service unavailable (Firebase backend outage): "Service temporarily unavailable" with retry
- [ ] Configuration error (Firebase/Google/Apple misconfigured): "Authentication service unavailable" with retry
- [ ] Play Services unavailable (Android): Google button hidden; Apple button also hidden → screen shows "No sign-in methods available on this device"
- [ ] Error messages clear when user taps a sign-in button to retry
- [ ] Screen has no back-navigation (auth is first screen, nowhere to go back to)

## Dependencies

- [02-google-signin](./02-google-signin.md) — `signInWithGoogle()` function
- [03-apple-signin](./03-apple-signin.md) — `signInWithApple()` function

## Notes

- Google and Apple have brand guidelines for sign-in buttons. Follow them exactly — do not invent custom styling.
- The Login screen is a dead-end (no back navigation). The only way off is successful authentication, which triggers the navigation guard (Task 05).
- If neither sign-in method is available (Android without Play Services), show the message rather than a blank screen.
- The app name/logo at the top is a placeholder — final branding is out of scope.
- This screen does NOT check auth state itself — it relies on the auth context from Task 01. It only renders when the context status is `unauthenticated`.

# Notification Tap Home Focus

## Goal
Route meal reminder notification taps to Home with the logging input focused.

## Description
Handle notification press events from cold start, background, and foreground states. When a meal reminder notification is tapped, open the app to the authenticated Home screen and focus the text input so the user can start logging immediately.

This task does not schedule notifications or build the Settings reminder form.

## Acceptance Criteria
- [ ] Notification press handling recognizes reminder notification data produced by the scheduling service.
- [ ] Tap handling covers the notification library events, `AppState`, or `Linking` hooks needed for cold start and resumed app paths.
- [ ] Tapping a meal reminder opens the app to Home when the app is closed.
- [ ] Tapping a meal reminder navigates to Home when the app is backgrounded on another screen.
- [ ] Tapping a meal reminder while already in the app navigates to Home without creating duplicate navigation state.
- [ ] Home receives a typed route parameter or equivalent event that requests input focus.
- [ ] The Home text input focuses after navigation is ready.
- [ ] Auth-aware routing is respected: unauthenticated users are not forced past Login or Onboarding.
- [ ] Non-reminder notifications, if any exist later, are ignored by this handler.
- [ ] `npm run check` passes.

## Dependencies
- `12-03-reminder-scheduling-service.md`

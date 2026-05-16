# Notification Permissions and Channel

## Goal
Add the local notification foundation needed by meal reminders.

## Description
Integrate a React Native local notification library for on-device reminders and expose a small app service for notification permission state, permission requests, system settings handoff, and Android channel setup.

Prefer a single cross-platform library such as Notifee unless the project already has an approved local notification dependency. This task only prepares the OS notification surface. It does not schedule meal reminders or build the reminder form.

## Acceptance Criteria
- [ ] The app has a local notification dependency capable of scheduling weekly repeating local notifications on Android and iOS.
- [ ] A notification service can read the current notification permission status.
- [ ] A notification service can request notification permission at the point the UI needs it.
- [ ] Denied or blocked permission states are represented explicitly for the Settings UI.
- [ ] Android creates a `meal-reminders` notification channel with default importance, default sound, and vibration suitable for tray notifications without heads-up behavior.
- [ ] Android channel-blocked state can be detected and reported distinctly from general notification permission denial.
- [ ] The service can open the relevant system settings screen when notifications or the meal reminders channel are disabled.
- [ ] iOS notification setup uses normal alert notifications and does not request critical alerts.
- [ ] `npm run check` passes.

## Dependencies
None

# Reminder Scheduling Service

## Goal
Schedule, cancel, and reschedule meal reminder notifications from saved reminder configuration.

## Description
Create the scheduling layer that translates enabled reminder rows into OS local notifications. Saving a new config should cancel previously scheduled meal reminder notifications and create the current weekly repeating schedule for enabled days only.

This task does not build Settings UI or notification tap navigation.

## Acceptance Criteria
- [ ] A scheduling service loads reminder config for the current user and schedules only enabled reminders when overall reminders are enabled.
- [ ] Existing scheduled meal reminder notifications are cancelled before a new schedule is applied.
- [ ] Disabling overall reminders cancels existing scheduled meal reminder notifications.
- [ ] Each enabled reminder schedules one weekly repeating notification per enabled day of week.
- [ ] Notification title is `Time to log your meal`.
- [ ] Notification body includes the reminder type, such as `Log your breakfast`.
- [ ] Notification data includes enough information to identify a meal reminder and route to Home.
- [ ] Android notifications use the `meal-reminders` channel.
- [ ] iOS scheduling uses repeating weekly triggers so the app stays below scheduled notification limits for the default 21-reminder schedule.
- [ ] Scheduling checks the resulting pending notification count and reports a clear error or warning before unsafe limits are reached.
- [ ] Duplicate reminder times are allowed and schedule as separate notifications.
- [ ] The service exposes one reschedule entry point reusable by Settings save, restore, and platform recovery flows.
- [ ] Scheduling is entirely on-device and does not introduce backend push notifications or an app background service.
- [ ] `npm run check` passes.

## Dependencies
- `12-01-reminder-storage.md`
- `12-02-notification-permissions-and-channel.md`

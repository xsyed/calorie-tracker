# Reminder Storage

## Goal
Add persistent SQLite storage and repository support for meal reminder configuration.

## Description
Create the local persistence surface for reminder settings. Store one row per reminder slot for the signed-in user, including reminder type, time, enabled state, and enabled days of week. Provide explicit defaults for a user with no saved reminders so Settings can render Breakfast, Lunch, and Dinner without creating records until the user saves.

This task does not schedule notifications, request permissions, or build the Settings UI.

## Acceptance Criteria
- [ ] A SQLite migration adds reminder storage with one row per reminder slot for a user.
- [ ] Each reminder row stores `user_id`, reminder type, local time, enabled state, and enabled days of week.
- [ ] Reminder types cover Breakfast, Lunch, Dinner, and optional Snack/custom slots if supported by the chosen model.
- [ ] Repository reads return default slots for a user with no saved config: Breakfast 08:00, Lunch 13:00, Dinner 19:00.
- [ ] Repository writes can create, update, disable, and delete reminder slots without duplicating a slot for the same user/type.
- [ ] Overall reminders enabled state is persisted either with the reminder config or existing settings storage.
- [ ] Day-of-week storage has a typed repository contract so callers do not parse ad hoc strings.
- [ ] Empty-state reads return explicit defaults suitable for the Settings screen.
- [ ] `npm run check` passes.

## Dependencies
None

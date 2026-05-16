# Settings Reminders UI

## Goal
Add a Settings section where users can configure and save meal reminders.

## Description
Build the reminder configuration UI in Settings using existing React Native `StyleSheet` patterns. Users can enable or disable reminders, set times per meal slot, select days of week, and save changes. The UI must handle denied notification permission and blocked Android channel states before letting users configure reminders that cannot fire.

This task wires Settings to the reminder repository, permission service, and scheduling service.

## Acceptance Criteria
- [ ] Settings includes a Reminders section.
- [ ] The section renders the overall enable meal reminders toggle.
- [ ] Default slots render as Breakfast 08:00, Lunch 13:00, and Dinner 19:00 for users with no saved config.
- [ ] Each reminder slot has an enabled toggle, editable time, and day-of-week selection.
- [ ] Snack or add-reminder behavior is available only if the storage model supports optional slots.
- [ ] The UI supports selecting every day without requiring seven separate manual taps.
- [ ] Unsaved reminder edits remain local component state until the user taps Save.
- [ ] Save persists the reminder config to SQLite and then invokes the scheduling service.
- [ ] Turning overall reminders off cancels scheduled meal reminders when saved.
- [ ] Turning overall reminders back on does not schedule stale values until the user saves.
- [ ] If notification permission is denied, the section shows clear disabled-state copy and an Open Settings action instead of an editable form.
- [ ] If the Android meal reminder channel is blocked, the section shows clear blocked-channel copy and an Open Settings action.
- [ ] Loading, empty, save-in-progress, and save-error states follow existing Settings UI patterns.
- [ ] Dark mode uses existing color-scheme handling.
- [ ] `npm run check` passes.

## Dependencies
- `12-01-reminder-storage.md`
- `12-02-notification-permissions-and-channel.md`
- `12-03-reminder-scheduling-service.md`

# Reminder Platform Recovery

## Goal
Keep scheduled reminders aligned after restore and key platform lifecycle events.

## Description
Add the platform-specific recovery work that depends on the core reminder scheduler. Android should re-schedule enabled reminders after device reboot. Restoring a database backup should re-apply the saved reminder schedule. Timezone changes are accepted as a v1 limitation, with local-time messaging in Settings instead of automatic timezone correction.

## Acceptance Criteria
- [ ] Android registers the native pieces needed to receive reboot completion for reminder recovery.
- [ ] Android reboot recovery calls the shared reminder reschedule entry point for enabled reminder config.
- [ ] iOS does not add unnecessary reboot recovery because scheduled notifications persist across reboot.
- [ ] Database restore triggers the shared reminder reschedule entry point after the restored database is available.
- [ ] Restore recovery handles missing notification permission by leaving config intact and not crashing.
- [ ] Settings copy states that reminders use the device local time and may need manual adjustment after travel.
- [ ] Automatic timezone-change rescheduling is explicitly deferred from v1.
- [ ] Android Doze/App Standby behavior is documented in implementation notes or code-adjacent task notes if the chosen notification library cannot guarantee exact delivery.
- [ ] Uninstall/reinstall behavior relies on restored config followed by restore-triggered rescheduling.
- [ ] `npm run check` passes.

## Dependencies
- `12-03-reminder-scheduling-service.md`
- `12-04-settings-reminders-ui.md`

# TDD: Reminders

## Feature Summary
Configurable local notifications reminding users to log meals at fixed times. Configured in Settings. Uses React Native local notifications. No backend scheduling — entirely on-device. Tapping a notification opens the app to the Home screen.

---

## Data Flow

```
User navigates to Settings → Reminders section
  │
  ▼
Query current reminder schedule:
  SELECT reminder_time, enabled, days_of_week, reminder_type
  FROM reminders
  WHERE user_id = ?
  (Table holds one row per reminder slot)

OR: store as JSON array on User entity or a single reminders config row.

  │
  ▼
Render reminder configuration UI:

  ┌─ Reminders ─────────────────────────────────┐
  │  [✓] Enable meal reminders                   │
  │                                              │
  │  Breakfast  [08:00]  [✓Mon][Tue][✓Wed]...   │
  │  Lunch      [13:00]  [✓Mon][✓Tue][✓Wed]...  │
  │  Dinner     [19:00]  [✓Mon][✓Tue][✓Wed]...  │
  │  Snack      [16:00]  (optional, togglable)   │
  │                                              │
  │  [+ Add reminder]                            │
  └──────────────────────────────────────────────┘

  │
  ▼
User configures:
  - Toggle enable/disable per reminder
  - Set time per reminder
  - Select days of week per reminder (or "Every day" toggle)
  │
  ▼
User taps "Save"
  │
  ▼
Step 1: Save reminder config to SQLite
  INSERT/UPDATE reminders rows

Step 2: Cancel all existing scheduled notifications
  notifee.cancelAllNotifications() or
  PushNotification.cancelAllLocalNotifications()

Step 3: Schedule new notifications based on config
  For each enabled reminder:
    For each enabled day of week:
      Schedule local notification:
        - Trigger: weekly, on [day] at [time]
        - Title: "Time to log your meal"
        - Body: "Log your [breakfast/lunch/dinner/snack]"
        - Data: { type: 'reminder', screen: 'Home' }
        - Android channel: 'meal-reminders' (with custom sound/importance)

═══ Notification Received ═══

OS fires local notification at scheduled time
  │
  ▼
Notification appears in system tray
  │
  ▼
User taps notification
  │
  ▼
App opens (or brought to foreground)
  │
  ▼
Deep link handler receives notification data:
  { type: 'reminder', screen: 'Home' }
  │
  ▼
Navigate to Home tab (already there if app was backgrounded)
  │
  ▼
Input bar focused and ready for text entry
```

---

## APIs Involved

| API | Role | Protocol |
|---|---|---|
| React Native local notifications (notifee or @react-native-community/push-notification-ios) | Schedule, display, and handle local notifications | Native bridge → OS notification system |
| Android Notification Channels (notifee) | Create notification channel with custom importance, sound, vibration | Native Android API |
| iOS Notification permissions (UNUserNotificationCenter) | Request notification permission, configure alert style | Native iOS API |
| AppState / Linking (react-native) | Handle notification tap → deep link to Home screen | Native bridge |
| Date/time APIs (JavaScript Date / Intl) | Compute next trigger times for weekly repeating notifications | JS runtime |

---

## State Management

| State | Storage | Lifespan |
|---|---|---|
| Reminder configuration (time, days, enabled per slot) | SQLite reminders table (or JSON field on User/settings) | Persistent |
| Overall reminders enabled toggle | SQLite (stored with config) | Persistent |
| Notification permission status | OS-level, queried via notifee.getNotificationSettings() | Persistent (OS setting) |
| Scheduled notification IDs (for cancellation) | Optional: SQLite. Used to cancel and re-schedule when config changes. | Synced with OS scheduler |
| Config form state (before save) | Component state | Settings screen session |

---

## Background Jobs

| Job | Trigger | Behavior |
|---|---|---|
| **Notification scheduling** | User saves reminder config in Settings | Cancel all existing, compute next fire dates, schedule via OS notification API. |
| **Notification firing** | OS alarm/clock at scheduled time | OS fires notification without app running. No app code runs until user taps. |
| **Notification tap handler** | User taps notification | App receives event → navigates to Home screen. |
| **Re-schedule on device reboot** | Device restarts. Android: BOOT_COMPLETED broadcast. iOS: notifications persist across reboot. | Android: register a broadcast receiver that re-schedules all enabled reminders on boot. iOS: no action needed (scheduled notifications survive reboot). |
| **Re-schedule on timezone change** | User travels across time zones | If reminders are at 08:00 local time, timezone change from EST to PST makes them fire 3 hours early (or late). Either: automatic re-scheduling on timezone change notification, or accept drift (user can manually adjust). v1: accept drift, user adjusts in Settings. |

---

## Battery / Performance Impact

- **Battery**: 
  - OS-level notification scheduling: negligible. Uses system alarm/clock infrastructure. No app code running between scheduling and firing.
  - Re-scheduling on config change: iterating ~7-28 scheduled notifications (4 meals × 7 days). OS call overhead is <100ms total. Negligible.
- **Performance**:
  - Notification tap → app open: standard app launch time. ~200-500ms on modern devices.
  - No performance concern. Notifications are an OS feature, not an app feature.

---

## Failure Scenarios

| Failure | Cause | User Impact | Handling |
|---|---|---|---|
| **Notification permission denied** | User denied on first prompt, or disabled in system Settings | Notifications never fire. User thinks app is broken. | On reminder config screen: check permission status. If denied: show "Notifications are disabled. Enable them in your device Settings to receive meal reminders." with "Open Settings" button. Show this before user configures reminders (don't let them configure if notifications can't fire). |
| **Android: notification channel disabled** | User long-pressed notification and disabled the channel | Notifications for that channel never show | On config screen: check if channel is blocked via notifee.getChannel(). If blocked: show "Meal reminders are blocked. Tap to re-enable in system settings." |
| **iOS: scheduled notifications limit** | iOS limits scheduled notifications to 64 per app. 4 meals × 7 days = 28 scheduled. Within limit. If user adds many custom reminders, could approach limit. | Newest schedules silently fail. | Check count of scheduled notifications after scheduling. If approaching limit (>50): warn user. For weekly repeating notifications: iOS UNCalendarNotificationTrigger doesn't count toward the 64 limit (only non-repeating triggers do). Use repeating weekly triggers instead of individual future notifications. |
| **Time zone change** | User flies from New York to London | 08:00 EST reminder fires at 13:00 GMT (UK time). User gets lunch reminder at breakfast time. | Detect timezone change via `timeZoneChange` event or app foreground check. Optionally: auto-reschedule all reminders to adjusted local times. v1: document in settings that reminders are in device local time and adjust manually after travel. |
| **iOS: notification sound despite silent mode** | User in meeting, notification makes sound | Embarrassment | Respect iOS silent switch. Use default notification sound (which is silenced when device is in silent mode). Do not set critical alerts. |
| **Overlapping notifications** | User sets Breakfast = 08:00 and Snack = 08:00 | Two notifications fire simultaneously | Allow duplicate times. OS handles multiple notifications gracefully (they stack). |
| **User disables all reminders** | Toggle "Enable reminders" off | All scheduled notifications cancelled. If user re-enables later, they need to re-save config. | On toggle off: cancel all scheduled. On toggle on: do NOT auto-reschedule until user explicitly saves. Show "Reminders disabled. Save to apply." |
| **Android Doze mode / App Standby** | App not used for days, OS puts it in standby | Notifications may be delayed or batched (Android). Scheduled alarms may not fire at exact time. | Use `setExactAndAllowWhileIdle()` or `setAlarmClock()` for precise scheduling even in Doze. Notifee handles this internally. Use high-priority notification channel to ensure delivery. |
| **App uninstalled** | User removes app | All scheduled notifications lost. On reinstall: reminders config in backup → re-schedule after restore. | On restore: after database is restored, trigger notification re-scheduling (same logic as settings save). |
| **Notification tap while app is in different screen** | User is on Weight tab, taps meal reminder notification | Should navigate to Home tab and focus input bar | Deep link handler: `navigation.navigate('Home')` and optionally pass param `{ focusInput: true }`. Home screen reads param and auto-focuses TextInput. |

---

## Constraints
- Reminders are local notifications only. No server-side push notifications.
- Default reminder slots: Breakfast (08:00), Lunch (13:00), Dinner (19:00). Snack optional.
- Each reminder has: time, enabled days of week, on/off toggle.
- Notifications fire using OS scheduler. No app background service needed.
- Tapping notification opens Home screen with input bar focused.
- Must handle notification permission denial gracefully.
- Android: create notification channel "meal-reminders" with default importance (shows in notification tray, makes sound, no heads-up popup).

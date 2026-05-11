# TDD: Home Screen & Daily Summary

## Feature Summary
The primary screen after login/onboarding. Shows a 7-day date strip with colored dots indicating logged days, a month dropdown for navigating to any date, and a daily summary with calories and macro progress bars. Below the summary: today's entries list (FoodEntries, ExerciseEntries, water quick-add). Input bar at the bottom for text/voice logging. Water quick-add buttons (+200ml, +500ml).

---

## Data Flow

```
App navigates to Home screen (after auth + onboarding)
  │
  ▼
Screen mounts:
  │
  ▼
Derive selectedDate:
  - Default: today (new Date())
  - If navigated from month dropdown: the selected date
  - If navigated from 7-day strip: the tapped date
  │
  ▼
Query SQLite for selectedDate:
  │
  ├── SELECT * FROM food_entries WHERE user_id = ? AND date = ? AND status != 'failed'
  │     └── For each FoodEntry: SELECT * FROM food_items WHERE food_entry_id = ?
  │
  ├── SELECT * FROM exercise_entries WHERE user_id = ? AND date = ?
  │
  ├── SELECT * FROM water_entries WHERE user_id = ? AND date = ?
  │     └── SUM(amount_ml) AS daily_water_total
  │
  └── SELECT daily_target_calories, protein_g, carbs_g, fat_g FROM user WHERE id = ?
  │
  ▼
Compute daily summary:
  │
  ├── Total calories consumed = SUM(FoodItem.calories across all FoodEntries)
  ├── Total protein = SUM(FoodItem.protein_g)
  ├── Total carbs = SUM(FoodItem.carbs_g)
  ├── Total fat = SUM(FoodItem.fat_g)
  ├── Exercise calories burned = SUM(ExerciseEntry.calories_burned)
  │
  ├── Calorie progress = consumed / daily_target × 100
  ├── Protein progress = consumed / macro_target_protein × 100
  ├── Carbs progress = consumed / macro_target_carbs × 100
  ├── Fat progress = consumed / macro_target_fat × 100
  │
  └── Water progress = daily_water_total / water_goal × 100
  │
  ▼
Render:
  ┌─ Header ──────────────────────────────────┐
  │  [<] [Month Dropdown ▼] [>]    [⚙️ gear] │
  │                                            │
  │  7-day strip:                              │
  │  ┌───┬───┬───┬───┬───┬───┬───┐           │
  │  │ M │ T │ W │ T │ F │ S │ S │           │
  │  │ ● │   │ ● │   │ ● │ ● │ ◉ │  (today) │
  │  │   │   │   │   │   │   │   │           │
  │  │ 8 │ 9 │10 │11 │12 │13 │14 │           │
  │  └───┴───┴───┴───┴───┴───┴───┘           │
  │   ● = logged, ◉ = today selected           │
  └────────────────────────────────────────────┘

  ┌─ Daily Summary ───────────────────────────┐
  │  Calories:  1,450 / 2,000  (72%)          │
  │  ████████████░░░░░░░░                     │
  │                                            │
  │  Protein:   120g / 150g  (80%)            │
  │  ████████████████░░░░                     │
  │                                            │
  │  Carbs:     140g / 200g  (70%)            │
  │  ██████████████░░░░░░                     │
  │                                            │
  │  Fat:       45g / 55g  (82%)              │
  │  ████████████████░░░░                     │
  │                                            │
  │  Exercise:  250 kcal burned               │
  │  (shown separately, not subtracted)        │
  └────────────────────────────────────────────┘

  ┌─ Water Quick-Add ─────────────────────────┐
  │  💧 800ml / 2000ml  (40%)                 │
  │  [+200ml]  [+500ml]  [+Custom]            │
  └────────────────────────────────────────────┘

  ┌─ Today's Entries ─────────────────────────┐
  │  FoodEntry 1: "2 scrambled eggs..."       │
  │    • scrambled eggs  140 kcal  P12 C0 F10 │
  │    • toast           70 kcal   P3 C14 F1  │
  │    • pending badge (if status=pending)     │
  │                                            │
  │  FoodEntry 2: "chicken salad..."          │
  │    • chicken breast  200 kcal ...          │
  │                                            │
  │  ExerciseEntry: 30 min walk, 120 kcal     │
  └────────────────────────────────────────────┘

  ┌─ Input Bar ───────────────────────────────┐
  │  [🔖 bookmark] [Type what you ate...] [🎤] │
  └────────────────────────────────────────────┘
```

---

## APIs Involved

None. All data is local SQLite. No network calls from this screen.

---

## State Management

| State | Storage | Lifespan |
|---|---|---|
| selectedDate (currently viewed date) | Component state (useState or navigation param) | Screen session, resets to today on tab re-focus |
| FoodEntries for selectedDate | Component state (from SQLite query, refreshed on mount and when entries change) | Screen session |
| FoodItems (nested query per FoodEntry) | Component state | Screen session |
| ExerciseEntries for selectedDate | Component state | Screen session |
| WaterEntries for selectedDate + daily total | Component state | Screen session |
| User Daily Target + Macro Targets | Component state (queried once, cached per session) | Screen session, re-queried on Settings change |
| 7-day strip log status (which days have entries) | Component state (query: SELECT DISTINCT date FROM food_entries WHERE date BETWEEN ? AND ? AND status = 'complete') | Screen session, recomputed on date navigation |
| Month dropdown visible state | Component state | Ephemeral |
| Water quick-add loading state | Component state (brief, for INSERT) | Ephemeral |
| Input bar text | Component state (TextInput) | Screen session |

Data refresh strategy:
- On mount: query all data for selectedDate.
- After successful LLM parse: re-query only the changed entities (FoodEntries, FoodItems) and re-compute daily summary inline. Avoid full screen re-render.
- On date change (7-day strip tap, month picker): full re-query for new date.
- When returning from Settings (Daily Target changed): re-query User targets, recompute progress.

---

## Background Jobs

None specific to this screen.

(7-day strip color dots are computed from on-screen SQLite query, not a background job. Connectivity listener for pending badges is app-wide, covered in 05-offline-queue.md.)

---

## Battery / Performance Impact

- **Battery**: None. No network. Only SQLite reads and UI rendering.
- **Performance**:
  - SQLite queries on mount: 4-5 queries (FoodEntries, FoodItems per entry, ExerciseEntries, WaterEntries, User). With proper indexing (user_id + date): <10ms.
  - FoodItems are queried per FoodEntry (N+1 pattern). For 3-6 entries/day typical, this is ~6 sub-queries. At scale (few years of data, 5 entries/day = ~5500 total): indexed query by food_entry_id is still <1ms each. No pagination needed at this scale for a single date.
  - 7-day strip: SELECT DISTINCT date ... BETWEEN range. With index on (user_id, date): <2ms.
  - Month dropdown: similar query for ~30-day window. <5ms.
  - UI re-render on entry change: should use React.memo or equivalent to prevent re-rendering unchanged entry rows. Use `key` by entry ID for list stability.
  - Progress bars: simple percentage calculations, trivial.
- **Memory**: Holding all entries for a day + their FoodItems in memory is trivial (<1KB per entry).

---

## Failure Scenarios

| Failure | Cause | User Impact | Handling |
|---|---|---|---|
| **No data for selected date** | User hasn't logged anything on this date | Empty screen — may look broken | Show explicit empty state: "No entries for May 10. Tap the input bar to log your first meal." The 7-day strip shows empty dots for this date. |
| **Daily Target not set** | User somehow bypassed onboarding (edge case) or User row missing | Progress bars show 0% or NaN. Daily summary meaningless. | Check if daily_target_calories exists on User row. If null: show "Set up your daily target" button linking to onboarding or Settings. This should not happen in normal flow (auth → onboarding enforced). |
| **Pending entries present** | Offline log from earlier | Pending entries shown with gray badge, no macro data. Daily summary excludes them (macros unknown). | Show pending entries in entry list with a distinct visual style (dimmed, "Pending" badge). Tap on pending entry: show raw text + "Processing..." message or option to retry manually. |
| **Failed entries present** | LLM returned error after N retries | Failed entries shown with red badge. Daily summary excludes them. | Show failed entries with error badge. Tap to see raw text + "Processing failed. Tap to retry or edit." User can tap retry (resubmits raw_text to LLM) or edit (opens edit screen). |
| **Database read error** | SQLite corruption, disk full, migration failure | Screen fails to render, white screen or crash | Wrap queries in try/catch. On error: show full-screen error state with "Something went wrong. Your data is safe." + "Retry" button. Log full error details. If persistent: offer "Restore from backup" as recovery path. |
| **Date boundary: midnight crossing** | User has app open at 23:59, entry created at 00:01 | selectedDate defaults to "today" — which changed while user was active. New entries go to next day. | selectedDate should use the date at screen mount / last user selection, not live-update at midnight. If user wants today's date, they can tap the 7-day strip's current day. |
| **Time zone change** | User travels across time zones | Date stored in local time. Entry logged at 23:00 in NYC shows as next day 04:00 in London. | All dates stored as local date strings ('YYYY-MM-DD') based on device timezone at time of creation. This means travel creates edge cases (same entry seen on different "dates"). Acceptable for v1 — calorie tracking is daily habit, not time-precise. |
| **Very long entry list** | User logged 15+ FoodEntries in one day | Screen scrolls extensively | FlatList with virtualization. Entry list should be scrollable with the rest of the screen content. Only entries for selected date shown (typically 3-6). |
| **Water goal not configured** | No explicit water goal in onboarding or Settings (not specified in architecture) | Water progress bar shows denominator = 0, progress = NaN | Default water goal: 2000ml (common recommendation). Allow override in Settings. If water_goal_ml = null, default to 2000ml. |
| **Large macro deviation (>100%)** | User consumed 2x their protein target | Progress bar overflows or becomes ridiculous | Cap progress bar at 100% visually. Show actual amount: "240g / 150g (160%)" to convey overage. |
| **Settings changed while Home is open** | User navigates to Settings, changes Daily Target, returns | Home still shows old target → progress bars stale | On Home screen focus/blur: re-query User targets. Alternatively: use an event emitter or callback to notify Home of settings changes. |

---

## Constraints
- Home is bottom tab 1. No other tab is primary.
- 7-day strip is horizontally scrollable or always shows current Mon-Sun window.
- Tapping a date in the strip loads that date's entries. Tapping today returns to today.
- Exercise calories are shown separately in summary, never subtracted from the Daily Target progress.
- Month dropdown shows month-at-a-glance with colored dots on days that have entries. Tapping a day navigates to that date.
- Failed FoodEntries (status=failed) are excluded from daily macro totals.
- Pending FoodEntries (status=pending) are excluded from daily macro totals.

---

## Derived Queries Reference

```sql
-- 7-day strip: which days in the current window have entries
SELECT DISTINCT date
FROM food_entries
WHERE user_id = ?
  AND date BETWEEN ? AND ?
  AND status = 'complete';

-- Daily totals
SELECT
  SUM(fi.calories) AS total_calories,
  SUM(fi.protein_g) AS total_protein,
  SUM(fi.carbs_g) AS total_carbs,
  SUM(fi.fat_g) AS total_fat
FROM food_entries fe
JOIN food_items fi ON fi.food_entry_id = fe.id
WHERE fe.user_id = ?
  AND fe.date = ?
  AND fe.status = 'complete';

-- Exercise calories for the day (display only)
SELECT SUM(calories_burned) AS total_exercise_calories
FROM exercise_entries
WHERE user_id = ? AND date = ?;
```

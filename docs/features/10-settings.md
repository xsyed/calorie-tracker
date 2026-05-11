# TDD: Settings

## Feature Summary
Accessible via gear icon in Home header. Allows user to view and adjust: Daily Target calories, Macro Targets (protein, carbs, fat in grams), profile information (gender, height, current weight, goal), reminder configuration (covered in 12-reminders.md), and backup trigger (covered in 11-backup-restore.md). Changes to Daily Target cascade to Macro Targets via the same goal-driven ratio formulas.

---

## Data Flow

```
User taps gear icon in Home header
  │
  ▼
Navigate to Settings screen
  │
  ▼
Query User entity:
  SELECT gender, height, weight, goal, target_weight, timeframe,
         daily_target_calories, protein_g, carbs_g, fat_g
  FROM user WHERE id = ?
  │
  ▼
Render settings sections:

═══ Section 1: Profile ═══

  ┌─ Profile ──────────────────────────────────┐
  │  Gender:     [Male ▼]                       │
  │  Height:     [178] cm                       │
  │  Weight:     [78.5] kg                      │
  │  Age:        [32]                           │
  │  Goal:       [Lose weight ▼]                │
  │  Target Wt:  [74] kg                        │
  │  Timeframe:  [60] days                      │
  └──────────────────────────────────────────────┘

Note: Changing profile fields does NOT auto-recalculate Daily Target.
User must explicitly tap "Recalculate" to trigger the full BMR → Daily Target → Macro Target chain.

═══ Section 2: Daily Target ═══

  ┌─ Daily Target ─────────────────────────────┐
  │  Calories:  [2000] kcal/day                 │
  │  Activity:  [Sedentary (1.2) ▼]            │
  │              (light 1.375 / moderate 1.55    │
  │               / active 1.725 / athlete 1.9)  │
  └──────────────────────────────────────────────┘

═══ Section 3: Macro Targets ═══

  ┌─ Macro Targets ────────────────────────────┐
  │  Protein:  [150] g  (from 2000kcal × 30%)  │
  │  Carbs:    [200] g  (from 2000kcal × 40%)  │
  │  Fat:      [55] g   (from 2000kcal × 30%)  │
  │  [Recalculate from Daily Target]            │
  │  [Use Custom Ratios]                        │
  └──────────────────────────────────────────────┘

Recalculate flow:
  │
  ▼
  Read current profile values from form
  │
  ▼
  Run calculation chain (same as onboarding):
    BMR → TDEE (× activity_multiplier) → adjust for goal → Daily Target
    → Macro Targets (using goal-driven ratios)
  │
  ▼
  Update Settings UI with new values
  │
  ▼
  User taps "Save"
  │
  ▼
  UPDATE user SET ... WHERE id = ?
  │
  ▼
  Home screen detects settings change → re-queries targets → updates progress bars

═══ Section 4: Reminders ═══
(see 12-reminders.md)

═══ Section 5: Backup ═══
(see 11-backup-restore.md)

═══ Section 6: Account ═══

  ┌─ Account ───────────────────────────────────┐
  │  Signed in as: user@gmail.com                │
  │  [Sign Out]                                  │
  │  [Delete Account] (future)                   │
  └──────────────────────────────────────────────┘
```

---

## APIs Involved

None. All local SQLite reads and writes.

---

## State Management

| State | Storage | Lifespan |
|---|---|---|
| Current settings values (loaded from DB) | Component state (populated on mount) | Settings screen session |
| Edited values (before save) | Component state (form state, may differ from DB values) | Settings screen session |
| Dirty state (unsaved changes indicator) | Derived from comparison of current vs edited values | Settings screen session |
| Validation errors (per field) | Component state | Ephemeral, per field on blur or save attempt |
| Recalculation results (preview before save) | Component state | Within settings session |
| Activity multiplier selection | Component state | Settings screen session |
| Custom macro ratio sliders (if enabled) | Component state | Settings screen session |

---

## Background Jobs

None during settings editing.

(Recalculation is a synchronous arithmetic function, not a background job.)

---

## Battery / Performance Impact

- **Battery**: None. All local.
- **Performance**:
  - SQLite read: single row from User table. <1ms.
  - Recalculation: same arithmetic as onboarding. O(1). <1ms.
  - UI rendering: form inputs, dropdowns. Standard performance.
  - No performance concerns.

---

## Failure Scenarios

| Failure | Cause | User Impact | Handling |
|---|---|---|---|
| **Invalid Daily Target** | User enters 0, negative, or extreme value (e.g. 50000 kcal) | Nonsensical progress bars on Home screen. Macro targets also invalid if recalculated. | Validate: 1200 <= daily_target <= 5000. Show inline error on save. Cap at these bounds. |
| **Invalid macro grams** | User enters 0g protein | Progress bar shows 0% protein. Nutritionally meaningless. | Validate: each macro > 0 and <= 500g. Show inline error. |
| **Custom macro ratios don't sum to 100%** | If user can set custom ratios (future feature), they enter 50/50/50 = 150% | Derived grams over-allocate calories. Macro targets don't match Daily Target. | Validate: sum of ratios must = 100%. Show "Ratios must add up to 100%. Current: 150%." |
| **Recalculate overwrites manual macro adjustments** | User manually set protein to 180g, then taps "Recalculate" on Daily Target | Manual macro values lost, replaced by formula-derived values | Show confirmation: "Recalculating will reset your macro targets based on the formulas. Continue?" with Cancel/Continue. |
| **Save fails (database error)** | Disk full, corruption | Changes lost, user thinks they saved | Wrap UPDATE in try/catch. On error: show "Failed to save settings. Try again." Keep edited values in form so user can retry. |
| **Discard changes without saving** | User edits several values, taps back without save | Changes lost | On back navigation when form is dirty: show "You have unsaved changes. Discard?" with Discard/Cancel options. Default should be "Cancel" (safe default). |
| **Activity multiplier change doesn't recalculate** | User changes from Sedentary to Moderate but doesn't tap Recalculate | Daily Target stays at old value, user thinks activity change was applied | When activity multiplier changes: either auto-recalculate daily target (preferred), or show a prompt "Activity level changed. Recalculate daily target?" |
| **Changing profile fields without recalculation** | User updates weight from 78 to 75 but doesn't tap Recalculate | Daily Target stays based on 78kg. Settings show inconsistent state. | Separate "profile" from "targets" clearly. Profile fields show current values but indicate they won't affect targets until Recalculate. Show "Recalculate" button prominently below profile section. |
| **Dismiss settings without save** but some values were auto-recalculated | User opened settings, changed activity multiplier which auto-recalculated Daily Target, then backed out | Daily Target in DB unchanged but user saw new value. Confusing. | Don't auto-recalculate on field change. Only recalculate on explicit "Recalculate" button tap. This avoids partial-state confusion. |
| **Syncing back from Settings to Home** | User saves new Daily Target, navigates back to Home. Home still shows old target. | Progress bars wrong. | On Settings save: emit an event or use navigation params to notify Home screen. Home re-queries User targets on focus. Use `useFocusEffect` to refresh data when tab/screen gains focus. |

---

## Constraints
- Daily Target is adjustable independent of profile. Changing it does NOT auto-recalculate macro targets (unless user explicitly triggers recalculation).
- Activity multiplier is adjustable (default: 1.2 sedentary). Options: 1.2, 1.375, 1.55, 1.725, 1.9.
- Macro targets can be manually adjusted or derived from Daily Target via goal-driven ratios.
- Profile changes (gender, height, weight, age, goal) require explicit "Recalculate" action to update targets.
- All values stored in User row in SQLite. No separate settings table needed for these fields.
- Settings screen should detect and warn about unsaved changes on back navigation.

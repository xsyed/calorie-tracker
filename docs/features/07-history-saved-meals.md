# TDD: History & Saved Meals

## Feature Summary
Overlay triggered from the bookmark icon on the Home input bar. Contains two tabs/toggles: History (auto-populated list of past FoodEntries grouped chronologically) and Saved Meals (user-curated named templates created from past FoodEntries). Tapping an entry generates a new FoodEntry for the current date with the same FoodItems, enabling quick re-logging of repeat meals.

---

## Data Flow

```
User taps bookmark icon on Home input bar
  │
  ▼
Overlay slides up from bottom (or modal)
  │
  ├── Tab 1: History (default)
  │     │
  │     ▼
  │   Query: Get past FoodEntries grouped by date
  │     SELECT fe.id, fe.date, fe.raw_text, fi.name, fi.calories, fi.protein_g, fi.carbs_g, fi.fat_g
  │     FROM food_entries fe
  │     LEFT JOIN food_items fi ON fi.food_entry_id = fe.id
  │     WHERE fe.user_id = ? AND fe.status = 'complete'
  │     ORDER BY fe.date DESC, fe.created_at DESC
  │     LIMIT 100
  │     │
  │     ▼
  │   Group results by date in JS:
  │     {
  │       "2026-05-10": [ { FoodEntry: { id, raw_text }, FoodItems: [...] } ],
  │       "2026-05-09": [ ... ],
  │       ...
  │     }
  │     │
  │     ▼
  │   Render grouped list:
  │     ┌─ Today ────────────────────┐
  │     │  "2 scrambled eggs, toast" │
  │     │    • eggs 140 • toast 70   │
  │     └────────────────────────────┘
  │     ┌─ Yesterday ────────────────┐
  │     │  "chicken salad"           │
  │     │    • chicken 200 ...       │
  │     └────────────────────────────┘
  │     ┌─ May 8 ────────────────────┐
  │     │  "protein shake"           │
  │     │    • shake 300 ...         │
  │     └────────────────────────────┘
  │
  ├── Tab 2: Saved Meals
  │     │
  │     ▼
  │   Query: Get all SavedMeals with their items
  │     SELECT sm.id, sm.name, smi.name, smi.calories, smi.protein_g, smi.carbs_g, smi.fat_g
  │     FROM saved_meals sm
  │     LEFT JOIN saved_meal_items smi ON smi.saved_meal_id = sm.id
  │     WHERE sm.user_id = ?
  │     ORDER BY sm.created_at DESC
  │     │
  │     ▼
  │   Render list of named templates:
  │     ┌─ My Breakfast ─────────────┐
  │     │   • eggs 140 • toast 70    │
  │     │   • coffee 5               │
  │     │   [Delete] [Use]           │
  │     └────────────────────────────┘
  │     ┌─ Post-Workout Shake ───────┐
  │     │   • protein shake 300      │
  │     │   • banana 105             │
  │     │   [Delete] [Use]           │
  │     └────────────────────────────┘
  │     ... and a "Save current entry as meal" option
  │
  └── On tap of any entry (History or Saved Meals):
        │
        ▼
      Close overlay
        │
        ▼
      Create new FoodEntry for selected date (current date):
        INSERT FoodEntry:
          user_id, date = selectedDate, raw_text = <original raw_text or empty>,
          status = 'complete', created_at = now()
          → get new food_entry_id
        │
        ▼
      Copy FoodItems (from History) or SavedMealItems (from Saved Meal):
        INSERT FoodItem for each item:
          food_entry_id = new food_entry_id, name, calories, protein_g, carbs_g, fat_g
        │
        ▼
      Home screen updates: new entry appears in today's list, daily summary recalculated

Saving a FoodEntry as a Saved Meal (from within overlay):
  │
  ▼
  User taps "Save as meal" on a History entry (or a toggle in entry list)
    │
    ▼
  Prompt for name (text input)
    │
    ▼
  INSERT SavedMeal:
    user_id, name, created_at = now()
    → get saved_meal_id
    │
    ▼
  INSERT SavedMealItem for each FoodItem in the FoodEntry:
    saved_meal_id, name, calories, protein_g, carbs_g, fat_g
```

---

## APIs Involved

None. All data is local SQLite. No network calls.

---

## State Management

| State | Storage | Lifespan |
|---|---|---|
| Overlay visibility | Component state (Home screen) / Modal state | During overlay session |
| Active tab (History / Saved Meals) | Component state | Overlay session |
| History entries (grouped by date, paginated/limited) | Component state (from SQLite query) | Overlay session, refreshed on open |
| Saved Meals (with their items) | Component state (from SQLite query) | Overlay session, refreshed on open |
| Save-as-meal name input | Component state | During save-name prompt |
| Loading state (query running) | Component state | Brief, during initial query |

---

## Background Jobs

None.

---

## Battery / Performance Impact

- **Battery**: None. Pure local queries.
- **Performance**:
  - History query: LIMIT 100 entries, each with 1-5 FoodItems. Worst case: 100 entries × 5 items = 500 rows returned. Group-by in JS: one pass, O(n). <10ms for grouping. Render: FlatList with virtualization for performance with large datasets.
  - Saved Meals query: typically 3-10 saved meals, each with 2-5 items. Tiny dataset. <2ms.
  - Overlay animation: sliding panel should use native driver for 60fps.
  - Query should be limited/offset. 100 entries is ~2 months of data at 1-2 entries/day. Sufficient for most use cases in v1.
- **Memory**: 500 rows of food data is <100KB. Negligible.

---

## Failure Scenarios

| Failure | Cause | User Impact | Handling |
|---|---|---|---|
| **Empty History** | New user with no past FoodEntries | History tab shows "Nothing here yet. Log some meals first!" | Empty state with CTA pointing to input bar. |
| **Empty Saved Meals** | User hasn't saved any meals | Saved Meals tab shows "No saved meals. Tap 'Save as meal' on any entry in History." | Empty state with instructions. |
| **Very large history** | 1 year+ of data, 5 entries/day = 1800+ entries | Query might be slow if not limited. Render performance degrades. | LIMIT 100 (most recent). Add "Load more" at bottom for older entries. Consider: search/filter by food name for very large histories. v1: LIMIT 100 without load-more (acceptable for first release). |
| **History entry deleted after being saved** | User deletes a FoodEntry that was previously saved as a SavedMeal | SavedMeal remains intact (independent copy of items). No impact. | SavedMealItems are copies, not references. This is by design (design decision #6: edit-in-place, no lineage). |
| **SavedMeal name conflict** | User tries to save meal with name that already exists | Duplicate names are confusing | Allow duplicate names (no uniqueness constraint). Users can manage duplicates by deleting. Alternatively: show "A saved meal with this name already exists. Overwrite?" v1: allow duplicates, simple. |
| **Delete SavedMeal** | User taps Delete on a SavedMeal | Saved Meal removed | DELETE FROM saved_meal_items WHERE saved_meal_id = ?; DELETE FROM saved_meals WHERE id = ?. No undo in v1. |
| **Overlay data becomes stale** | User has Home screen open, adds a new entry, then opens History overlay | New entry not visible in History until overlay is re-opened | Overlay queries data fresh on each open. This is acceptable — overlay closes after selection anyway. |
| **Long raw_text in History card** | User logged a 500-character description | History card overflows or truncates | Truncate raw_text to 80 chars with "..." in the overlay card. Full text visible on long-press or in entry detail. |

---

## Constraints
- History is auto-populated. Not user-curated.
- Saved Meals are user-curated, named templates.
- Both accessible from the same overlay (bookmark icon on input bar), not separate screens.
- SavedMealItems are independent copies — changing a FoodEntry does not affect its derived SavedMeal.
- Applying a Saved Meal or History entry creates a new FoodEntry with new FoodItems. The original entry is not modified.
- Overlay must slide up/down with native driver animation for 60fps.
- History entries shown in reverse chronological order (most recent first).
- Entry list includes both raw_text preview and summarized FoodItems (name + calories).

---

## Saved Meal as a Standalone Operation (from Entry List)

In addition to the overlay, users can save any FoodEntry as a Saved Meal directly from the entry list on the Home screen:

```
User sees FoodEntry in today's list
  │
  ▼
Long-press or tap entry menu (⋮) → "Save as Meal"
  │
  ▼
Prompt for name → INSERT SavedMeal + SavedMealItems
```

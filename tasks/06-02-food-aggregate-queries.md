# Task 6.2: Add daily aggregate queries to foodRepository

**Feature spec:** `docs/features/06-home-daily-summary.md` (lines 186-207)
**Depends on code:** `database/foodRepository.ts`, `database/index.ts`
**Required by:** Task 6.5 (DailySummary), Task 6.3 (DateStrip), Task 6.4 (MonthDropdown), Task 6.8 (HomeScreen)

---

## Context (verified against codebase)

| Item | Current state |
|------|---------------|
| `foodRepository.ts` | 302 lines. 10 exported functions. Has `getFoodEntriesByDate` (returns all entries, all statuses) and `getFoodItemsByEntryId` (items for one entry). No aggregate/macro-sum query. No distinct-dates query. |
| `getDailyExerciseCalories` | Already exists in `exerciseRepository.ts` — uses `COALESCE(SUM(...), 0) AS total` pattern. Use this as reference. |
| FoodEntry status | `'pending' | 'complete' | 'failed'`. Only `'complete'` entries have `food_items` with valid macro data. |
| JOIN | `food_entries` + `food_items` join needed for macros. `food_items.food_entry_id` references `food_entries.id`. |
| `index.ts` | Exports from foodRepository: `insertFoodEntry, insertFoodItem, getFoodEntriesByDate, getFoodItemsByEntryId, getPendingEntries, updateFoodEntryStatus, incrementRetryCount, saveParsedLogEntry, completePendingEntry`. Need to add 2 new exports. |

---

## Files to modify

- `apps/mobile/src/database/foodRepository.ts` — add 2 functions
- `apps/mobile/src/database/index.ts` — export new functions

---

## Step 1: `getDailyCalorieTotals`

Returns aggregate macros for completed food entries on a date.

### Type

```ts
interface DailyTotals {
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
}
```

Define this interface in `foodRepository.ts` (above the function, similar pattern to inline types in `saveParsedLogEntry` params).

### Function

```ts
export async function getDailyCalorieTotals(
  userId: string,
  date: string,
): Promise<DailyTotals>
```

### SQL (from feature spec lines 198-207)

```sql
SELECT
  COALESCE(SUM(fi.calories), 0) AS total_calories,
  COALESCE(SUM(fi.protein_g), 0) AS total_protein,
  COALESCE(SUM(fi.carbs_g), 0) AS total_carbs,
  COALESCE(SUM(fi.fat_g), 0) AS total_fat
FROM food_entries fe
JOIN food_items fi ON fi.food_entry_id = fe.id
WHERE fe.user_id = ? AND fe.date = ? AND fe.status = 'complete'
```

### Return

When no rows exist, the query returns a single row with all `0` values (due to COALESCE). Extract from `result.rows[0]` and cast to `DailyTotals`.

Reference pattern: `exerciseRepository.ts` `getDailyExerciseCalories` (lines 39-53) — same COALESCE/SUM pattern but without JOIN.

---

## Step 2: `getLoggedDatesInRange`

Returns distinct dates with complete entries, for the 7-day strip dots and month dropdown dot indicators.

### Function

```ts
export async function getLoggedDatesInRange(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<string[]>
```

### SQL (from feature spec lines 191-195)

```sql
SELECT DISTINCT date
FROM food_entries
WHERE user_id = ? AND date BETWEEN ? AND ? AND status = 'complete'
ORDER BY date ASC
```

### Return

Map rows to `string[]` — each row has a single `date` field. Cast `(row as Record<string, unknown>).date as string`.

---

## Step 3: Export from `index.ts`

Add `getDailyCalorieTotals, getLoggedDatesInRange` to the foodRepository export line.

---

## Edge cases to verify

| Case | Expected behavior |
|------|-------------------|
| Date with no entries | `getDailyCalorieTotals` returns `{ total_calories: 0, total_protein: 0, total_carbs: 0, total_fat: 0 }` |
| Date with only pending entries | Same — 0s (pending entries have no food_items) |
| Date with only failed entries | Same — 0s (failed entries have no food_items) |
| Date with mix of complete + pending | Only complete entries counted |
| Empty date range (no logged dates) | `getLoggedDatesInRange` returns `[]` |
| Range spanning months | `BETWEEN` works correctly — date strings like `'2026-05-01'` and `'2026-06-30'` compare lexicographically in SQLite (same as chronologically for YYYY-MM-DD) |

---

## Acceptance criteria

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `getDailyCalorieTotals` returns 0s for a date with no entries
- [ ] `getDailyCalorieTotals` includes only completed entries (not pending/failed)
- [ ] `getDailyCalorieTotals` correctly sums macros from all food_items across all food_entries
- [ ] `getLoggedDatesInRange` returns distinct dates sorted ascending
- [ ] `getLoggedDatesInRange` returns `[]` for a range with no complete entries
- [ ] Both functions exported from `index.ts`

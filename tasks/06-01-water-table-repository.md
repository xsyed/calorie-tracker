# Task 6.1: Create `water_entries` table + water repository

**Feature spec:** `docs/features/06-home-daily-summary.md`
**Depends on code:** `database/database.ts`, `database/types.ts`, `database/index.ts`
**Blocks:** Task 6.6 (WaterQuickAdd), Task 6.8 (HomeScreen integration)

---

## Context (verified against codebase)

| Item | Current state |
|------|---------------|
| `database.ts` | 5 tables: `User`, `food_entries`, `food_items`, `exercise_entries`, `app_settings`. No `water_entries`. All tables created via `db.executeSync()` in `initDatabase()`. All PKs are `TEXT`. Numeric fields use `REAL`. No foreign keys. |
| `types.ts` | 6 types: `User`, `OnboardingFormData`, `FoodEntry`, `FoodItem`, `ExerciseEntry`, `AppSetting`. No `WaterEntry`. |
| `waterRepository.ts` | Does **not** exist. |
| `index.ts` | Exports all DB functions + types. No water exports. |
| ID generation pattern | `foodRepository.ts` and `userRepository.ts` use a `function generateId() { Math.random().toString(36).substring(2, 15) + Date.now().toString(36) }`. `exerciseRepository.ts` inlines the same expression. Follow the pattern — define a `generateId()` helper. |
| mapRow pattern | All repos use a `function mapRowToX(row: Record<string, unknown>): X` that casts each field with `as`. `userRepository.ts` handles nullable fields with `== null ? null : (as number)`. Water fields are all required (non-null), no null handling needed. |

---

## Files to create

- `apps/mobile/src/database/waterRepository.ts`

## Files to modify

- `apps/mobile/src/database/types.ts` — add `WaterEntry` interface
- `apps/mobile/src/database/database.ts` — add `water_entries` table to `initDatabase()`
- `apps/mobile/src/database/index.ts` — export new functions + type

---

## Step 1: Add `WaterEntry` type

In `types.ts`, add after `AppSetting`:

```ts
export interface WaterEntry {
  id: string;
  user_id: string;
  date: string;
  amount_ml: number;
  timestamp: string;
}
```

All fields required. `amount_ml` is `REAL` in SQL → `number` in TS.

---

## Step 2: Add `water_entries` table to `initDatabase()`

In `database.ts`, inside `initDatabase()`, add a 6th `db.executeSync()` call after the `app_settings` block:

```sql
CREATE TABLE IF NOT EXISTS water_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  amount_ml REAL NOT NULL,
  timestamp TEXT NOT NULL
)
```

Match the existing pattern: multi-line string concatenation (`'...' + '...'`), `db.executeSync(..., [])`.

---

## Step 3: Create `waterRepository.ts`

Follow patterns from `foodRepository.ts` lines 1-8 (imports, `generateId`, `mapRow`), `exerciseRepository.ts` lines 39-53 (`getDailyExerciseCalories` for aggregate pattern).

### 3.1 `insertWaterEntry`

```ts
export async function insertWaterEntry(
  data: Omit<WaterEntry, 'id'>,
): Promise<WaterEntry>
```

- Generate ID via `generateId()`
- `INSERT INTO water_entries (id, user_id, date, amount_ml, timestamp) VALUES (?, ?, ?, ?, ?)`
- Returns `{ id, ...data }`

Pattern reference: `foodRepository.ts` `insertFoodEntry` (lines 28-43).

### 3.2 `getWaterEntriesByDate`

```ts
export async function getWaterEntriesByDate(
  userId: string,
  date: string,
): Promise<WaterEntry[]>
```

- `SELECT * FROM water_entries WHERE user_id = ? AND date = ? ORDER BY timestamp DESC`
- Maps rows via `mapRowToWaterEntry`

Pattern reference: `foodRepository.ts` `getFoodEntriesByDate` (lines 69-76).

### 3.3 `getDailyWaterTotal`

```ts
export async function getDailyWaterTotal(
  userId: string,
  date: string,
): Promise<number>
```

- `SELECT COALESCE(SUM(amount_ml), 0) AS total FROM water_entries WHERE user_id = ? AND date = ?`
- Return `(row?.total as number) ?? 0`

Pattern reference: `exerciseRepository.ts` `getDailyExerciseCalories` (lines 39-53).

---

## Step 4: Export from `index.ts`

Add to `index.ts`:

```ts
export { insertWaterEntry, getWaterEntriesByDate, getDailyWaterTotal } from './waterRepository';
```

Add `WaterEntry` to the `export type` line:

```ts
export type { User, OnboardingFormData, FoodEntry, FoodItem, ExerciseEntry, AppSetting, WaterEntry } from './types';
```

---

## Acceptance criteria

- [ ] `npm run typecheck` passes with strict TS settings
- [ ] `npm run lint` passes
- [ ] Table created on `initDatabase()` without error
- [ ] Can insert a water entry and query it back with correct values for all fields
- [ ] `getDailyWaterTotal(userId, date)` returns sum of `amount_ml` for given user+date
- [ ] `getDailyWaterTotal` returns `0` when no entries exist for user+date
- [ ] `getWaterEntriesByDate` returns entries sorted by timestamp DESC
- [ ] ID generation matches existing pattern (Math.random + Date.now base36)
- [ ] All new exports available via `import { ... } from '../database'`

# Task 02: Food & Exercise Repository Layer

## Goal

Create repository functions for inserting and querying food entries, food items, and exercise entries, following the existing repository pattern.

## Description

Create `foodRepository.ts` and `exerciseRepository.ts` in `apps/mobile/src/database/`. Follow the conventions established in `userRepository.ts`: raw SQL via `db.execute()` with `?` placeholders, `generateId()` for ID generation, `mapRowTo*` functions for row mapping. Export new repository functions from `index.ts`.

The repository must provide a transactional batch insert that atomically saves a full LLM parse result.

### `foodRepository.ts`

```ts
// ID generation (same pattern as userRepository.ts)
function generateId(): string

// Row mappers
function mapRowToFoodEntry(row: Record<string, unknown>): FoodEntry
function mapRowToFoodItem(row: Record<string, unknown>): FoodItem

// Single inserts
insertFoodEntry(data: Omit<FoodEntry, 'id'>): Promise<FoodEntry>
insertFoodItem(data: Omit<FoodItem, 'id'>): Promise<FoodItem>

// Query by user + date
getFoodEntriesByDate(userId: string, date: string): Promise<FoodEntry[]>
getFoodItemsByEntryId(foodEntryId: string): Promise<FoodItem[]>

// Update status (for offline queue / retry flows)
updateFoodEntryStatus(id: string, status: 'complete' | 'failed'): Promise<void>
incrementRetryCount(id: string): Promise<void>
```

### `exerciseRepository.ts`

```ts
// Row mapper + single insert
insertExerciseEntry(data: Omit<ExerciseEntry, 'id'>): Promise<ExerciseEntry>

// Query by user + date
getExerciseEntriesByDate(userId: string, date: string): Promise<ExerciseEntry[]>

// Daily totals for exercise calories
getDailyExerciseCalories(userId: string, date: string): Promise<number>
```

### Transactional batch insert

A single function that wraps the entire LLM parse result in a SQLite transaction:

```ts
// foodRepository.ts
saveParsedLogEntry(params: {
  userId: string;
  date: string;
  rawText: string;
  foods: Array<{
    name: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }>;
  exercises: Array<{
    exercise_type: string;
    duration_minutes: number;
    calories_burned: number;
  }>;
}): Promise<{ foodEntry: FoodEntry; foodItems: FoodItem[]; exerciseEntries: ExerciseEntry[] }>
```

This must:
1. BEGIN transaction
2. INSERT food_entries (status = 'complete', created_at = now())
3. For each food: INSERT food_items
4. For each exercise: INSERT exercise_entries
5. COMMIT (or ROLLBACK on any failure)
6. Return all created records

### `appSettingsRepository.ts`

A minimal repository for key-value settings (needed for device_id persistence):

```ts
getSetting(key: string): Promise<string | null>
setSetting(key: string, value: string): Promise<void>
```

### Files to create/modify

- **Create** `apps/mobile/src/database/foodRepository.ts`
- **Create** `apps/mobile/src/database/exerciseRepository.ts`
- **Create** `apps/mobile/src/database/appSettingsRepository.ts`
- **Modify** `apps/mobile/src/database/index.ts` — export new repository functions

## Acceptance Criteria

- [ ] `insertFoodEntry` creates a row in `food_entries` and returns the typed FoodEntry
- [ ] `insertFoodItem` creates a row in `food_items` with foreign key to `food_entry_id`
- [ ] `insertExerciseEntry` creates a row in `exercise_entries`
- [ ] `saveParsedLogEntry` writes ALL records in a single transaction — partial writes on failure are impossible
- [ ] If `saveParsedLogEntry` fails mid-transaction, ROLLBACK occurs and no rows are persisted
- [ ] `getFoodEntriesByDate` returns entries ordered by created_at DESC
- [ ] `getFoodItemsByEntryId` returns all items for a given food entry
- [ ] `getDailyExerciseCalories` returns SUM of calories_burned for user+date
- [ ] `getSetting` / `setSetting` reads/writes the `app_settings` table
- [ ] All SQL uses parameterized queries (no string concatenation)
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes

## Dependencies

- [Task 01: Database Tables & Types for Logging Entities](./01-database-tables-logging.md)
